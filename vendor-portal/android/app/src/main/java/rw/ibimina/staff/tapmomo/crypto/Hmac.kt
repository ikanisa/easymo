package rw.ibimina.staff.tapmomo.crypto

import android.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * HMAC-SHA256 utilities for TapMoMo payload signing and verification
 */
object Hmac {
    /**
     * Generate HMAC-SHA256 signature and return as Base64 string
     *
     * @param key Secret key bytes
     * @param data Data to sign
     * @return Base64-encoded signature (NO_WRAP)
     */
    fun sha256B64(key: ByteArray, data: ByteArray): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        val signature = mac.doFinal(data)
        return Base64.encodeToString(signature, Base64.NO_WRAP)
    }

    /**
     * Verify HMAC-SHA256 signature
     *
     * @param key Secret key bytes
     * @param data Original data
     * @param expectedSig Expected signature (Base64)
     * @return true if signature matches
     */
    fun verify(key: ByteArray, data: ByteArray, expectedSig: String): Boolean {
        val computed = sha256B64(key, data)
        return computed == expectedSig
    }
}
