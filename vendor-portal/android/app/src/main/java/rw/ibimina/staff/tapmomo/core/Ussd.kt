package rw.ibimina.staff.tapmomo.core

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * USSD code builder and launcher for mobile money payments
 *
 * Supports:
 * - MTN MoMo: *182*8*1*{merchant}*{amount}#
 * - Airtel Money: *182*8*1*{merchant}*{amount}#
 * - Dynamic merchant/amount codes
 *
 * Launching strategy (fallback chain):
 * 1. TelephonyManager.sendUssdRequest (API 26+, requires SIM with USSD support)
 * 2. ACTION_DIAL fallback (universal, opens dialer with pre-filled USSD)
 */
object Ussd {
    private const val TAG = "TapMoMo.Ussd"

    /**
     * Build USSD code for payment
     *
     * @param network "MTN" or "Airtel"
     * @param merchantId Merchant/group code
     * @param amount Amount in RWF (null = user enters manually in USSD menu)
     * @return USSD code string (e.g., "*182*8*1*123456*2500#")
     */
    fun build(network: String, merchantId: String, amount: Int?): String {
        return when (network.uppercase()) {
            "MTN", "AIRTEL" -> {
                if (amount != null) {
                    "*182*8*1*$merchantId*$amount#"
                } else {
                    "*182*8*1*$merchantId#"
                }
            }
            else -> "*182#"  // Generic MoMo shortcode
        }
    }

    /**
     * Launch USSD code
     *
     * Tries sendUssdRequest first (API 26+), falls back to ACTION_DIAL if:
     * - SecurityException (missing CALL_PHONE permission)
     * - Device doesn't support USSD
     * - SIM not available
     *
     * @param context Android context
     * @param rawUssd USSD code (e.g., "*182*8*1*123*5000#")
     * @param subId Subscription ID (SIM slot) or null for default
     */
    fun launch(context: Context, rawUssd: String, subId: Int? = null) {
        val tm0 = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        val tm = if (subId != null) {
            try {
                tm0.createForSubscriptionId(subId)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to create TelephonyManager for subId=$subId", e)
                tm0
            }
        } else {
            tm0
        }

        // Require CALL_PHONE permission for sendUssdRequest
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            Log.w(TAG, "CALL_PHONE permission not granted, falling back to dialer")
            openDialer(context, rawUssd)
            return
        }

        try {
            Log.d(TAG, "Launching USSD via TelephonyManager: $rawUssd (subId=$subId)")
            tm.sendUssdRequest(
                rawUssd,
                object : TelephonyManager.UssdResponseCallback() {
                    override fun onReceiveUssdResponse(
                        tm: TelephonyManager,
                        request: String,
                        response: CharSequence
                    ) {
                        Log.d(TAG, "USSD response: $response")
                        // TODO: Surface response to user if needed
                    }

                    override fun onReceiveUssdResponseFailed(
                        tm: TelephonyManager,
                        request: String,
                        failureCode: Int
                    ) {
                        Log.w(TAG, "USSD request failed: code=$failureCode")
                        openDialer(context, rawUssd)
                    }
                },
                Handler(Looper.getMainLooper())
            )
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException launching USSD", e)
            openDialer(context, rawUssd)
        } catch (e: Exception) {
            Log.w(TAG, "Exception launching USSD", e)
            openDialer(context, rawUssd)
        }
    }

    /**
     * Open phone dialer with pre-filled USSD code
     *
     * This is the universal fallback that works on all devices.
     * User must manually tap "Call" button.
     *
     * @param ctx Context
     * @param raw USSD code
     */
    private fun openDialer(ctx: Context, raw: String) {
        // URL-encode # character
        val encoded = raw.replace("#", "%23")
        val tel = "tel:$encoded"

        Log.d(TAG, "Opening dialer with USSD: $tel")

        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse(tel))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open dialer", e)
        }
    }

    /**
     * Get list of active SIM subscriptions
     *
     * Useful for dual-SIM devices where user needs to select which SIM to use.
     *
     * @param ctx Context
     * @return List of active SubscriptionInfo (can be empty)
     */
    fun activeSubscriptions(ctx: Context): List<SubscriptionInfo> {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
            return emptyList()
        }

        return try {
            val sm = ctx.getSystemService(SubscriptionManager::class.java)
            sm?.activeSubscriptionInfoList ?: emptyList()
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException getting subscriptions", e)
            emptyList()
        } catch (e: Exception) {
            Log.w(TAG, "Exception getting subscriptions", e)
            emptyList()
        }
    }
}
