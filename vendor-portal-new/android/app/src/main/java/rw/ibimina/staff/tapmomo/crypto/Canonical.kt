package rw.ibimina.staff.tapmomo.crypto

import rw.ibimina.staff.tapmomo.model.Payload

/**
 * Canonical JSON serialization for consistent HMAC computation
 *
 * Critical: Field order must match EXACTLY across all platforms
 * (Android, iOS, backend). Any deviation breaks signature verification.
 *
 * Format (no spaces, compact):
 * {"ver":<int>,"network":"<str>","merchantId":"<str>","currency":"<str>","amount":<int|null>,"ref":"<str|omit>","ts":<long>,"nonce":"<str>"}
 *
 * Rules:
 * - If ref is null/empty, OMIT the key entirely
 * - amount can be null (JSON null literal)
 * - No trailing commas
 * - No spaces or extra whitespace
 * - UTF-8 encoding
 */
object Canonical {
    /**
     * Serialize payload to canonical form WITHOUT signature field
     *
     * @param p Payload to canonicalize
     * @return UTF-8 bytes of canonical JSON
     */
    fun canonicalWithoutSig(p: Payload): ByteArray {
        val sb = StringBuilder()
        sb.append("{\"ver\":").append(p.ver)
            .append(",\"network\":\"").append(p.network).append("\"")
            .append(",\"merchantId\":\"").append(p.merchantId).append("\"")
            .append(",\"currency\":\"").append(p.currency).append("\"")
            .append(",\"amount\":")

        if (p.amount == null) {
            sb.append("null")
        } else {
            sb.append(p.amount)
        }

        // Include ref ONLY if not null/empty
        if (!p.ref.isNullOrEmpty()) {
            sb.append(",\"ref\":\"").append(p.ref).append("\"")
        }

        sb.append(",\"ts\":").append(p.ts)
            .append(",\"nonce\":\"").append(p.nonce).append("\"")
            .append("}")

        return sb.toString().toByteArray(Charsets.UTF_8)
    }
}
