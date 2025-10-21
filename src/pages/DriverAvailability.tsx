import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type DriverAvailability } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const dayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const DriverAvailabilityPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: parkings = [] } = useQuery({
    queryKey: ['driver-parking'],
    queryFn: () => MobilityAPI.listDriverParking(),
  });
  const { data: availability = [] } = useQuery({
    queryKey: ['driver-availability'],
    queryFn: () => MobilityAPI.listDriverAvailability(),
  });

  const [formState, setFormState] = useState({
    parkingId: '' as string | null,
    startTime: '07:00',
    endTime: '19:00',
    timezone: 'Africa/Kigali',
    days: new Set<number>([1, 2, 3, 4, 5]),
    active: true,
  });

  const parkingOptions = useMemo(() => parkings.map((parking) => ({ value: parking.id, label: parking.label })), [parkings]);

  const createMutation = useMutation({
    mutationFn: MobilityAPI.createDriverAvailability,
    onSuccess: () => {
      toast({ description: 'Availability window saved' });
      queryClient.invalidateQueries({ queryKey: ['driver-availability'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: MobilityAPI.updateDriverAvailability,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-availability'] }),
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: MobilityAPI.deleteDriverAvailability,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-availability'] }),
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const handleDayToggle = (day: number) => {
    setFormState((prev) => {
      const next = new Set(prev.days);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return { ...prev, days: next };
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (formState.days.size === 0) {
      toast({ description: 'Select at least one day', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      parking_id: formState.parkingId || null,
      start_time_local: formState.startTime,
      end_time_local: formState.endTime,
      timezone: formState.timezone,
      days_of_week: Array.from(formState.days).sort(),
      active: formState.active,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Availability Window</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="parking">Parking (optional)</Label>
                <Select
                  value={formState.parkingId ?? ''}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, parkingId: value || null }))}
                >
                  <SelectTrigger id="parking">
                    <SelectValue placeholder="Any parking" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any parking</SelectItem>
                    {parkingOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formState.timezone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, timezone: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start Time</Label>
                <Input
                  id="start"
                  type="time"
                  value={formState.startTime}
                  onChange={(event) => setFormState((prev) => ({ ...prev, startTime: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  type="time"
                  value={formState.endTime}
                  onChange={(event) => setFormState((prev) => ({ ...prev, endTime: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Days of Week</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {dayOptions.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`availability-day-${day.value}`}
                        checked={formState.days.has(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={`availability-day-${day.value}`}>{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="availability-active"
                  checked={formState.active}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="availability-active">Active</Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving…' : 'Save Availability'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability Windows</CardTitle>
          </CardHeader>
          <CardContent>
            {availability.length === 0 ? (
              <p className="text-sm text-muted-foreground">No availability windows yet.</p>
            ) : (
              <div className="space-y-4">
                {availability.map((window: DriverAvailability) => (
                  <div key={window.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">
                        {window.start_time_local} – {window.end_time_local} ({window.timezone})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {window.days_of_week.map((day) => dayOptions.find((opt) => opt.value === day)?.label ?? day).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={window.active}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: window.id, active: checked })
                        }
                      />
                      <Button variant="destructive" onClick={() => deleteMutation.mutate(window.id)}>
                        Remove
                      </Button>
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

export default DriverAvailabilityPage;
