package rw.ibimina.staff.plugins

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * Network Monitoring Plugin
 * 
 * Provides real-time network connectivity monitoring with:
 * - Connection type detection (WiFi, Cellular, Ethernet)
 * - Connection quality estimation
 * - Network change notifications
 * - Offline/online state management
 */
@CapacitorPlugin(name = "NetworkMonitor")
class NetworkMonitorPlugin : Plugin() {
    
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    
    override fun load() {
        super.load()
        connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }
    
    @PluginMethod
    fun getStatus(call: PluginCall) {
        try {
            val status = getCurrentNetworkStatus()
            call.resolve(status)
        } catch (e: Exception) {
            call.reject("Failed to get network status: ${e.message}")
        }
    }
    
    @PluginMethod
    fun startMonitoring(call: PluginCall) {
        try {
            if (networkCallback != null) {
                call.reject("Already monitoring")
                return
            }
            
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    notifyListeners("networkStatusChange", getNetworkInfo(network, true))
                }
                
                override fun onLost(network: Network) {
                    notifyListeners("networkStatusChange", JSObject().apply {
                        put("connected", false)
                        put("connectionType", "none")
                    })
                }
                
                override fun onCapabilitiesChanged(
                    network: Network,
                    networkCapabilities: NetworkCapabilities
                ) {
                    notifyListeners("networkStatusChange", getNetworkInfo(network, true, networkCapabilities))
                }
            }
            
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            
            connectivityManager.registerNetworkCallback(request, networkCallback!!)
            
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to start monitoring: ${e.message}")
        }
    }
    
    @PluginMethod
    fun stopMonitoring(call: PluginCall) {
        try {
            networkCallback?.let {
                connectivityManager.unregisterNetworkCallback(it)
                networkCallback = null
            }
            
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to stop monitoring: ${e.message}")
        }
    }
    
    private fun getCurrentNetworkStatus(): JSObject {
        val activeNetwork = connectivityManager.activeNetwork
        return if (activeNetwork != null) {
            getNetworkInfo(activeNetwork, true)
        } else {
            JSObject().apply {
                put("connected", false)
                put("connectionType", "none")
            }
        }
    }
    
    private fun getNetworkInfo(
        network: Network,
        connected: Boolean,
        capabilities: NetworkCapabilities? = null
    ): JSObject {
        val caps = capabilities ?: connectivityManager.getNetworkCapabilities(network)
        
        return JSObject().apply {
            put("connected", connected)
            put("connectionType", getConnectionType(caps))
            put("isMetered", isMeteredConnection(caps))
            put("linkDownstreamBandwidthKbps", caps?.linkDownstreamBandwidthKbps ?: 0)
            put("linkUpstreamBandwidthKbps", caps?.linkUpstreamBandwidthKbps ?: 0)
        }
    }
    
    private fun getConnectionType(capabilities: NetworkCapabilities?): String {
        if (capabilities == null) return "unknown"
        
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "bluetooth"
            else -> "unknown"
        }
    }
    
    private fun isMeteredConnection(capabilities: NetworkCapabilities?): Boolean {
        if (capabilities == null) return true
        return !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
    
    override fun handleOnDestroy() {
        networkCallback?.let {
            try {
                connectivityManager.unregisterNetworkCallback(it)
            } catch (e: Exception) {
                // Ignore
            }
        }
        super.handleOnDestroy()
    }
}
