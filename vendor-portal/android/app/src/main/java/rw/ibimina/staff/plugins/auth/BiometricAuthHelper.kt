package rw.ibimina.staff.plugins.auth

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricAuthHelper(private val context: Context) {

    companion object {
        private const val TAG = "BiometricAuthHelper"
    }

    fun checkBiometricAvailable(): BiometricStatus {
        val biometricManager = BiometricManager.from(context)
        
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                BiometricStatus(
                    available = true,
                    message = "Biometric authentication is available"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                BiometricStatus(
                    available = false,
                    message = "No biometric hardware available on this device"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                BiometricStatus(
                    available = false,
                    message = "Biometric hardware is currently unavailable"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                BiometricStatus(
                    available = false,
                    message = "No biometric credentials enrolled. Please add a fingerprint or face in device settings."
                )
            }
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                BiometricStatus(
                    available = false,
                    message = "Security update required for biometric authentication"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> {
                BiometricStatus(
                    available = false,
                    message = "Biometric authentication is not supported"
                )
            }
            BiometricManager.BIOMETRIC_STATUS_UNKNOWN -> {
                BiometricStatus(
                    available = false,
                    message = "Biometric status unknown"
                )
            }
            else -> {
                BiometricStatus(
                    available = false,
                    message = "Biometric authentication check failed"
                )
            }
        }
    }

    fun authenticateWithBiometric(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        description: String,
        onSuccess: () -> Unit,
        onError: (errorCode: Int, errorMessage: String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(context)
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setDescription(description)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("Cancel")
            .setConfirmationRequired(true)
            .build()

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.w(TAG, "Biometric authentication error: $errorCode - $errString")
                    onError(errorCode, errString.toString())
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Log.d(TAG, "Biometric authentication succeeded")
                    onSuccess()
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "Biometric authentication failed (not recognized)")
                    onFailed()
                }
            }
        )

        biometricPrompt.authenticate(promptInfo)
    }

    fun authenticateForSigning(
        activity: FragmentActivity,
        origin: String,
        onSuccess: () -> Unit,
        onError: (errorCode: Int, errorMessage: String) -> Unit,
        onFailed: () -> Unit
    ) {
        authenticateWithBiometric(
            activity = activity,
            title = "Verify Login",
            subtitle = "Authenticate to sign in",
            description = "Signing challenge from:\n$origin",
            onSuccess = onSuccess,
            onError = onError,
            onFailed = onFailed
        )
    }

    fun authenticateForEnrollment(
        activity: FragmentActivity,
        onSuccess: () -> Unit,
        onError: (errorCode: Int, errorMessage: String) -> Unit,
        onFailed: () -> Unit
    ) {
        authenticateWithBiometric(
            activity = activity,
            title = "Enroll Device",
            subtitle = "Verify your identity",
            description = "Authenticate to enroll this device for secure login",
            onSuccess = onSuccess,
            onError = onError,
            onFailed = onFailed
        )
    }

    data class BiometricStatus(
        val available: Boolean,
        val message: String
    )
}
