package rw.ibimina.staff.plugins

import android.content.Context
import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Background worker for syncing SMS messages to Supabase backend.
 * 
 * This worker:
 * - Runs periodically (configurable interval, default 15 minutes)
 * - Queries SMS inbox for new messages since last sync
 * - Filters for mobile money provider senders only
 * - Posts messages to Supabase Edge Function for parsing and allocation
 * - Updates last sync timestamp on success
 * 
 * Privacy & Security:
 * - Only processes messages from whitelisted senders
 * - Uses HMAC authentication for API requests
 * - Does not cache SMS data locally
 */
class SmsSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    companion object {
        private const val TAG = "SmsSyncWorker"
        private const val PREF_NAME = "SmsIngestPreferences"
        private const val PREF_ENABLED = "sms_ingest_enabled"
        private const val PREF_LAST_SYNC_TIME = "last_sync_timestamp"
        private const val PREF_EDGE_FUNCTION_URL = "edge_function_url"
        private const val PREF_HMAC_SECRET = "hmac_secret"
        
        // Whitelisted sender addresses
        private val ALLOWED_SENDERS = setOf(
            "MTN",
            "AIRTEL",
            "250788383383",
            "250733333333"
        )
    }

    private val prefs by lazy {
        applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    override fun doWork(): Result {
        Log.d(TAG, "SmsSyncWorker started")

        // Check if SMS ingestion is enabled
        if (!prefs.getBoolean(PREF_ENABLED, false)) {
            Log.d(TAG, "SMS ingestion is disabled, skipping sync")
            return Result.success()
        }

        try {
            // Get last sync timestamp
            val lastSyncTime = prefs.getLong(PREF_LAST_SYNC_TIME, 0L)
            Log.d(TAG, "Last sync time: $lastSyncTime")

            // Read new SMS messages
            val messages = readSmsMessages(lastSyncTime)
            
            if (messages.length() == 0) {
                Log.d(TAG, "No new messages to sync")
                return Result.success()
            }

            Log.d(TAG, "Found ${messages.length()} new messages")

            // Send messages to backend
            val success = sendMessagesToBackend(messages)

            return if (success) {
                // Update last sync timestamp
                val currentTime = System.currentTimeMillis()
                prefs.edit().putLong(PREF_LAST_SYNC_TIME, currentTime).apply()
                Log.d(TAG, "Sync completed successfully")
                Result.success()
            } else {
                Log.w(TAG, "Sync failed, will retry")
                Result.retry()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error during sync", e)
            return Result.failure()
        }
    }

    /**
     * Read SMS messages from inbox since last sync
     */
    private fun readSmsMessages(sinceTimestamp: Long): JSONArray {
        val messages = JSONArray()
        val resolver: ContentResolver = applicationContext.contentResolver
        
        val uri: Uri = Telephony.Sms.CONTENT_URI
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE
        )
        
        val selection = "${Telephony.Sms.DATE} > ? AND ${Telephony.Sms.TYPE} = ?"
        val selectionArgs = arrayOf(
            sinceTimestamp.toString(),
            Telephony.Sms.MESSAGE_TYPE_INBOX.toString()
        )
        val sortOrder = "${Telephony.Sms.DATE} ASC LIMIT 100"

        var cursor: Cursor? = null
        try {
            cursor = resolver.query(uri, projection, selection, selectionArgs, sortOrder)
            
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                    
                    // Filter: only include whitelisted senders
                    if (isAllowedSender(address)) {
                        val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY))
                        val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
                        
                        val message = JSONObject()
                        message.put("address", address)
                        message.put("body", body)
                        message.put("timestamp", date)
                        message.put("receivedAt", android.text.format.DateFormat.format(
                            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                            date
                        ).toString())
                        
                        messages.put(message)
                    }
                } while (cursor.moveToNext())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SMS", e)
        } finally {
            cursor?.close()
        }
        
        return messages
    }

    /**
     * Send messages to Supabase Edge Function
     */
    private fun sendMessagesToBackend(messages: JSONArray): Boolean {
        val edgeFunctionUrl = prefs.getString(PREF_EDGE_FUNCTION_URL, null)
        
        if (edgeFunctionUrl.isNullOrEmpty()) {
            Log.w(TAG, "Edge function URL not configured")
            return false
        }

        return try {
            val url = URL(edgeFunctionUrl)
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            
            // Add HMAC authentication if configured
            val hmacSecret = prefs.getString(PREF_HMAC_SECRET, null)
            if (!hmacSecret.isNullOrEmpty()) {
                val timestamp = System.currentTimeMillis().toString()
                val signature = generateHmacSignature(messages.toString(), timestamp, hmacSecret)
                connection.setRequestProperty("X-Signature", signature)
                connection.setRequestProperty("X-Timestamp", timestamp)
            }
            
            connection.doOutput = true
            connection.connectTimeout = 30000
            connection.readTimeout = 30000

            // Send request
            val payload = JSONObject()
            payload.put("messages", messages)
            payload.put("deviceId", getDeviceId())
            
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(payload.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            Log.d(TAG, "Backend response code: $responseCode")

            // Read response
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                Log.d(TAG, "Backend response: $response")
                true
            } else {
                val error = connection.errorStream?.bufferedReader()?.use { it.readText() }
                Log.e(TAG, "Backend error: $error")
                false
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error sending messages to backend", e)
            false
        }
    }

    /**
     * Generate HMAC signature for request authentication
     */
    private fun generateHmacSignature(body: String, timestamp: String, secret: String): String {
        return try {
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            val secretKey = javax.crypto.spec.SecretKeySpec(secret.toByteArray(), "HmacSHA256")
            mac.init(secretKey)
            val message = "$timestamp:$body"
            val hash = mac.doFinal(message.toByteArray())
            // Convert to hex string
            hash.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Error generating HMAC", e)
            ""
        }
    }

    /**
     * Get unique device identifier
     */
    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            applicationContext.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    /**
     * Check if sender is whitelisted
     */
    private fun isAllowedSender(address: String?): Boolean {
        if (address.isNullOrEmpty()) return false
        return ALLOWED_SENDERS.any { allowed ->
            address.contains(allowed, ignoreCase = true)
        }
    }
}
