package rw.ibimina.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import rw.ibimina.staff.plugins.DeviceAuthPlugin;
import rw.ibimina.staff.plugins.SmsIngestPlugin;
import rw.ibimina.staff.plugins.EnhancedNotificationsPlugin;
import rw.ibimina.staff.plugins.NetworkMonitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(DeviceAuthPlugin.class);
        registerPlugin(SmsIngestPlugin.class);
        registerPlugin(EnhancedNotificationsPlugin.class);
        registerPlugin(NetworkMonitorPlugin.class);
    }
}
