package rw.ibimina.staff.plugins

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.getcapacitor.Bridge
import com.getcapacitor.PluginCall
import io.mockk.*
import org.junit.After
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for NetworkMonitorPlugin
 * 
 * Tests core functionality including:
 * - Getting network status
 * - Starting/stopping monitoring
 * - Network type detection
 */
class NetworkMonitorPluginTest {
    
    private lateinit var plugin: NetworkMonitorPlugin
    private lateinit var mockContext: Context
    private lateinit var mockBridge: Bridge
    private lateinit var mockConnectivityManager: ConnectivityManager
    private lateinit var mockCall: PluginCall
    
    @Before
    fun setup() {
        mockContext = mockk(relaxed = true)
        mockBridge = mockk(relaxed = true)
        mockConnectivityManager = mockk(relaxed = true)
        mockCall = mockk(relaxed = true)
        
        every { mockContext.getSystemService(Context.CONNECTIVITY_SERVICE) } returns mockConnectivityManager
        
        plugin = NetworkMonitorPlugin()
        every { plugin.context } returns mockContext
        every { plugin.bridge } returns mockBridge
    }
    
    @After
    fun teardown() {
        unmockkAll()
    }
    
    @Test
    fun testGetStatus_withActiveNetwork_returnsConnected() {
        // Arrange
        val mockNetwork = mockk<android.net.Network>()
        val mockCapabilities = mockk<NetworkCapabilities>(relaxed = true)
        
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockCapabilities
        every { mockCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) } returns true
        every { mockCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) } returns true
        every { mockCapabilities.linkDownstreamBandwidthKbps } returns 50000
        every { mockCapabilities.linkUpstreamBandwidthKbps } returns 10000
        
        // Act
        plugin.getStatus(mockCall)
        
        // Assert
        verify { 
            mockCall.resolve(match { result ->
                result.getBoolean("connected") == true &&
                result.getString("connectionType") == "wifi"
            })
        }
    }
    
    @Test
    fun testGetStatus_withNoActiveNetwork_returnsDisconnected() {
        // Arrange
        every { mockConnectivityManager.activeNetwork } returns null
        
        // Act
        plugin.getStatus(mockCall)
        
        // Assert
        verify { 
            mockCall.resolve(match { result ->
                result.getBoolean("connected") == false &&
                result.getString("connectionType") == "none"
            })
        }
    }
    
    @Test
    fun testStartMonitoring_succeeds() {
        // Act
        plugin.startMonitoring(mockCall)
        
        // Assert
        verify { mockCall.resolve(match { it.getBoolean("success") == true }) }
    }
    
    @Test
    fun testStartMonitoring_whenAlreadyMonitoring_fails() {
        // Arrange - Start monitoring first time
        plugin.startMonitoring(mockCall)
        
        // Act - Try to start again
        val secondCall = mockk<PluginCall>(relaxed = true)
        plugin.startMonitoring(secondCall)
        
        // Assert
        verify { secondCall.reject("Already monitoring") }
    }
    
    @Test
    fun testStopMonitoring_succeeds() {
        // Arrange - Start monitoring first
        plugin.startMonitoring(mockCall)
        
        // Act
        val stopCall = mockk<PluginCall>(relaxed = true)
        plugin.stopMonitoring(stopCall)
        
        // Assert
        verify { stopCall.resolve(match { it.getBoolean("success") == true }) }
    }
}
