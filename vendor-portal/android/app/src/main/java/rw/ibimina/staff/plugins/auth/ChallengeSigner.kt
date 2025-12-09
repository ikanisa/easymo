package rw.ibimina.staff.plugins.auth

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class ChallengeSigner(
    private val keyManager: DeviceKeyManager
) {

    companion object {
        private const val TAG = "ChallengeSigner"
        private val ISO_DATE_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
    }

    fun validateChallenge(challengeJson: String): ValidationResult {
        return try {
            val challenge = JSONObject(challengeJson)

            if (!challenge.has("session_id")) {
                return ValidationResult.Invalid("Missing session_id")
            }
            if (!challenge.has("nonce")) {
                return ValidationResult.Invalid("Missing nonce")
            }
            if (!challenge.has("origin")) {
                return ValidationResult.Invalid("Missing origin")
            }
            if (!challenge.has("exp")) {
                return ValidationResult.Invalid("Missing exp (expiration)")
            }

            val sessionId = challenge.getString("session_id")
            val nonce = challenge.getString("nonce")
            val origin = challenge.getString("origin")
            val expString = challenge.getString("exp")

            if (sessionId.isBlank()) {
                return ValidationResult.Invalid("session_id is empty")
            }
            if (nonce.isBlank() || nonce.length < 16) {
                return ValidationResult.Invalid("nonce is invalid or too short")
            }
            if (origin.isBlank() || !origin.startsWith("https://")) {
                return ValidationResult.Invalid("origin must be a valid HTTPS URL")
            }

            val expiresAt = try {
                ISO_DATE_FORMAT.parse(expString)?.time ?: 0L
            } catch (e: Exception) {
                return ValidationResult.Invalid("exp is not a valid ISO timestamp")
            }

            if (expiresAt <= System.currentTimeMillis()) {
                return ValidationResult.Expired
            }

            ValidationResult.Valid(
                ChallengeInfo(
                    sessionId = sessionId,
                    nonce = nonce,
                    origin = origin,
                    expiresAt = expiresAt
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Challenge validation failed", e)
            ValidationResult.Invalid("Invalid JSON format")
        }
    }

    fun createCanonicalMessage(challenge: JSONObject, userId: String): String {
        val sessionId = challenge.getString("session_id")
        val nonce = challenge.getString("nonce")
        val origin = challenge.getString("origin")
        val exp = challenge.getString("exp")

        val canonical = JSONObject()
        canonical.put("ver", 1)
        canonical.put("user_id", userId)
        canonical.put("device_id", keyManager.getDeviceId())
        canonical.put("session_id", sessionId)
        canonical.put("origin", origin)
        canonical.put("nonce", nonce)
        canonical.put("ts", System.currentTimeMillis() / 1000) // Unix timestamp in seconds
        canonical.put("scope", JSONArray().put("login"))
        canonical.put("alg", "ES256")

        return canonical.toString()
    }

    fun signChallenge(challengeJson: String, userId: String): SigningResult {
        val validationResult = validateChallenge(challengeJson)
        
        when (validationResult) {
            is ValidationResult.Invalid -> {
                return SigningResult.Failure(validationResult.reason)
            }
            is ValidationResult.Expired -> {
                return SigningResult.Failure("Challenge has expired")
            }
            is ValidationResult.Valid -> {
                // Continue to signing
            }
        }

        return try {
            val challenge = JSONObject(challengeJson)
            val canonicalMessage = createCanonicalMessage(challenge, userId)

            val signatureResult = keyManager.signChallenge(canonicalMessage)
            
            signatureResult.fold(
                onSuccess = { signature ->
                    Log.d(TAG, "Challenge signed successfully")
                    SigningResult.Success(
                        signature = signature,
                        signedMessage = canonicalMessage,
                        challengeInfo = (validationResult as ValidationResult.Valid).info
                    )
                },
                onFailure = { error ->
                    Log.e(TAG, "Signing failed", error)
                    SigningResult.Failure(error.message ?: "Signing failed")
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Challenge signing error", e)
            SigningResult.Failure(e.message ?: "Unknown error")
        }
    }

    data class ChallengeInfo(
        val sessionId: String,
        val nonce: String,
        val origin: String,
        val expiresAt: Long
    )

    sealed class ValidationResult {
        data class Valid(val info: ChallengeInfo) : ValidationResult()
        data class Invalid(val reason: String) : ValidationResult()
        object Expired : ValidationResult()
    }

    sealed class SigningResult {
        data class Success(
            val signature: String,
            val signedMessage: String,
            val challengeInfo: ChallengeInfo
        ) : SigningResult()
        
        data class Failure(val reason: String) : SigningResult()
    }
}
