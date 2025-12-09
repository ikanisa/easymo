package rw.ibimina.staff.plugins

import android.app.NotificationManager
import android.content.Context
import com.getcapacitor.Bridge
import com.getcapacitor.PluginCall
import io.mockk.*
import org.junit.After
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for EnhancedNotificationsPlugin
 * 
 * Tests core functionality including:
 * - Showing notifications with valid/invalid data
 * - Canceling notifications
 * - Permission checks
 */
class EnhancedNotificationsPluginTest {
    
    private lateinit var plugin: EnhancedNotificationsPlugin
    private lateinit var mockContext: Context
    private lateinit var mockBridge: Bridge
    private lateinit var mockNotificationManager: NotificationManager
    private lateinit var mockCall: PluginCall
    
    @Before
    fun setup() {
        mockContext = mockk(relaxed = true)
        mockBridge = mockk(relaxed = true)
        mockNotificationManager = mockk(relaxed = true)
        mockCall = mockk(relaxed = true)
        
        every { mockContext.getSystemService(Context.NOTIFICATION_SERVICE) } returns mockNotificationManager
        
        plugin = EnhancedNotificationsPlugin()
        every { plugin.context } returns mockContext
        every { plugin.bridge } returns mockBridge
    }
    
    @After
    fun teardown() {
        unmockkAll()
    }
    
    @Test
    fun testShowNotification_withValidData_succeeds() {
        // Arrange
        val title = "Test Notification"
        val body = "Test body content"
        
        every { mockCall.getString("title") } returns title
        every { mockCall.getString("body") } returns body
        every { mockCall.getString("channelId") } returns "default"
        every { mockCall.getInt("id") } returns 123
        every { mockCall.getString("groupKey") } returns null
        every { mockCall.getInt("priority") } returns 0
        every { mockCall.getArray("actions") } returns null
        
        // Act
        plugin.showNotification(mockCall)
        
        // Assert
        verify { mockCall.resolve(any()) }
        verify(exactly = 0) { mockCall.reject(any()) }
    }
    
    @Test
    fun testShowNotification_withMissingTitle_fails() {
        // Arrange
        every { mockCall.getString("title") } returns null
        every { mockCall.getString("body") } returns "Test body"
        
        // Act
        plugin.showNotification(mockCall)
        
        // Assert
        verify { mockCall.reject("title and body are required") }
        verify(exactly = 0) { mockCall.resolve(any()) }
    }
    
    @Test
    fun testShowNotification_withMissingBody_fails() {
        // Arrange
        every { mockCall.getString("title") } returns "Test title"
        every { mockCall.getString("body") } returns null
        
        // Act
        plugin.showNotification(mockCall)
        
        // Assert
        verify { mockCall.reject("title and body are required") }
        verify(exactly = 0) { mockCall.resolve(any()) }
    }
    
    @Test
    fun testCancelNotification_withValidId_succeeds() {
        // Arrange
        val notificationId = 123
        every { mockCall.getInt("id") } returns notificationId
        
        // Act
        plugin.cancelNotification(mockCall)
        
        // Assert
        verify { mockNotificationManager.cancel(notificationId) }
        verify { mockCall.resolve(any()) }
    }
    
    @Test
    fun testCancelNotification_withMissingId_fails() {
        // Arrange
        every { mockCall.getInt("id") } returns null
        
        // Act
        plugin.cancelNotification(mockCall)
        
        // Assert
        verify { mockCall.reject("id is required") }
        verify(exactly = 0) { mockNotificationManager.cancel(any()) }
    }
    
    @Test
    fun testCancelAllNotifications_succeeds() {
        // Act
        plugin.cancelAllNotifications(mockCall)
        
        // Assert
        verify { mockNotificationManager.cancelAll() }
        verify { mockCall.resolve(any()) }
    }
    
    @Test
    fun testCheckPermissions_returnsGrantedStatus() {
        // Arrange
        every { mockNotificationManager.areNotificationsEnabled() } returns true
        
        // Act
        plugin.checkPermissions(mockCall)
        
        // Assert
        verify { 
            mockCall.resolve(match { result ->
                result.getBoolean("granted") == true
            })
        }
    }
}
