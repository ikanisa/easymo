import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type Favorite, type RecurringTrip } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';

const dayOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const ScheduleTripPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => MobilityAPI.listFavorites(),
  });
  const { data: trips = [] } = useQuery({
    queryKey: ['recurring-trips'],
    queryFn: () => MobilityAPI.listRecurringTrips(),
  });

  const [formState, setFormState] = useState({
    originFavoriteId: '',
    destFavoriteId: '',
    timeLocal: '08:00',
    radiusKm: '10',
    days: new Set<number>([1, 2, 3, 4, 5]),
  });

  const createMutation = useMutation({
    mutationFn: MobilityAPI.createRecurringTrip,
    onSuccess: () => {
      toast({ description: 'Recurring trip saved' });
      queryClient.invalidateQueries({ queryKey: ['recurring-trips'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: MobilityAPI.deleteRecurringTrip,
    onSuccess: () => {
      toast({ description: 'Recurring trip removed' });
      queryClient.invalidateQueries({ queryKey: ['recurring-trips'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const favoriteOptions = useMemo(
    () => favorites.map((favorite) => ({ value: favorite.id, label: `${favorite.label} (${favorite.kind})` })),
    [favorites],
  );

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
    if (!formState.originFavoriteId || !formState.destFavoriteId) {
      toast({ description: 'Select origin and destination favorites', variant: 'destructive' });
      return;
    }
    if (formState.days.size === 0) {
      toast({ description: 'Select at least one day', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      origin_favorite_id: formState.originFavoriteId,
      dest_favorite_id: formState.destFavoriteId,
      time_local: formState.timeLocal,
      days_of_week: Array.from(formState.days).sort(),
      radius_km: Number(formState.radiusKm || '10'),
    });
  };

  const favoriteLabel = (favoriteId: string) => {
    const favorite = favorites.find((fav) => fav.id === favoriteId);
    return favorite ? `${favorite.label} (${favorite.kind})` : favoriteId;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Recurring Trip</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="origin">Origin Favorite</Label>
                <Select
                  value={formState.originFavoriteId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, originFavoriteId: value }))}
                >
                  <SelectTrigger id="origin">
                    <SelectValue placeholder="Select favorite" />
                  </SelectTrigger>
                  <SelectContent>
                    {favoriteOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination Favorite</Label>
                <Select
                  value={formState.destFavoriteId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, destFavoriteId: value }))}
                >
                  <SelectTrigger id="destination">
                    <SelectValue placeholder="Select favorite" />
                  </SelectTrigger>
                  <SelectContent>
                    {favoriteOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_local">Local Time</Label>
                <Input
                  id="time_local"
                  type="time"
                  value={formState.timeLocal}
                  onChange={(event) => setFormState((prev) => ({ ...prev, timeLocal: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (km)</Label>
                <Input
                  id="radius"
                  value={formState.radiusKm}
                  onChange={(event) => setFormState((prev) => ({ ...prev, radiusKm: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Days of Week</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {dayOptions.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formState.days.has(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={`day-${day.value}`}>{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Scheduling…' : 'Schedule Trip'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Recurring Trips</CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring trips configured.</p>
            ) : (
              <div className="space-y-4">
                {trips.map((trip: RecurringTrip) => (
                  <div
                    key={trip.id}
                    className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {favoriteLabel(trip.origin_favorite_id)} → {favoriteLabel(trip.dest_favorite_id)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {trip.days_of_week.map((day) => dayOptions.find((opt) => opt.value === day)?.label ?? day).join(', ')} · {trip.time_local} · {trip.radius_km} km radius
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          MobilityAPI.updateRecurringTrip({ id: trip.id, active: !trip.active }).then(() =>
                            queryClient.invalidateQueries({ queryKey: ['recurring-trips'] })
                          )
                        }
                      >
                        {trip.active ? 'Pause' : 'Activate'}
                      </Button>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate(trip.id)}>
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

export default ScheduleTripPage;
