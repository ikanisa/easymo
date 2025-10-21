import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type Favorite } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const kinds: Array<{ value: Favorite['kind']; label: string }> = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'school', label: 'School' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  kind: 'home' as Favorite['kind'],
  label: '',
  address: '',
  lat: '',
  lng: '',
  isDefault: false,
};

const FavoritesPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => MobilityAPI.listFavorites(),
  });

  const [formState, setFormState] = useState({ ...emptyForm });

  const createMutation = useMutation({
    mutationFn: MobilityAPI.createFavorite,
    onSuccess: () => {
      toast({ description: 'Favorite saved' });
      setFormState({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: MobilityAPI.deleteFavorite,
    onSuccess: () => {
      toast({ description: 'Favorite removed' });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const markDefault = useMutation({
    mutationFn: MobilityAPI.updateFavorite,
    onSuccess: () => {
      toast({ description: 'Default updated' });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.label || !formState.lat || !formState.lng) {
      toast({ description: 'Label and coordinates are required', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      kind: formState.kind,
      label: formState.label,
      address: formState.address || undefined,
      lat: Number(formState.lat),
      lng: Number(formState.lng),
      is_default: formState.isDefault,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Favorite Location</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kind">Kind</Label>
                <Select value={formState.kind} onValueChange={(value) => setFormState((prev) => ({ ...prev, kind: value as Favorite['kind'] }))}>
                  <SelectTrigger id="kind">
                    <SelectValue placeholder="Select kind" />
                  </SelectTrigger>
                  <SelectContent>
                    {kinds.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={formState.label}
                  onChange={(event) => setFormState((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Home"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formState.address}
                  onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    value={formState.lat}
                    onChange={(event) => setFormState((prev) => ({ ...prev, lat: event.target.value }))}
                    placeholder="-1.9445"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    value={formState.lng}
                    onChange={(event) => setFormState((prev) => ({ ...prev, lng: event.target.value }))}
                    placeholder="30.061"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formState.isDefault}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, isDefault: checked }))}
                />
                <Label htmlFor="isDefault">Mark as default</Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving…' : 'Save Favorite'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Favorites</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading favorites…</p>
            ) : favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No favorites saved yet.</p>
            ) : (
              <div className="space-y-4">
                {favorites.map((favorite) => (
                  <div
                    key={favorite.id}
                    className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{favorite.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {favorite.kind.toUpperCase()} · {favorite.coordinates ? `${favorite.coordinates.lat.toFixed(4)}, ${favorite.coordinates.lng.toFixed(4)}` : 'No coordinates'}
                      </p>
                      {favorite.address && (
                        <p className="text-xs text-muted-foreground">{favorite.address}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!favorite.is_default && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            markDefault.mutate({ id: favorite.id, is_default: true })
                          }
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(favorite.id)}
                      >
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

export default FavoritesPage;
