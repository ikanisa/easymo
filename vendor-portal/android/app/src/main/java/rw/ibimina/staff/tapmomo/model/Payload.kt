package rw.ibimina.staff.tapmomo.model

import org.json.JSONObject

/**
 * TapMoMo payment payload exchanged over NFC
 *
 * Security features:
 * - HMAC-SHA256 signature for integrity
 * - Timestamp with TTL validation
 * - Nonce for replay protection
 * - Network-specific merchant IDs
 */
data class Payload(
    val ver: Int,                    // Protocol version (always 1)
    val network: String,             // "MTN" or "Airtel"
    val merchantId: String,          // Merchant/group code
    val currency: String,            // "RWF"
    val amount: Int?,                // Amount in RWF (null = payer enters)
    val ref: String?,                // Optional reference/invoice ID
    val ts: Long,                    // Unix epoch milliseconds
    val nonce: String,               // UUID v4 for replay protection
    val sig: String                  // HMAC-SHA256 signature (Base64)
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("ver", ver)
            put("network", network)
            put("merchantId", merchantId)
            put("currency", currency)
            put("amount", amount ?: JSONObject.NULL)
            if (!ref.isNullOrEmpty()) {
                put("ref", ref)
            }
            put("ts", ts)
            put("nonce", nonce)
            put("sig", sig)
        }
    }

    companion object {
        fun fromJson(json: JSONObject): Payload {
            return Payload(
                ver = json.getInt("ver"),
                network = json.getString("network"),
                merchantId = json.getString("merchantId"),
                currency = json.getString("currency"),
                amount = if (json.isNull("amount")) null else json.getInt("amount"),
                ref = if (json.has("ref") && !json.isNull("ref")) json.getString("ref") else null,
                ts = json.getLong("ts"),
                nonce = json.getString("nonce"),
                sig = json.getString("sig")
            )
        }
    }
}
