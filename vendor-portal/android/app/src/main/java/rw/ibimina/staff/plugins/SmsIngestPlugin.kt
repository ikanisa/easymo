package rw.ibimina.staff.plugins

import android.Manifest
import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import androidx.work.*
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Capacitor plugin for REAL-TIME SMS ingestion from mobile money providers.
 * 
 * This plugin provides:
 * 1. REAL-TIME PROCESSING: BroadcastReceiver intercepts SMS immediately on arrival
 * 2. FALLBACK SYNC: Hourly background sync catches any missed messages
 * 3. PERMISSION MANAGEMENT: Requests READ_SMS and RECEIVE_SMS permissions
 * 4. MANUAL QUERY: Allows querying SMS inbox on demand
 * 
 * Real-time Flow:
 * - SMS arrives → BroadcastReceiver triggered instantly
 * - Filters for whitelisted senders (MTN, Airtel)
 * - Sends to backend via HTTPS for OpenAI parsing
 * - Member gets instant payment approval notification
 * 
 * Security & Privacy:
 * - Only reads SMS from pre-approved mobile money senders (MTN, Airtel)
 * - Requires explicit user consent before activation
 * - Can be disabled via settings toggle
 * - Does not store SMS data on device (forwards to secure backend)
 * - HMAC authentication for all backend requests
 */
@CapacitorPlugin(name = "SmsIngest")
class SmsIngestPlugin : Plugin() {

    companion object {
        private const val SMS_PERMISSION_REQUEST_CODE = 9001
        private const val PREF_NAME = "SmsIngestPreferences"
        private const val PREF_ENABLED = "sms_ingest_enabled"
        private const val PREF_LAST_SYNC_TIME = "last_sync_timestamp"
        private const val WORK_TAG = "sms_sync_work"
        
        // Whitelisted sender addresses for mobile money providers
        private val ALLOWED_SENDERS = setOf(
            "MTN",
            "AIRTEL",
            "250788383383", // MTN MoMo number
            "250733333333"  // Airtel Money number
        )
    }

    private val prefs by lazy {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Check if SMS permissions are granted
     */
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val hasReadSms = hasPermission(Manifest.permission.READ_SMS)
        val hasReceiveSms = hasPermission(Manifest.permission.RECEIVE_SMS)
        
        val result = JSObject()
        result.put("readSms", if (hasReadSms) "granted" else "denied")
        result.put("receiveSms", if (hasReceiveSms) "granted" else "denied")
        result.put("state", if (hasReadSms && hasReceiveSms) "granted" else "prompt")
        
        call.resolve(result)
    }

    /**
     * Request SMS permissions from user
     */
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (hasPermission(Manifest.permission.READ_SMS) && 
            hasPermission(Manifest.permission.RECEIVE_SMS)) {
            val result = JSObject()
            result.put("state", "granted")
            call.resolve(result)
            return
        }

