import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Smartphone, MapPin, RotateCcw, Loader2 } from "lucide-react";
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
  selectListItem,
  selectRole,
  submitDriverPlate,
  restartDriverVehicleSelection,
  type FlowData
} from "@/lib/waSimFlows";
import { showDevTools, shouldUseMock } from "@/lib/env";
import type { DriverPresence, Trip } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function Simulator() {
  const [flowData, setFlowData] = useState<FlowData>(INITIAL_FLOW_DATA);
  const [hasAccess, setHasAccess] = useState(false);
  const [drivers, setDrivers] = useState<DriverPresence[]>([]);
  const [passengers, setPassengers] = useState<Trip[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [driverRefCode, setDriverRefCode] = useState('');
  const [passengerRefCode, setPassengerRefCode] = useState('');
  const [driverPlateInput, setDriverPlateInput] = useState('');
  const isMock = shouldUseMock();
  const { toast } = useToast();

  const updateFlow = (newData: FlowData) => setFlowData(newData);
  const reset = () => {
    setFlowData(resetFlow());
    setDrivers([]);
    setPassengers([]);
    setSimError(null);
    setSimLoading(false);
    setDriverPlateInput('');
  };

  useEffect(() => {
    if (flowData.state === 'driver_onboarding_plate') {
      setDriverPlateInput(flowData.driverProfile.vehiclePlate ?? '');
    }
  }, [flowData.state, flowData.driverProfile.vehiclePlate]);

  const handleDriverPlateSubmit = () => {
    if (driverPlateInput.trim().length < 4) {
      toast({
        title: 'Invalid plate',
        description: 'Enter a valid plate (min 4 characters).',
        variant: 'destructive',
      });
      return;
    }
    updateFlow(submitDriverPlate(flowData, driverPlateInput));
  };

  const handleChangeVehicle = (target: 'see_passengers' | 'schedule_driver') => {
    updateFlow(restartDriverVehicleSelection(flowData, target));
  };

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
      <p className="text-sm text-muted-foreground">
        {flowData.state === 'driver_onboarding_vehicle'
          ? 'Select your vehicle type to finish driver setup.'
          : 'Select vehicle type:'}
      </p>
      {VEHICLE_OPTIONS.map(({ type, label }) => (
        <Button
          key={type}
          className="w-full justify-start"
          variant="outline"
          onClick={() => updateFlow(selectVehicle(flowData, type))}
        >
          {label}
        </Button>
      ))}
    </div>
  );

  const renderDriverPlatePrompt = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Enter your vehicle plate once to unlock driver features.
      </p>
      <Input
        placeholder="e.g. RAA123C"
        value={driverPlateInput}
        onChange={(event) => setDriverPlateInput(event.target.value.toUpperCase())}
      />
      <Button className="w-full" onClick={handleDriverPlateSubmit}>
        Continue
      </Button>
    </div>
  );

  const renderLocationSelection = () => (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Share your location:</p>
        {(flowData.state === 'see_passengers_location' || flowData.state === 'schedule_driver_location') && (
          <p className="text-xs text-muted-foreground">
            Registered vehicle: {flowData.driverProfile.vehicleType ?? '—'} • Plate: {flowData.driverProfile.vehiclePlate ?? '—'}
          </p>
        )}
      </div>
      {PRESET_LOCATIONS.map((location) => (
        <Button
          key={location.name}
          className="w-full justify-start"
          variant="outline"
          onClick={() => handleLocationSelect(location)}
        >
          <MapPin className="h-4 w-4 mr-2" />
          {location.name}
        </Button>
      ))}
      {(flowData.state === 'see_passengers_location' || flowData.state === 'schedule_driver_location') && (
        <Button
          className="w-full justify-start"
          variant="secondary"
          onClick={() => handleChangeVehicle(flowData.state === 'see_passengers_location' ? 'see_passengers' : 'schedule_driver')}
        >
          Change vehicle type
        </Button>
      )}
    </div>
  );

  const renderDriversList = () => (
    <div className="space-y-4">
      {simLoading && (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading nearby drivers...
        </div>
      )}
      {simError && flowData.state === 'see_drivers_list' && (
        <div className="text-sm text-destructive">{simError}</div>
      )}
      {!simLoading && !simError && drivers.length === 0 && (
        <div className="text-sm text-muted-foreground">No drivers found within the search radius.</div>
      )}
      {!simLoading && drivers.length > 0 && (
        <div className="space-y-2">
          {drivers.map((driver) => (
            <Button
              key={`${driver.user_id}-${driver.ref_code}`}
              variant="outline"
              className="w-full justify-between"
              onClick={() => handleContactSelect(driver.whatsapp_e164 ?? '', driver.ref_code ?? 'DRIVER')}
            >
              <span className="font-mono text-sm">{driver.ref_code ?? '??????'}</span>
              <span className="text-xs text-muted-foreground">{driver.whatsapp_e164 ?? 'No contact'}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  const renderPassengersList = () => (
    <div className="space-y-4">
      {simLoading && (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading nearby passenger requests...
        </div>
      )}
      {simError && flowData.state === 'see_passengers_list' && (
        <div className="text-sm text-destructive">{simError}</div>
      )}
      {!simLoading && !simError && passengers.length === 0 && (
        <div className="text-sm text-muted-foreground">No passenger requests found in this area.</div>
      )}
      {!simLoading && passengers.length > 0 && (
        <div className="space-y-2">
          {passengers.map((trip) => (
            <Button
              key={trip.id}
              variant="outline"
              className="w-full justify-between"
              onClick={() => handleContactSelect(trip.whatsapp_e164 ?? '', trip.ref_code ?? 'PASSENGER')}
            >
              <div className="text-left">
                <div className="text-sm font-medium">Trip #{trip.id}</div>
                <div className="text-xs text-muted-foreground">{new Date(trip.created_at).toLocaleString()}</div>
              </div>
              <span className="text-xs text-muted-foreground">{trip.whatsapp_e164 ?? 'No contact'}</span>
            </Button>
          ))}
        </div>
      )}
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
      case 'driver_onboarding_vehicle':
        return renderVehicleSelection();
      case 'driver_onboarding_plate':
        return renderDriverPlatePrompt();
      case 'see_drivers_location':
      case 'see_passengers_location':
      case 'schedule_passenger_location':
      case 'schedule_driver_location':
        return renderLocationSelection();
      case 'see_drivers_list':
        return renderDriversList();
      case 'see_passengers_list':
        return renderPassengersList();
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

  const handleContactSelect = (whatsapp: string, refCode: string) => {
    if (!whatsapp) {
      toast({
        title: 'Contact unavailable',
        description: 'No WhatsApp number available for this record.',
        variant: 'destructive',
      });
      return;
    }

    const next = selectListItem(flowData, whatsapp, refCode);
    updateFlow(next);
  };

  const handleLocationSelect = async (location: { name: string; lat: number; lng: number }) => {
    if (!flowData.selectedVehicle) {
      updateFlow(selectLocation(flowData, location));
      return;
    }

    setSimError(null);

    if (flowData.state === 'see_drivers_location') {
      updateFlow(selectLocation(flowData, location));
      setSimLoading(true);
      try {
        const results = await ADAPTER.simulateSeeNearbyDrivers({
          lat: location.lat,
          lng: location.lng,
          vehicle_type: flowData.selectedVehicle,
        });
        setDrivers(results);
      } catch (error) {
        console.error('simulator.drivers_failed', error);
        setSimError('Failed to load drivers.');
      } finally {
        setSimLoading(false);
      }
      return;
    }

    if (flowData.state === 'see_passengers_location') {
      if (!isMock && !driverRefCode.trim()) {
        toast({
          title: 'Driver Ref Code Required',
          description: 'Enter a driver ref code to evaluate access.',
          variant: 'destructive',
        });
        return;
      }

      updateFlow(selectLocation(flowData, location));
      setSimLoading(true);
      try {
        const result = await ADAPTER.simulateSeeNearbyPassengers({
          lat: location.lat,
          lng: location.lng,
          vehicle_type: flowData.selectedVehicle,
          hasAccess,
          driver_ref_code: driverRefCode.trim() || undefined,
        });

        if (result === 'NO_ACCESS') {
          setPassengers([]);
          setSimError('Access denied. Driver needs an active subscription or available credits.');
        } else {
          setPassengers(result);
        }
      } catch (error) {
        console.error('simulator.passengers_failed', error);
        setSimError('Failed to load passenger trips.');
      } finally {
        setSimLoading(false);
      }
      return;
    }

    if (flowData.state === 'schedule_passenger_location') {
      const ref = passengerRefCode.trim().toUpperCase();
      if (!isMock && !ref) {
        toast({
          title: 'Passenger Ref Code Required',
          description: 'Enter a passenger ref code to save a trip.',
          variant: 'destructive',
        });
        return;
      }

      setSimLoading(true);
      try {
        const trip = await ADAPTER.simulateScheduleTripPassenger({
          vehicle_type: flowData.selectedVehicle,
          lat: location.lat,
          lng: location.lng,
          refCode: isMock ? undefined : ref,
        });

        updateFlow({
          ...flowData,
          state: 'success',
          selectedLocation: location,
          chatUrl: null,
          successMessage: `✅ Passenger trip saved (ID ${trip.id}).`,
        });
      } catch (error) {
        console.error('simulator.schedule_passenger_failed', error);
        toast({
          title: 'Unable to save trip',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setSimLoading(false);
      }
      return;
    }

    if (flowData.state === 'schedule_driver_location') {
      const ref = driverRefCode.trim().toUpperCase();
      if (!ref) {
        toast({
          title: 'Driver Ref Code Required',
          description: 'Enter a driver ref code to save a trip.',
          variant: 'destructive',
        });
        return;
      }

      setSimLoading(true);
      try {
        const trip = await ADAPTER.simulateScheduleTripDriver({
          vehicle_type: flowData.selectedVehicle,
          lat: location.lat,
          lng: location.lng,
          hasAccess,
          refCode: ref,
        });

        if (trip === 'NO_ACCESS') {
          setSimError('Driver access required to schedule trips.');
          return;
        }

        updateFlow({
          ...flowData,
          state: 'success',
          selectedLocation: location,
          chatUrl: null,
          successMessage: `✅ Driver trip saved (ID ${trip.id}).`,
        });
      } catch (error) {
        console.error('simulator.schedule_driver_failed', error);
        toast({
          title: 'Unable to save driver trip',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setSimLoading(false);
      }
      return;
    }

    updateFlow(selectLocation(flowData, location));
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

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="driver-ref-input">
                Driver Ref Code
              </label>
              <Input
                id="driver-ref-input"
                placeholder="e.g. 234567"
                value={driverRefCode}
                onChange={(event) => setDriverRefCode(event.target.value.trim().toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                Required when connected to Supabase to evaluate passenger access.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="passenger-ref-input">
                Passenger Ref Code
              </label>
              <Input
                id="passenger-ref-input"
                placeholder="e.g. 123456"
                value={passengerRefCode}
                onChange={(event) => setPassengerRefCode(event.target.value.trim().toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                Required for saving passenger trips in live mode.
              </p>
            </div>
            
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
