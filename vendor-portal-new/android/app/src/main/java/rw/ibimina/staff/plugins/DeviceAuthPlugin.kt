package rw.ibimina.staff.plugins

import android.os.Build
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import rw.ibimina.staff.plugins.auth.BiometricAuthHelper
import rw.ibimina.staff.plugins.auth.ChallengeSigner
import rw.ibimina.staff.plugins.auth.DeviceKeyManager

@CapacitorPlugin(name = "DeviceAuth")
class DeviceAuthPlugin : Plugin() {

    private lateinit var keyManager: DeviceKeyManager
    private lateinit var biometricHelper: BiometricAuthHelper
    private lateinit var challengeSigner: ChallengeSigner

    override fun load() {
        super.load()
        keyManager = DeviceKeyManager(context)
        biometricHelper = BiometricAuthHelper(context)
        challengeSigner = ChallengeSigner(keyManager)
    }

    @PluginMethod
    fun checkBiometricAvailable(call: PluginCall) {
        val status = biometricHelper.checkBiometricAvailable()
        
        val result = JSObject()
        result.put("available", status.available)
        result.put("message", status.message)
        
        call.resolve(result)
    }

    @PluginMethod
    fun hasDeviceKey(call: PluginCall) {
        val result = JSObject()
        result.put("hasKey", keyManager.hasDeviceKey())
        result.put("deviceId", keyManager.getDeviceId())
        
        if (keyManager.hasDeviceKey()) {
            result.put("publicKey", keyManager.getPublicKey())
        }
        
        call.resolve(result)
    }

    @PluginMethod
    fun getDeviceInfo(call: PluginCall) {
        val result = JSObject()
        result.put("deviceId", keyManager.getDeviceId())
        result.put("model", Build.MODEL)
        result.put("manufacturer", Build.MANUFACTURER)
        result.put("osVersion", Build.VERSION.RELEASE)
        result.put("sdkVersion", Build.VERSION.SDK_INT)
        result.put("brand", Build.BRAND)
        result.put("device", Build.DEVICE)
        
        call.resolve(result)
    }

    @PluginMethod
    fun generateDeviceKey(call: PluginCall) {
        val userId = call.getString("userId")
        val requireBiometric = call.getBoolean("requireBiometric", true) ?: true

        if (userId.isNullOrBlank()) {
            call.reject("userId is required")
            return
        }

        bridge.saveCall(call)

        val activity = activity
        if (activity !is FragmentActivity) {
            call.reject("Activity is not a FragmentActivity")
            return
        }

        biometricHelper.authenticateForEnrollment(
            activity = activity,
            onSuccess = {
                val keyResult = keyManager.generateDeviceKey(userId, requireBiometric)
                
                keyResult.fold(
                    onSuccess = { keyInfo ->
                        val result = JSObject()
                        result.put("success", true)
                        result.put("deviceId", keyInfo.deviceId)
                        result.put("publicKey", keyInfo.publicKeyPem)
                        result.put("keyAlgorithm", keyInfo.keyAlgorithm)
                        result.put("isStrongBoxBacked", keyInfo.isStrongBoxBacked)
                        
                        val savedCall = bridge.getSavedCall(call.callbackId)
                        savedCall?.resolve(result)
                    },
                    onFailure = { error ->
                        val savedCall = bridge.getSavedCall(call.callbackId)
                        savedCall?.reject("Key generation failed: ${error.message}")
                    }
                )
            },
            onError = { errorCode, errorMessage ->
                val savedCall = bridge.getSavedCall(call.callbackId)
                savedCall?.reject("Biometric authentication failed: $errorMessage (code: $errorCode)")
            },
            onFailed = {
                val savedCall = bridge.getSavedCall(call.callbackId)
                savedCall?.reject("Biometric authentication failed: Not recognized")
            }
        )
    }

    @PluginMethod
    fun signChallenge(call: PluginCall) {
        val challengeJson = call.getString("challenge")
        val userId = call.getString("userId")
        val origin = call.getString("origin")

        if (challengeJson.isNullOrBlank()) {
            call.reject("challenge is required")
            return
        }

        if (userId.isNullOrBlank()) {
            call.reject("userId is required")
            return
        }

        if (origin.isNullOrBlank()) {
            call.reject("origin is required (for user display)")
            return
        }

        val validationResult = challengeSigner.validateChallenge(challengeJson)
        when (validationResult) {
            is ChallengeSigner.ValidationResult.Invalid -> {
                call.reject("Invalid challenge: ${validationResult.reason}")
                return
            }
            is ChallengeSigner.ValidationResult.Expired -> {
                call.reject("Challenge has expired")
                return
            }
            is ChallengeSigner.ValidationResult.Valid -> {
                // Continue
            }
        }

        bridge.saveCall(call)

        val activity = activity
        if (activity !is FragmentActivity) {
            call.reject("Activity is not a FragmentActivity")
            return
        }

        biometricHelper.authenticateForSigning(
            activity = activity,
            origin = origin,
            onSuccess = {
                val signingResult = challengeSigner.signChallenge(challengeJson, userId)
                
                when (signingResult) {
                    is ChallengeSigner.SigningResult.Success -> {
                        val result = JSObject()
                        result.put("success", true)
                        result.put("signature", signingResult.signature)
                        result.put("signedMessage", signingResult.signedMessage)
                        result.put("deviceId", keyManager.getDeviceId())
                        
                        val challengeInfo = JSObject()
                        challengeInfo.put("sessionId", signingResult.challengeInfo.sessionId)
                        challengeInfo.put("nonce", signingResult.challengeInfo.nonce)
                        challengeInfo.put("origin", signingResult.challengeInfo.origin)
                        result.put("challengeInfo", challengeInfo)
                        
                        val savedCall = bridge.getSavedCall(call.callbackId)
                        savedCall?.resolve(result)
                    }
                    is ChallengeSigner.SigningResult.Failure -> {
                        val savedCall = bridge.getSavedCall(call.callbackId)
                        savedCall?.reject("Signing failed: ${signingResult.reason}")
                    }
                }
            },
            onError = { errorCode, errorMessage ->
                val savedCall = bridge.getSavedCall(call.callbackId)
                savedCall?.reject("Biometric authentication failed: $errorMessage (code: $errorCode)")
            },
            onFailed = {
                val savedCall = bridge.getSavedCall(call.callbackId)
                savedCall?.reject("Biometric authentication failed: Not recognized")
            }
        )
    }

    @PluginMethod
    fun deleteDeviceKey(call: PluginCall) {
        try {
            keyManager.deleteDeviceKey()
            
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to delete device key: ${e.message}")
        }
    }

    @PluginMethod
    fun validateChallenge(call: PluginCall) {
        val challengeJson = call.getString("challenge")

        if (challengeJson.isNullOrBlank()) {
            call.reject("challenge is required")
            return
        }

        val validationResult = challengeSigner.validateChallenge(challengeJson)
        
        val result = JSObject()
        when (validationResult) {
            is ChallengeSigner.ValidationResult.Valid -> {
                result.put("valid", true)
                result.put("sessionId", validationResult.info.sessionId)
                result.put("nonce", validationResult.info.nonce)
                result.put("origin", validationResult.info.origin)
                result.put("expiresAt", validationResult.info.expiresAt)
            }
            is ChallengeSigner.ValidationResult.Invalid -> {
                result.put("valid", false)
                result.put("reason", validationResult.reason)
            }
            is ChallengeSigner.ValidationResult.Expired -> {
                result.put("valid", false)
                result.put("reason", "Challenge has expired")
                result.put("expired", true)
            }
        }
        
        call.resolve(result)
    }
}
