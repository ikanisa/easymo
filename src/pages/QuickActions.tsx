import { useMutation, useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { MobilityAPI, type Favorite, type MatchCandidate } from '@/lib/mobilityApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const QuickActionsPage = () => {
  const { toast } = useToast();
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => MobilityAPI.listFavorites(),
  });

  const searchMutation = useMutation({
    mutationFn: MobilityAPI.searchMatches,
    onError: (error: Error) => toast({ description: error.message, variant: 'destructive' }),
  });

  const triggerSearch = (favorite: Favorite) => {
    searchMutation.mutate({ actor_kind: 'passenger', origin_favorite_id: favorite.id });
  };

  const candidates = searchMutation.data?.candidates ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Favorite Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add favorites to enable quick actions.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {favorites.map((favorite) => (
                  <Button
                    key={favorite.id}
                    variant="outline"
                    className="h-24 flex flex-col items-start gap-1 text-left"
                    onClick={() => triggerSearch(favorite)}
                    disabled={searchMutation.isPending}
                  >
                    <span className="text-xs uppercase text-muted-foreground">{favorite.kind}</span>
                    <span className="text-base font-semibold">{favorite.label}</span>
                    {favorite.coordinates && (
                      <span className="text-xs text-muted-foreground">
                        {favorite.coordinates.lat.toFixed(4)}, {favorite.coordinates.lng.toFixed(4)}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Results</CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tap a quick action to fetch drivers.</p>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate: MatchCandidate) => (
                  <div key={candidate.id} className="rounded-lg border p-3">
                    <p className="font-medium">{candidate.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Pickup {candidate.pickup_distance_km.toFixed(2)} km
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

export default QuickActionsPage;
