import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Route, MapPin, Clock, User, Car, AlertTriangle } from "lucide-react";
import { AdminAPI } from "@/lib/api";
import { VEHICLE_LABELS, timeAgo } from "@/lib/format";
import { formatUserRefCode } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Trip } from "@/lib/types";

export default function TripsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    data: trips = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['admin-trips'],
    queryFn: AdminAPI.listTrips,
    select: (data) => 
      [...data].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
  });

  const closeTripMutation = useMutation({
    mutationFn: AdminAPI.closeTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      toast({
        title: "Success",
        description: "Trip closed successfully",
      });
    },
    onError: (error) => {
      console.error("Failed to close trip:", error);
      toast({
        title: "Error",
        description: "Failed to close trip",
        variant: "destructive",
      });
    },
  });

  const openTrips = trips.filter(t => t.status === "open").length;
  const expiredTrips = trips.filter(t => t.status === "expired").length;

  const columns: Column<Trip>[] = [
    {
      id: "id",
      header: "Trip ID",
      accessorKey: "id",
      cell: (trip) => <span className="font-medium">T-{trip.id}</span>,
      sortable: true,
      filterable: true,
      searchWeight: 2,
    },
    {
      id: "creator_user_id",
      header: "User ID",
      accessorKey: "creator_user_id",
      cell: (trip) => (
        <span className="font-mono text-sm">{formatUserRefCode(trip.creator_user_id)}</span>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 3,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (trip) => (
        <span className={`text-sm px-2 py-1 rounded-md ${
          trip.status === 'open' 
            ? 'bg-info/10 text-info border border-info/20'
            : 'bg-muted/10 text-muted-foreground border border-muted/20'
        }`}>
          {trip.status || 'open'}
        </span>
      ),
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "open", label: "Open" },
        { value: "expired", label: "Expired" },
      ],
      searchWeight: 2,
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      cell: (trip) => (
        <div className="flex items-center space-x-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="capitalize">{trip.role}</span>
        </div>
      ),
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "passenger", label: "Passenger" },
        { value: "driver", label: "Driver" },
      ],
      searchWeight: 2,
    },
    {
      id: "vehicle_type",
      header: "Vehicle",
      accessorKey: "vehicle_type",
      cell: (trip) => (
        <div className="flex items-center space-x-1">
          <Car className="h-3 w-3 text-muted-foreground" />
          <span>{VEHICLE_LABELS[trip.vehicle_type]}</span>
        </div>
      ),
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "moto", label: "Moto Taxi" },
        { value: "cab", label: "Cab" },
        { value: "lifan", label: "Lifan" },
        { value: "truck", label: "Truck" },
        { value: "others", label: "Others" },
      ],
      searchWeight: 2,
    },
    {
      id: "location",
      header: "Pickup Location",
      cell: (trip) => (
        <div className="flex items-center space-x-1">
          <MapPin className="h-3 w-3 text-whatsapp" />
          <span className="text-muted-foreground text-sm">
            {trip.lat.toFixed(4)}, {trip.lng.toFixed(4)}
          </span>
        </div>
      ),
      searchable: false,
    },
    {
      id: "created_at",
      header: "Created",
      accessorKey: "created_at",
      cell: (trip) => (
        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(trip.created_at)}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (trip) => (
        <div className="flex space-x-2">
          {trip.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => closeTripMutation.mutate(trip.id)}
              disabled={closeTripMutation.isPending}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Close
            </Button>
          )}
        </div>
      ),
      searchable: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trips" description="Manage platform trips and bookings" />
        
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-16 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-12 bg-muted rounded mb-1"></div>
                <div className="h-3 w-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Trips" description="Platform trips (most recent first, pickup-only)" />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Trips</CardTitle>
            <Route className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTrips}</div>
            <p className="text-xs text-muted-foreground">Active requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredTrips}</div>
            <p className="text-xs text-muted-foreground">Auto-expired trips</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trips.length}</div>
            <p className="text-xs text-muted-foreground">All trips</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={trips}
        columns={columns}
        searchPlaceholder="Search trips by ID, user, vehicle type..."
        emptyMessage="No trips found"
        enableGlobalSearch={true}
        enableFilters={true}
      />
    </div>
  );
}