        requestPermissionForAliases(
            arrayOf("readSms", "receiveSms"),
            call,
            "permissionsCallback"
        )
    }

    /**
     * Callback for permission request result
     */
    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        val hasReadSms = hasPermission(Manifest.permission.READ_SMS)
        val hasReceiveSms = hasPermission(Manifest.permission.RECEIVE_SMS)
        
        val result = JSObject()
        result.put("state", if (hasReadSms && hasReceiveSms) "granted" else "denied")
        call.resolve(result)
    }

    /**
     * Check if SMS ingestion is enabled
     */
    @PluginMethod
    fun isEnabled(call: PluginCall) {
        val enabled = prefs.getBoolean(PREF_ENABLED, false)
        val result = JSObject()
        result.put("enabled", enabled)
        call.resolve(result)
    }

    /**
     * Enable SMS ingestion with real-time processing
     * Real-time: SMS BroadcastReceiver processes messages instantly
     * Background sync: Runs hourly as fallback for missed messages
     */
    @PluginMethod
    fun enable(call: PluginCall) {
        if (!hasPermission(Manifest.permission.READ_SMS)) {
            call.reject("SMS permissions not granted")
            return
        }

        prefs.edit().putBoolean(PREF_ENABLED, true).apply()
        
        // Schedule hourly fallback sync (catches any missed messages)
        scheduleBackgroundSync()
        
        val result = JSObject()
        result.put("enabled", true)
        result.put("realtime", true)
        call.resolve(result)
    }

    /**
     * Disable SMS ingestion and cancel background sync
     */
    @PluginMethod
    fun disable(call: PluginCall) {
        prefs.edit().putBoolean(PREF_ENABLED, false).apply()
        cancelBackgroundSync()
        
        val result = JSObject()
        result.put("enabled", false)
        call.resolve(result)
    }

    /**
     * Query SMS inbox for messages from whitelisted senders
     */
    @PluginMethod
    fun querySmsInbox(call: PluginCall) {
        if (!hasPermission(Manifest.permission.READ_SMS)) {
            call.reject("READ_SMS permission not granted")
            return
        }

        val limit = call.getInt("limit") ?: 50
        val sinceTimestamp = call.getLong("since") ?: getLastSyncTime()
        
        val messages = readSmsMessages(limit, sinceTimestamp)
        
        val result = JSObject()
        result.put("messages", messages)
        result.put("count", messages.length())
        call.resolve(result)
    }

    /**
     * Update last sync timestamp
     */
    @PluginMethod
    fun updateLastSyncTime(call: PluginCall) {
        val timestamp = call.getLong("timestamp") ?: System.currentTimeMillis()
        prefs.edit().putLong(PREF_LAST_SYNC_TIME, timestamp).apply()
        
        val result = JSObject()
        result.put("success", true)
        result.put("timestamp", timestamp)
        call.resolve(result)
    }

    /**
     * Configure edge function endpoint for SMS processing
     */
    @PluginMethod
    fun configure(call: PluginCall) {
        val edgeFunctionUrl = call.getString("edgeFunctionUrl")
        val hmacSecret = call.getString("hmacSecret")
        
        val editor = prefs.edit()
        
        if (edgeFunctionUrl != null) {
            editor.putString("edge_function_url", edgeFunctionUrl)
        }
        
        if (hmacSecret != null) {
            editor.putString("hmac_secret", hmacSecret)
        }
        
        editor.apply()
        
        val result = JSObject()
        result.put("configured", true)
        call.resolve(result)
    }

    /**
     * Schedule periodic background sync using WorkManager
     * This is a fallback for missed messages - real-time processing happens via BroadcastReceiver
     */
    @PluginMethod
    fun scheduleBackgroundSync(call: PluginCall? = null) {
        val intervalMinutes = call?.getInt("intervalMinutes", 60) ?: 60
        
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SmsSyncWorker>(
            intervalMinutes.toLong(),
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .addTag(WORK_TAG)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_TAG,
            ExistingPeriodicWorkPolicy.REPLACE,
            syncRequest
        )

        call?.resolve(JSObject().put("scheduled", true))
    }

    /**
     * Cancel background sync
     */
    private fun cancelBackgroundSync() {
        WorkManager.getInstance(context).cancelAllWorkByTag(WORK_TAG)
    }

    /**
     * Read SMS messages from inbox
     */
    private fun readSmsMessages(limit: Int, sinceTimestamp: Long): JSONArray {
        val messages = JSONArray()
        val resolver: ContentResolver = context.contentResolver
        
        // Query SMS inbox
        val uri: Uri = Telephony.Sms.CONTENT_URI
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE
        )
        
        val selection = "${Telephony.Sms.DATE} > ? AND ${Telephony.Sms.TYPE} = ?"
        val selectionArgs = arrayOf(
            sinceTimestamp.toString(),
            Telephony.Sms.MESSAGE_TYPE_INBOX.toString()
        )
        val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT $limit"

        var cursor: Cursor? = null
        try {
            cursor = resolver.query(uri, projection, selection, selectionArgs, sortOrder)
            
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID))
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                    val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY))
                    val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
                    
                    // Filter: only include messages from whitelisted senders
                    if (isAllowedSender(address)) {
                        val message = JSONObject()
                        message.put("id", id)
                        message.put("address", address)
                        message.put("body", body)
                        message.put("timestamp", date)
                        message.put("received_at", android.text.format.DateFormat.format(
                            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                            date
                        ).toString())
                        
                        messages.put(message)
                    }
                } while (cursor.moveToNext())
            }
        } catch (e: Exception) {
            android.util.Log.e("SmsIngestPlugin", "Error reading SMS: ${e.message}", e)
        } finally {
            cursor?.close()
        }
        
        return messages
    }

    /**
     * Check if sender is in whitelist
     */
    private fun isAllowedSender(address: String?): Boolean {
        if (address.isNullOrEmpty()) return false
        
        // Check if address matches any whitelisted sender
        return ALLOWED_SENDERS.any { allowed ->
            address.contains(allowed, ignoreCase = true)
        }
    }

    /**
     * Get last sync timestamp from preferences
     */
    private fun getLastSyncTime(): Long {
        return prefs.getLong(PREF_LAST_SYNC_TIME, 0L)
    }

    /**
     * Check if a permission is granted
     */
    override fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        // Cleanup if needed
    }
}
