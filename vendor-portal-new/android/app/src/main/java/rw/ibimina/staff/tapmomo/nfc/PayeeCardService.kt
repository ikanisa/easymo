package rw.ibimina.staff.tapmomo.nfc

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log

/**
 * NFC Host Card Emulation service for TapMoMo payee (merchant/receiver)
 *
 * Emulates an ISO 7816-4 Type A card that responds to SELECT AID commands
 * with a signed payment payload (JSON).
 *
 * Flow:
 * 1. Merchant activates "Get Paid" mode → arms payload for 60 seconds
 * 2. Payer's device sends SELECT AID command
 * 3. Service responds with JSON payload + 9000 status
 * 4. Payload is consumed (one-time use)
 *
 * Security:
 * - Payload is armed only when merchant explicitly requests it
 * - TTL: 60 seconds (configurable)
 * - One-shot: payload consumed after first successful read
 * - Device must be unlocked (requireDeviceUnlock in apduservice.xml)
 */
class PayeeCardService : HostApduService() {
    companion object {
        private const val TAG = "TapMoMo.PayeeHCE"

        // ISO 7816-4 APDU Commands
        private val SELECT = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00)

        // Status Words
        private val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A, 0x82.toByte())
        private val SW_CONDITIONS_NOT_SATISFIED = byteArrayOf(0x69, 0x85.toByte())
        private val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D, 0x00)
    }

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        Log.d(TAG, "Received APDU: ${commandApdu.toHex()}")

        // Check if payload is armed and not expired
        if (!ActivePayload.isActive()) {
            Log.w(TAG, "No active payload or expired")
            return SW_FILE_NOT_FOUND
        }

        // Check if this is a SELECT AID command
        return if (commandApdu.startsWith(SELECT)) {
            val payload = ActivePayload.consumeOnce()
            if (payload != null) {
                Log.d(TAG, "Sending payload: ${payload.size} bytes")
                payload + SW_SUCCESS
            } else {
                Log.w(TAG, "Payload already consumed or expired")
                SW_CONDITIONS_NOT_SATISFIED
            }
        } else {
            Log.w(TAG, "Unsupported INS")
            SW_INS_NOT_SUPPORTED
        }
    }

    override fun onDeactivated(reason: Int) {
        val reasonStr = when (reason) {
            DEACTIVATION_LINK_LOSS -> "LINK_LOSS"
            DEACTIVATION_DESELECTED -> "DESELECTED"
            else -> "UNKNOWN($reason)"
        }
        Log.d(TAG, "Deactivated: $reasonStr")
    }

    /**
     * Global singleton for payload management
     *
     * Thread-safe volatile storage for the active payload.
     * Payload is "armed" before entering HCE mode and "consumed" after first read.
     */
    object ActivePayload {
        @Volatile
        private var bytes: ByteArray? = null

        @Volatile
        private var expiresAt: Long = 0

        /**
         * Arm payload for HCE transmission
         *
         * @param json JSON payload bytes (UTF-8)
         * @param ttlMs Time-to-live in milliseconds (default: 60 seconds)
         */
        fun arm(json: ByteArray, ttlMs: Long = 60_000) {
            bytes = json
            expiresAt = System.currentTimeMillis() + ttlMs
            Log.d(TAG, "Payload armed: ${json.size} bytes, expires in ${ttlMs}ms")
        }

        /**
         * Check if payload is active and not expired
         *
         * @return true if armed and within TTL
         */
        fun isActive(): Boolean {
            return bytes != null && System.currentTimeMillis() < expiresAt
        }

        /**
         * Consume payload (one-time use)
         *
         * @return Payload bytes or null if not active/already consumed
         */
        fun consumeOnce(): ByteArray? {
            return if (isActive()) {
                val data = bytes
                bytes = null  // Clear after first read
                Log.d(TAG, "Payload consumed")
                data
            } else {
                null
            }
        }

        /**
         * Disarm payload manually (cancel operation)
         */
        fun disarm() {
            bytes = null
            expiresAt = 0
            Log.d(TAG, "Payload disarmed")
        }

        /**
         * Clear payload (alias for disarm)
         */
        fun clear() = disarm()
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean {
        if (size < prefix.size) return false
        return sliceArray(0 until prefix.size).contentEquals(prefix)
    }

    private fun ByteArray.toHex(): String {
        return joinToString("") { "%02X".format(it) }
    }
}
