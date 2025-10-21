import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type Favorite, type MatchCandidate } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const MatchesPage = () => {
  const { toast } = useToast();
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => MobilityAPI.listFavorites(),
  });

  const [formState, setFormState] = useState({
    actorKind: 'passenger' as 'driver' | 'passenger',
    originFavoriteId: '',
    destFavoriteId: '',
    pickupLat: '',
    pickupLng: '',
    dropLat: '',
    dropLng: '',
    radiusKm: '10',
  });

  const searchMutation = useMutation({
    mutationFn: MobilityAPI.searchMatches,
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: Parameters<typeof MobilityAPI.searchMatches>[0] = {
      actor_kind: formState.actorKind,
      radius_km: Number(formState.radiusKm || '10'),
    };
    if (formState.originFavoriteId) payload.origin_favorite_id = formState.originFavoriteId;
    if (formState.destFavoriteId) payload.dest_favorite_id = formState.destFavoriteId;
    if (formState.pickupLat && formState.pickupLng) {
      payload.pickup = { lat: Number(formState.pickupLat), lng: Number(formState.pickupLng) };
    }
    if (formState.dropLat && formState.dropLng) {
      payload.dropoff = { lat: Number(formState.dropLat), lng: Number(formState.dropLng) };
    }

    searchMutation.mutate(payload);
  };

  const favoriteOptions = favorites.map((favorite: Favorite) => ({ value: favorite.id, label: `${favorite.label} (${favorite.kind})` }));
  const candidates = searchMutation.data?.candidates ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Search Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="actorKind">Actor</Label>
                <Select
                  value={formState.actorKind}
                  onValueChange={(value: 'driver' | 'passenger') => setFormState((prev) => ({ ...prev, actorKind: value }))}
                >
                  <SelectTrigger id="actorKind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passenger">Passenger</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (km)</Label>
                <Input
                  id="radius"
                  value={formState.radiusKm}
                  onChange={(event) => setFormState((prev) => ({ ...prev, radiusKm: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Origin Favorite</Label>
                <Select
                  value={formState.originFavoriteId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, originFavoriteId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {favoriteOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination Favorite</Label>
                <Select
                  value={formState.destFavoriteId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, destFavoriteId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {favoriteOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupLat">Pickup Lat</Label>
                  <Input
                    id="pickupLat"
                    value={formState.pickupLat}
                    onChange={(event) => setFormState((prev) => ({ ...prev, pickupLat: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupLng">Pickup Lng</Label>
                  <Input
                    id="pickupLng"
                    value={formState.pickupLng}
                    onChange={(event) => setFormState((prev) => ({ ...prev, pickupLng: event.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dropLat">Dropoff Lat</Label>
                  <Input
                    id="dropLat"
                    value={formState.dropLat}
                    onChange={(event) => setFormState((prev) => ({ ...prev, dropLat: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropLng">Dropoff Lng</Label>
                  <Input
                    id="dropLng"
                    value={formState.dropLng}
                    onChange={(event) => setFormState((prev) => ({ ...prev, dropLng: event.target.value }))}
                  />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? 'Searching…' : 'Search Matches'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate Results</CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates yet.</p>
            ) : (
              <div className="space-y-4">
                {candidates.map((candidate: MatchCandidate) => (
                  <div key={candidate.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{candidate.user_id}</p>
                      <span className="text-xs uppercase text-muted-foreground">{candidate.source ?? 'live'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pickup {candidate.pickup_distance_km.toFixed(2)} km · Dropoff {candidate.dropoff_distance_km != null ? candidate.dropoff_distance_km.toFixed(2) + ' km' : 'n/a'}
                    </p>
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

export default MatchesPage;
