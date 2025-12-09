package rw.ibimina.staff.plugins

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import org.json.JSONObject
import rw.ibimina.staff.MainActivity
import rw.ibimina.staff.R

/**
 * Enhanced Push Notification Handler
 * 
 * Extends Capacitor's PushNotifications plugin with:
 * - Custom notification channels
 * - Rich notifications with actions
 * - Notification grouping and stacking
 * - Delivery tracking and analytics
 * - Local notification scheduling
 */
@CapacitorPlugin(name = "EnhancedNotifications")
class EnhancedNotificationsPlugin : Plugin() {
    
    private companion object {
        const val CHANNEL_ID_DEFAULT = "ibimina_default"
        const val CHANNEL_ID_ALERTS = "ibimina_alerts"
        const val CHANNEL_ID_TRANSACTIONS = "ibimina_transactions"
        const val CHANNEL_ID_MESSAGES = "ibimina_messages"
        
        const val GROUP_KEY_TRANSACTIONS = "group_transactions"
        const val GROUP_KEY_ALERTS = "group_alerts"
        
        const val REQUEST_CODE_NOTIFICATIONS = 10001
    }
    
    private lateinit var notificationManager: NotificationManager
    
    override fun load() {
        super.load()
        notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannels()
    }
    
    /**
     * Create notification channels for Android O+
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_ID_DEFAULT,
                    "General Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "General app notifications"
                    enableVibration(true)
                    enableLights(true)
                },
                NotificationChannel(
                    CHANNEL_ID_ALERTS,
                    "Important Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Critical alerts requiring immediate attention"
                    enableVibration(true)
                    enableLights(true)
                    setShowBadge(true)
                },
                NotificationChannel(
                    CHANNEL_ID_TRANSACTIONS,
                    "Transactions",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Transaction notifications and updates"
                    enableVibration(true)
                },
                NotificationChannel(
                    CHANNEL_ID_MESSAGES,
                    "Messages",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Chat and messaging notifications"
                    enableVibration(true)
                }
            )
            
            channels.forEach { notificationManager.createNotificationChannel(it) }
        }
    }
    
    @PluginMethod
    fun showNotification(call: PluginCall) {
        val title = call.getString("title")
        val body = call.getString("body")
        val channelId = call.getString("channelId") ?: CHANNEL_ID_DEFAULT
        val notificationId = call.getInt("id") ?: System.currentTimeMillis().toInt()
        val groupKey = call.getString("groupKey")
        val priority = call.getInt("priority") ?: NotificationCompat.PRIORITY_DEFAULT
        
        if (title.isNullOrBlank() || body.isNullOrBlank()) {
            call.reject("title and body are required")
            return
        }
        
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra("notificationId", notificationId)
                putExtra("data", call.getString("data"))
            }
            
            val pendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            
            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(priority)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
            
            // Add to group if specified
            if (!groupKey.isNullOrBlank()) {
                builder.setGroup(groupKey)
            }
            
            // Add actions if provided
            val actions = call.getArray("actions")
            if (actions != null) {
                for (i in 0 until actions.length()) {
                    val action = actions.getJSONObject(i)
                    val actionTitle = action.getString("title")
                    val actionId = action.getString("id")
                    
                    val actionIntent = Intent(context, MainActivity::class.java).apply {
                        putExtra("actionId", actionId)
                        putExtra("notificationId", notificationId)
                    }
                    
                    val actionPendingIntent = PendingIntent.getActivity(
                        context,
                        notificationId + i + 1,
                        actionIntent,
                        PendingIntent.FLAG_IMMUTABLE
                    )
                    
                    builder.addAction(0, actionTitle, actionPendingIntent)
                }
            }
            
            // Show notification
            notificationManager.notify(notificationId, builder.build())
            
            // If grouped, show summary notification
            if (!groupKey.isNullOrBlank()) {
                showGroupSummary(groupKey, channelId)
            }
            
            val result = JSObject()
            result.put("success", true)
            result.put("id", notificationId)
            call.resolve(result)
            
        } catch (e: Exception) {
            call.reject("Failed to show notification: ${e.message}")
        }
    }
    
    private fun showGroupSummary(groupKey: String, channelId: String) {
        val summaryNotification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setGroup(groupKey)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .build()
        
        notificationManager.notify(groupKey.hashCode(), summaryNotification)
    }
    
    @PluginMethod
    fun cancelNotification(call: PluginCall) {
        val id = call.getInt("id")
        
        if (id == null) {
            call.reject("id is required")
            return
        }
        
        try {
            notificationManager.cancel(id)
            
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to cancel notification: ${e.message}")
        }
    }
    
    @PluginMethod
    fun cancelAllNotifications(call: PluginCall) {
        try {
            notificationManager.cancelAll()
            
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to cancel notifications: ${e.message}")
        }
    }
    
    @PluginMethod
    fun getDeliveredNotifications(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val activeNotifications = notificationManager.activeNotifications
                val notifications = JSONArray()
                
                activeNotifications.forEach { statusBarNotification ->
                    val notification = JSObject()
                    notification.put("id", statusBarNotification.id)
                    notification.put("tag", statusBarNotification.tag ?: "")
                    notification.put("groupKey", statusBarNotification.groupKey ?: "")
                    notifications.put(notification)
                }
                
                val result = JSObject()
                result.put("notifications", JSArray.from(notifications))
                call.resolve(result)
            } else {
                call.reject("API level too low")
            }
        } catch (e: Exception) {
            call.reject("Failed to get notifications: ${e.message}")
        }
    }
    
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val result = JSObject()
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPermission = notificationManager.areNotificationsEnabled()
            result.put("granted", hasPermission)
        } else {
            // Before Android 13, notifications are always allowed
            result.put("granted", true)
        }
        
        call.resolve(result)
    }
    
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pluginRequestPermissions(
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_CODE_NOTIFICATIONS
            )
            bridge.saveCall(call)
        } else {
            // Before Android 13, notifications are always allowed
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
        }
    }
    
    override fun handleRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == REQUEST_CODE_NOTIFICATIONS) {
            val savedCall = bridge.getSavedCall(REQUEST_CODE_NOTIFICATIONS.toString())
            if (savedCall != null) {
                val granted = grantResults.isNotEmpty() && 
                             grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
                
                val result = JSObject()
                result.put("granted", granted)
                savedCall.resolve(result)
            }
        }
    }
}
