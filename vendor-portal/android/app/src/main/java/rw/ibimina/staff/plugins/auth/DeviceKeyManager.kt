package rw.ibimina.staff.plugins.auth

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.*

class DeviceKeyManager(private val context: Context) {

    companion object {
        private const val TAG = "DeviceKeyManager"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALGORITHM = KeyProperties.KEY_ALGORITHM_EC
        private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
        private const val EC_CURVE = "secp256r1" // P-256
        private const val PREF_NAME = "DeviceAuthKeys"
        private const val PREF_DEVICE_ID = "device_id"
        private const val PREF_PUBLIC_KEY = "public_key_pem"
    }

    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }

    private val prefs by lazy {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun getDeviceId(): String {
        var deviceId = prefs.getString(PREF_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString()
            prefs.edit().putString(PREF_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }

    fun hasDeviceKey(): Boolean {
        val deviceId = getDeviceId()
        val alias = getKeyAlias(deviceId)
        return keyStore.containsAlias(alias)
    }

    fun generateDeviceKey(userId: String, requireBiometric: Boolean = true): Result<DeviceKeyInfo> {
        return try {
            val deviceId = getDeviceId()
            val alias = getKeyAlias(deviceId)

            if (keyStore.containsAlias(alias)) {
                keyStore.deleteEntry(alias)
            }

            val keyPairGenerator = KeyPairGenerator.getInstance(
                KEY_ALGORITHM,
                KEYSTORE_PROVIDER
            )

            val builder = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(requireBiometric)

            if (requireBiometric) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    builder.setInvalidatedByBiometricEnrollment(true)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setUserAuthenticationParameters(
                        0, // Duration: 0 means auth required for every use
                        KeyProperties.AUTH_BIOMETRIC_STRONG
                    )
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    @Suppress("DEPRECATION")
                    builder.setUserAuthenticationValidityDurationSeconds(-1)
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                builder.setIsStrongBoxBacked(true)
            }

            try {
                keyPairGenerator.initialize(builder.build())
            } catch (e: Exception) {
                Log.w(TAG, "StrongBox not available, falling back to TEE", e)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    builder.setIsStrongBoxBacked(false)
                }
                keyPairGenerator.initialize(builder.build())
            }

            val keyPair = keyPairGenerator.generateKeyPair()
            val publicKeyPem = exportPublicKeyToPem(keyPair.public)

            prefs.edit().putString(PREF_PUBLIC_KEY, publicKeyPem).apply()

            Log.d(TAG, "Device key generated successfully for device $deviceId")

            Result.success(
                DeviceKeyInfo(
                    deviceId = deviceId,
                    publicKeyPem = publicKeyPem,
                    keyAlgorithm = "ES256", // ECDSA with P-256 and SHA-256
                    isStrongBoxBacked = isKeyInStrongBox(alias)
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate device key", e)
            Result.failure(e)
        }
    }

    fun getPublicKey(): String? {
        return prefs.getString(PREF_PUBLIC_KEY, null)
    }

    fun signChallenge(challengeJson: String): Result<String> {
        return try {
            val deviceId = getDeviceId()
            val alias = getKeyAlias(deviceId)

            val privateKey = keyStore.getKey(alias, null) as? PrivateKey
                ?: return Result.failure(Exception("Private key not found"))

            val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
            signature.initSign(privateKey)
            signature.update(challengeJson.toByteArray(Charsets.UTF_8))

            val signatureBytes = signature.sign()
            val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)

            Log.d(TAG, "Challenge signed successfully")
            Result.success(signatureBase64)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sign challenge", e)
            Result.failure(e)
        }
    }

    fun deleteDeviceKey() {
        val deviceId = getDeviceId()
        val alias = getKeyAlias(deviceId)
        
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
        
        prefs.edit()
            .remove(PREF_PUBLIC_KEY)
            .apply()
        
        Log.d(TAG, "Device key deleted")
    }

    private fun getKeyAlias(deviceId: String): String {
        return "device_auth_$deviceId"
    }

    private fun exportPublicKeyToPem(publicKey: PublicKey): String {
        val encoded = publicKey.encoded
        val base64 = Base64.encodeToString(encoded, Base64.NO_WRAP)
        return "-----BEGIN PUBLIC KEY-----\n$base64\n-----END PUBLIC KEY-----"
    }

    private fun isKeyInStrongBox(alias: String): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            return false
        }

        return try {
            val keyFactory = java.security.KeyFactory.getInstance(
                KEY_ALGORITHM,
                KEYSTORE_PROVIDER
            )
            val privateKey = keyStore.getKey(alias, null)
            val keyInfo = keyFactory.getKeySpec(
                privateKey,
                android.security.keystore.KeyInfo::class.java
            )
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                keyInfo.securityLevel == android.security.keystore.KeyProperties.SECURITY_LEVEL_STRONGBOX
            } else {
                @Suppress("DEPRECATION")
                keyInfo.isInsideSecureHardware
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to check StrongBox status", e)
            false
        }
    }

    data class DeviceKeyInfo(
        val deviceId: String,
        val publicKeyPem: String,
        val keyAlgorithm: String,
        val isStrongBoxBacked: Boolean
    )
}
