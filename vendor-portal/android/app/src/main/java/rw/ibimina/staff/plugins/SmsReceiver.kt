package rw.ibimina.staff.plugins

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
        private const val PREF_NAME = "SmsIngestPreferences"
        private const val PREF_ENABLED = "sms_ingest_enabled"
        private const val PREF_EDGE_FUNCTION_URL = "edge_function_url"
        private const val PREF_HMAC_SECRET = "hmac_secret"
        
        private val ALLOWED_SENDERS = setOf(
            "MTN",
            "AIRTEL",
            "250788383383",
            "250733333333"
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        
        if (!prefs.getBoolean(PREF_ENABLED, false)) {
            Log.d(TAG, "SMS ingestion disabled, ignoring message")
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) {
            return
        }

        Log.d(TAG, "Received ${messages.size} SMS message(s)")

        val messagesToProcess = JSONArray()

        for (smsMessage in messages) {
            val sender = smsMessage.displayOriginatingAddress ?: smsMessage.originatingAddress
            val body = smsMessage.messageBody ?: ""
            val timestamp = smsMessage.timestampMillis

            if (isAllowedSender(sender)) {
                Log.d(TAG, "Processing SMS from whitelisted sender: $sender")
                
                val message = JSONObject()
                message.put("address", sender)
                message.put("body", body)
                message.put("timestamp", timestamp)
                message.put("receivedAt", android.text.format.DateFormat.format(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                    timestamp
                ).toString())
                
                messagesToProcess.put(message)
            } else {
                Log.d(TAG, "Ignoring SMS from non-whitelisted sender: $sender")
            }
        }

        if (messagesToProcess.length() == 0) {
            Log.d(TAG, "No mobile money messages to process")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                sendMessagesToBackend(context, messagesToProcess)
            } catch (e: Exception) {
                Log.e(TAG, "Error processing SMS", e)
            }
        }
    }

    private fun isAllowedSender(address: String?): Boolean {
        if (address.isNullOrEmpty()) return false
        return ALLOWED_SENDERS.any { allowed ->
            address.contains(allowed, ignoreCase = true)
        }
    }

    private fun sendMessagesToBackend(context: Context, messages: JSONArray) {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val edgeFunctionUrl = prefs.getString(PREF_EDGE_FUNCTION_URL, null)
        
        if (edgeFunctionUrl.isNullOrEmpty()) {
            Log.w(TAG, "Edge function URL not configured")
            return
        }

        try {
            val url = URL(edgeFunctionUrl)
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            
            val hmacSecret = prefs.getString(PREF_HMAC_SECRET, null)
            if (!hmacSecret.isNullOrEmpty()) {
                val timestamp = System.currentTimeMillis().toString()
                val signature = generateHmacSignature(messages.toString(), timestamp, hmacSecret)
                connection.setRequestProperty("X-Signature", signature)
                connection.setRequestProperty("X-Timestamp", timestamp)
            }
            
            connection.doOutput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            val payload = JSONObject()
            payload.put("messages", messages)
            payload.put("deviceId", getDeviceId(context))
            payload.put("realtime", true)
            
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(payload.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                Log.d(TAG, "Real-time SMS processed successfully: $response")
                
                notifySuccess(context, messages.length())
            } else {
                val error = connection.errorStream?.bufferedReader()?.use { it.readText() }
                Log.e(TAG, "Backend error (HTTP $responseCode): $error")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error sending SMS to backend", e)
        }
    }

    private fun generateHmacSignature(body: String, timestamp: String, secret: String): String {
        return try {
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            val secretKey = javax.crypto.spec.SecretKeySpec(secret.toByteArray(), "HmacSHA256")
            mac.init(secretKey)
            val message = "$timestamp:$body"
            val hash = mac.doFinal(message.toByteArray())
            hash.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Error generating HMAC", e)
            ""
        }
    }

    private fun getDeviceId(context: Context): String {
        return android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    private fun notifySuccess(context: Context, count: Int) {
        try {
            val notificationIntent = Intent("rw.ibimina.staff.SMS_PROCESSED")
            notificationIntent.putExtra("count", count)
            notificationIntent.putExtra("timestamp", System.currentTimeMillis())
            context.sendBroadcast(notificationIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending notification broadcast", e)
        }
    }
}
