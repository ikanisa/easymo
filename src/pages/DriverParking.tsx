import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type DriverParking } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const DriverParkingPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: parkings = [] } = useQuery({
    queryKey: ['driver-parking'],
    queryFn: () => MobilityAPI.listDriverParking(),
  });

  const [formState, setFormState] = useState({
    label: '',
    lat: '',
    lng: '',
    active: true,
  });

  const createMutation = useMutation({
    mutationFn: MobilityAPI.createDriverParking,
    onSuccess: () => {
      toast({ description: 'Parking location saved' });
      setFormState({ label: '', lat: '', lng: '', active: true });
      queryClient.invalidateQueries({ queryKey: ['driver-parking'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: MobilityAPI.updateDriverParking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-parking'] }),
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.label || !formState.lat || !formState.lng) {
      toast({ description: 'Label and coordinates are required', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      label: formState.label,
      lat: Number(formState.lat),
      lng: Number(formState.lng),
      active: formState.active,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Driver Parking</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={formState.label}
                  onChange={(event) => setFormState((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Remera Taxi Rank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  value={formState.lat}
                  onChange={(event) => setFormState((prev) => ({ ...prev, lat: event.target.value }))}
                  placeholder="-1.9440"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  value={formState.lng}
                  onChange={(event) => setFormState((prev) => ({ ...prev, lng: event.target.value }))}
                  placeholder="30.0620"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formState.active}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving…' : 'Save Parking'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Parking Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {parkings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved parking spots yet.</p>
            ) : (
              <div className="space-y-4">
                {parkings.map((parking: DriverParking) => (
                  <div key={parking.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{parking.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {parking.coordinates ? `${parking.coordinates.lat?.toFixed(4)}, ${parking.coordinates.lng?.toFixed(4)}` : 'No coordinates'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={parking.active}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: parking.id, active: checked })
                        }
                      />
                      <span className="text-sm text-muted-foreground">{parking.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default DriverParkingPage;
