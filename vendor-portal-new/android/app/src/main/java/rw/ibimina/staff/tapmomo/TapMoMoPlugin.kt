package rw.ibimina.staff.tapmomo

import android.app.Activity
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Build
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import rw.ibimina.staff.tapmomo.core.Ussd
import rw.ibimina.staff.tapmomo.crypto.Canonical
import rw.ibimina.staff.tapmomo.crypto.Hmac
import rw.ibimina.staff.tapmomo.model.Payload
import rw.ibimina.staff.tapmomo.nfc.PayeeCardService
import rw.ibimina.staff.tapmomo.nfc.Reader
import rw.ibimina.staff.tapmomo.verify.Verifier
import java.util.*

@CapacitorPlugin(name = "TapMoMo")
class TapMoMoPlugin : Plugin() {
    private val TAG = "TapMoMoPlugin"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var reader: Reader? = null
    private var verifier: Verifier? = null

    override fun load() {
        verifier = Verifier(context)
    }

    @PluginMethod
    fun checkNfcAvailable(call: PluginCall) {
        val nfc = NfcAdapter.getDefaultAdapter(context)
        val ret = JSObject()
        ret.put("available", nfc != null)
        ret.put("enabled", nfc?.isEnabled == true)
        ret.put("hceSupported", nfc != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT)
        call.resolve(ret)
    }

    @PluginMethod
    fun armPayee(call: PluginCall) {
        try {
            val network = call.getString("network") ?: "MTN"
            val merchantId = call.getString("merchantId") ?: return call.reject("merchantId required")
            val amount = if (call.hasOption("amount")) call.getInt("amount") else null
            val ref = call.getString("ref")
            val merchantKey = call.getString("merchantKey") ?: return call.reject("merchantKey required")
            
            // Create payload
            val ts = System.currentTimeMillis()
            val nonce = UUID.randomUUID().toString()
            val payload = Payload(
                ver = 1,
                network = network,
                merchantId = merchantId,
                currency = "RWF",
                amount = amount,
                ref = ref,
                ts = ts,
                nonce = nonce,
                sig = ""
            )
            
            // Sign it
            val keyBytes = merchantKey.toByteArray(Charsets.UTF_8)
            val canon = Canonical.canonicalWithoutSig(payload)
            val sig = Hmac.sha256B64(keyBytes, canon)
            
            val signedPayload = payload.copy(sig = sig)
            
            // Convert to JSON
            val json = JSONObject().apply {
                put("ver", signedPayload.ver)
                put("network", signedPayload.network)
                put("merchantId", signedPayload.merchantId)
                put("currency", signedPayload.currency)
                put("amount", signedPayload.amount)
                if (signedPayload.ref != null) put("ref", signedPayload.ref)
                put("ts", signedPayload.ts)
                put("nonce", signedPayload.nonce)
                put("sig", signedPayload.sig)
            }.toString()
            
            // Arm HCE service
            val ttlSecondsValue = call.getInt("ttlSeconds", 60) ?: 60
            val ttlMs = ttlSecondsValue * 1000L
            PayeeCardService.ActivePayload.arm(json.toByteArray(Charsets.UTF_8), ttlMs)
            
            Log.d(TAG, "Payee armed: $json")
            
            val ret = JSObject()
            ret.put("success", true)
            ret.put("nonce", nonce)
            ret.put("expiresAt", ts + ttlMs)
            call.resolve(ret)
            
        } catch (e: Exception) {
            Log.e(TAG, "armPayee error", e)
            call.reject("Failed to arm payee: ${e.message}")
        }
    }

    @PluginMethod
    fun disarmPayee(call: PluginCall) {
        PayeeCardService.ActivePayload.clear()
        call.resolve()
    }

    @PluginMethod
    fun startReader(call: PluginCall) {
        val activity = activity ?: return call.reject("Activity not available")
        
        reader = Reader(
            activity,
            onJson = { json ->
                activity.runOnUiThread {
                    handlePayload(json, call)
                }
            },
            onError = { error ->
                activity.runOnUiThread {
                    notifyListeners("readerError", JSObject().put("error", error))
                }
            }
        )
        
        reader?.enable()
        
        val ret = JSObject()
        ret.put("success", true)
        ret.put("message", "Hold near payee device")
        call.resolve(ret)
    }

    @PluginMethod
    fun stopReader(call: PluginCall) {
        reader?.disable()
        reader = null
        call.resolve()
    }

    private fun handlePayload(json: String, call: PluginCall) {
        scope.launch {
            try {
                val verifier = verifier ?: return@launch
                val payload = verifier.parse(json)
                
                // For demo, use merchant ID as key (in production, fetch from Supabase)
                val merchantKey = payload.merchantId.toByteArray(Charsets.UTF_8)
                
                val result = verifier.validate(payload, merchantKey)
                
                if (result.isSuccess) {
                    val ret = JSObject().apply {
                        put("success", true)
                        put("network", payload.network)
                        put("merchantId", payload.merchantId)
                        put("amount", payload.amount)
                        put("currency", payload.currency)
                        put("ref", payload.ref)
                        put("nonce", payload.nonce)
                    }
                    notifyListeners("payloadReceived", ret)
                } else {
                    val error = result.exceptionOrNull()?.message ?: "Validation failed"
                    notifyListeners("readerError", JSObject().put("error", error))
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "handlePayload error", e)
                notifyListeners("readerError", JSObject().put("error", e.message))
            }
        }
    }

    @PluginMethod
    fun launchUssd(call: PluginCall) {
        try {
            val network = call.getString("network") ?: "MTN"
            val merchantId = call.getString("merchantId") ?: return call.reject("merchantId required")
            val amount = if (call.hasOption("amount")) call.getInt("amount") else null
            val subId = if (call.hasOption("subscriptionId")) call.getInt("subscriptionId") else null
            
            val ussdCode = Ussd.build(network, merchantId, amount)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Ussd.launch(context, ussdCode, subId)
                call.resolve(JSObject().put("success", true).put("ussdCode", ussdCode))
            } else {
                call.reject("USSD launch requires Android 8.0+")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "launchUssd error", e)
            call.reject("Failed to launch USSD: ${e.message}")
        }
    }

    @PluginMethod
    fun getActiveSubscriptions(call: PluginCall) {
        try {
            val subs = Ussd.activeSubscriptions(context)
            val ret = JSObject()
            val arr = subs.map { sub ->
                JSObject().apply {
                    put("subscriptionId", sub.subscriptionId)
                    put("displayName", sub.displayName)
                    put("carrierName", sub.carrierName)
                    put("number", sub.number)
                }
            }
            ret.put("subscriptions", arr)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "getActiveSubscriptions error", e)
            call.reject("Failed to get subscriptions: ${e.message}")
        }
    }
}
