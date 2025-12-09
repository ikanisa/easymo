package rw.ibimina.staff.plugins

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

@CapacitorPlugin(name = "PinAuth")
class PinAuthPlugin : Plugin() {
    
    private companion object {
        const val KEY_ALIAS = "ibimina_pin_key"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val PREFS_NAME = "pin_auth_prefs"
        const val PREF_PIN_HASH = "pin_hash"
        const val PREF_PIN_SALT = "pin_salt"
        const val PREF_IV = "pin_iv"
        const val PREF_FAIL_COUNT = "fail_count"
        const val PREF_LOCK_UNTIL = "lock_until"
        const val MAX_ATTEMPTS = 5
        const val LOCKOUT_DURATION_MS = 15 * 60 * 1000L // 15 minutes
    }

    @PluginMethod
    fun hasPin(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val hasPin = prefs.contains(PREF_PIN_HASH)
            
            val ret = JSObject()
            ret.put("hasPin", hasPin)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to check PIN status", e)
        }
    }

    @PluginMethod
    fun setPin(call: PluginCall) {
        val pin = call.getString("pin") ?: run {
            call.reject("PIN is required")
            return
        }

        // Validate PIN format
        if (pin.length != 6 || !pin.all { it.isDigit() }) {
            call.reject("PIN must be exactly 6 digits")
            return
        }

        try {
            // Generate salt
            val salt = ByteArray(16)
            SecureRandom().nextBytes(salt)
            
            // Hash PIN with salt (PBKDF2)
            val pinHash = hashPin(pin, salt)
            
            // Encrypt PIN hash
            val encryptedData = encryptPinHash(pinHash)
            
            // Store encrypted hash, salt, and IV
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString(PREF_PIN_HASH, Base64.encodeToString(encryptedData.encrypted, Base64.DEFAULT))
                putString(PREF_PIN_SALT, Base64.encodeToString(salt, Base64.DEFAULT))
                putString(PREF_IV, Base64.encodeToString(encryptedData.iv, Base64.DEFAULT))
                putInt(PREF_FAIL_COUNT, 0)
                putLong(PREF_LOCK_UNTIL, 0)
                apply()
            }
            
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to set PIN", e)
        }
    }

    @PluginMethod
    fun verifyPin(call: PluginCall) {
        val pin = call.getString("pin") ?: run {
            call.reject("PIN is required")
            return
        }

        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            
            // Check if locked out
            val lockUntil = prefs.getLong(PREF_LOCK_UNTIL, 0)
            if (System.currentTimeMillis() < lockUntil) {
                val remainingSeconds = (lockUntil - System.currentTimeMillis()) / 1000
                call.reject("Too many failed attempts. Try again in $remainingSeconds seconds")
                return
            }
            
            // Get stored data
            val storedHashB64 = prefs.getString(PREF_PIN_HASH, null) ?: run {
                call.reject("No PIN set")
                return
            }
            val saltB64 = prefs.getString(PREF_PIN_SALT, null) ?: run {
                call.reject("No PIN set")
                return
            }
            val ivB64 = prefs.getString(PREF_IV, null) ?: run {
                call.reject("No PIN set")
                return
            }
            
            // Decrypt stored hash
            val encryptedHash = Base64.decode(storedHashB64, Base64.DEFAULT)
            val iv = Base64.decode(ivB64, Base64.DEFAULT)
            val storedHash = decryptPinHash(encryptedHash, iv)
            
            // Hash provided PIN with stored salt
            val salt = Base64.decode(saltB64, Base64.DEFAULT)
            val providedHash = hashPin(pin, salt)
            
            // Compare hashes
            val isValid = storedHash.contentEquals(providedHash)
            
            if (isValid) {
                // Reset fail count on success
                prefs.edit().apply {
                    putInt(PREF_FAIL_COUNT, 0)
                    putLong(PREF_LOCK_UNTIL, 0)
                    apply()
                }
                
                val ret = JSObject()
                ret.put("success", true)
                ret.put("valid", true)
                call.resolve(ret)
            } else {
                // Increment fail count
                val failCount = prefs.getInt(PREF_FAIL_COUNT, 0) + 1
                prefs.edit().putInt(PREF_FAIL_COUNT, failCount).apply()
                
                if (failCount >= MAX_ATTEMPTS) {
                    // Lock out user
                    val lockUntilTime = System.currentTimeMillis() + LOCKOUT_DURATION_MS
                    prefs.edit().putLong(PREF_LOCK_UNTIL, lockUntilTime).apply()
                    call.reject("Too many failed attempts. Account locked for 15 minutes")
                } else {
                    val attemptsRemaining = MAX_ATTEMPTS - failCount
                    val ret = JSObject()
                    ret.put("success", false)
                    ret.put("valid", false)
                    ret.put("attemptsRemaining", attemptsRemaining)
                    call.resolve(ret)
                }
            }
        } catch (e: Exception) {
            call.reject("Failed to verify PIN", e)
        }
    }

    @PluginMethod
    fun deletePin(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            prefs.edit().clear().apply()
            
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to delete PIN", e)
        }
    }

    @PluginMethod
    fun changePin(call: PluginCall) {
        val oldPin = call.getString("oldPin") ?: run {
            call.reject("Old PIN is required")
            return
        }
        val newPin = call.getString("newPin") ?: run {
            call.reject("New PIN is required")
            return
        }

        try {
            // Verify old PIN first
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val storedHashB64 = prefs.getString(PREF_PIN_HASH, null) ?: run {
                call.reject("No PIN set")
                return
            }
            val saltB64 = prefs.getString(PREF_PIN_SALT, null) ?: run {
                call.reject("No PIN set")
                return
            }
            val ivB64 = prefs.getString(PREF_IV, null) ?: run {
                call.reject("No PIN set")
                return
            }
            
            val encryptedHash = Base64.decode(storedHashB64, Base64.DEFAULT)
            val iv = Base64.decode(ivB64, Base64.DEFAULT)
            val storedHash = decryptPinHash(encryptedHash, iv)
            
            val salt = Base64.decode(saltB64, Base64.DEFAULT)
            val providedHash = hashPin(oldPin, salt)
            
            if (!storedHash.contentEquals(providedHash)) {
                call.reject("Incorrect old PIN")
                return
            }
            
            // Old PIN verified, now set new PIN
            val newSalt = ByteArray(16)
            SecureRandom().nextBytes(newSalt)
            val newPinHash = hashPin(newPin, newSalt)
            val newEncryptedData = encryptPinHash(newPinHash)
            
            prefs.edit().apply {
                putString(PREF_PIN_HASH, Base64.encodeToString(newEncryptedData.encrypted, Base64.DEFAULT))
                putString(PREF_PIN_SALT, Base64.encodeToString(newSalt, Base64.DEFAULT))
                putString(PREF_IV, Base64.encodeToString(newEncryptedData.iv, Base64.DEFAULT))
                putInt(PREF_FAIL_COUNT, 0)
                putLong(PREF_LOCK_UNTIL, 0)
                apply()
            }
            
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to change PIN", e)
        }
    }

    @PluginMethod
    fun getLockStatus(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val lockUntil = prefs.getLong(PREF_LOCK_UNTIL, 0)
            val failCount = prefs.getInt(PREF_FAIL_COUNT, 0)
            
            val isLocked = System.currentTimeMillis() < lockUntil
            val remainingSeconds = if (isLocked) {
                ((lockUntil - System.currentTimeMillis()) / 1000).toInt()
            } else {
                0
            }
            
            val ret = JSObject()
            ret.put("isLocked", isLocked)
            ret.put("remainingSeconds", remainingSeconds)
            ret.put("failCount", failCount)
            ret.put("attemptsRemaining", MAX_ATTEMPTS - failCount)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get lock status", e)
        }
    }

    private fun hashPin(pin: String, salt: ByteArray): ByteArray {
        val spec = javax.crypto.spec.PBEKeySpec(pin.toCharArray(), salt, 10000, 256)
        val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return factory.generateSecret(spec).encoded
    }

    private data class EncryptedData(val encrypted: ByteArray, val iv: ByteArray)

    private fun encryptPinHash(data: ByteArray): EncryptedData {
        val secretKey = getOrCreateSecretKey()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        val encrypted = cipher.doFinal(data)
        return EncryptedData(encrypted, cipher.iv)
    }

    private fun decryptPinHash(encrypted: ByteArray, iv: ByteArray): ByteArray {
        val secretKey = getOrCreateSecretKey()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        return cipher.doFinal(encrypted)
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)

        if (keyStore.containsAlias(KEY_ALIAS)) {
            return keyStore.getKey(KEY_ALIAS, null) as SecretKey
        }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(false)
            .build()

        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }
}
