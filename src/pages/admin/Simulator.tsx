import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Smartphone, MapPin, RotateCcw } from "lucide-react";
import { ADAPTER } from "@/lib/adapter";
import { 
  PRESET_LOCATIONS, 
  VEHICLE_OPTIONS, 
  INITIAL_FLOW_DATA,
  resetFlow,
  startSeeDrivers,
  startSeePassengers,
  startScheduleTrip,
  startSupport,
  selectVehicle,
  selectLocation,
  selectRole,
  showDriverCTA,
  buildSupportChatLink,
  buildMoMoLink,
  type FlowData
} from "@/lib/waSimFlows";
import { showDevTools } from "@/lib/env";

export default function Simulator() {
  const [flowData, setFlowData] = useState<FlowData>(INITIAL_FLOW_DATA);
  const [hasAccess, setHasAccess] = useState(false);

  const updateFlow = (newData: FlowData) => setFlowData(newData);
  const reset = () => setFlowData(resetFlow());

  const renderHomeButtons = () => (
    <div className="space-y-3">
      <Button className="w-full justify-start" variant="outline" onClick={() => updateFlow(startSeeDrivers(flowData))}>
        See Nearby Drivers
      </Button>
      <Button className="w-full justify-start" variant="outline" onClick={() => updateFlow(startSeePassengers(flowData))}>
        See Nearby Passengers  
      </Button>
      <Button className="w-full justify-start" variant="outline" onClick={() => updateFlow(startScheduleTrip(flowData))}>
        Schedule Trip
      </Button>
      <Button className="w-full justify-start" variant="outline" onClick={() => updateFlow(startSupport(flowData))}>
        Support
      </Button>
    </div>
  );

  const renderVehicleSelection = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select vehicle type:</p>
      {VEHICLE_OPTIONS.map(({ type, label }) => (
        <Button key={type} className="w-full justify-start" variant="outline" 
          onClick={() => updateFlow(selectVehicle(flowData, type))}>
          {label}
        </Button>
      ))}
    </div>
  );

  const renderLocationSelection = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Share your location:</p>
      {PRESET_LOCATIONS.map((location) => (
        <Button key={location.name} className="w-full justify-start" variant="outline"
          onClick={() => updateFlow(selectLocation(flowData, location))}>
          <MapPin className="h-4 w-4 mr-2" />
          {location.name}
        </Button>
      ))}
    </div>
  );

  const renderCurrentFlow = () => {
    switch (flowData.state) {
      case 'home':
        return renderHomeButtons();
      case 'see_drivers_vehicle':
      case 'see_passengers_vehicle':
      case 'schedule_passenger_vehicle':
      case 'schedule_driver_vehicle':
        return renderVehicleSelection();
      case 'see_drivers_location':
      case 'see_passengers_location':
      case 'schedule_passenger_location':
      case 'schedule_driver_location':
        return renderLocationSelection();
      case 'schedule_role':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose your role:</p>
            <Button className="w-full" variant="outline" onClick={() => updateFlow(selectRole(flowData, 'passenger'))}>
              Passenger
            </Button>
            <Button className="w-full" variant="outline" onClick={() => updateFlow(selectRole(flowData, 'driver'))}>
              Driver
            </Button>
          </div>
        );
      case 'success':
        return (
          <div className="space-y-4 text-center">
            <div className="text-success font-medium">{flowData.successMessage}</div>
            <Button onClick={reset}>Back to Home</Button>
          </div>
        );
      case 'chat_link':
        return (
          <div className="space-y-4">
            {flowData.chatUrl && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Chat:</p>
                <a href={flowData.chatUrl} target="_blank" rel="noopener noreferrer" 
                   className="text-primary underline break-all">
                  {flowData.chatUrl}
                </a>
              </div>
            )}
            <Button variant="outline" onClick={reset}>Back to Home</Button>
          </div>
        );
      default:
        return renderHomeButtons();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Flow Simulator" description="ULTRA-MINIMAL WhatsApp UX Simulator (Phase-1)" />
      
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5" />
              <span>Simulator Controls</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDevTools() && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Driver Access (Sub/Credits)</label>
                <Switch checked={hasAccess} onCheckedChange={setHasAccess} />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Badge variant={hasAccess ? "default" : "secondary"}>
                {hasAccess ? "Has Access" : "No Access"}
              </Badge>
              {flowData.selectedVehicle && (
                <Badge variant="outline">
                  {VEHICLE_OPTIONS.find(v => v.type === flowData.selectedVehicle)?.label}
                </Badge>
              )}
              {flowData.selectedLocation && (
                <Badge variant="outline">{flowData.selectedLocation.name}</Badge>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={reset} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Flow
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Interface</CardTitle>
          </CardHeader>
          <CardContent>
            {renderCurrentFlow()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}