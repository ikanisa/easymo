"use client";

import { useMemo, useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { DataTable } from "@/src/v2/components/ui/DataTable";
import { CrudDialog } from "@/src/v2/components/ui/CrudDialog";
import {
  useStations,
  useCreateStation,
  useUpdateStation,
  useDeleteStation,
  type Station,
} from "@/src/v2/lib/supabase/hooks";

interface StationFormValues {
  name: string;
  location: string;
}

type DialogState =
  | { mode: "create"; station: null }
  | { mode: "edit"; station: Station }
  | null;

export default function StationsPage() {
  const { data: stations = [], isLoading } = useStations();
  const { pushToast } = useToast();
  const createStation = useCreateStation();
  const updateStation = useUpdateStation();
  const deleteStation = useDeleteStation();
  const undoBuffer = useRef<Station | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const columns = useMemo(
    () => [
      { key: "name" as const, label: "Name", sortable: true },
      { key: "location" as const, label: "Location" },
      {
        key: "created_at" as const,
        label: "Joined",
        render: (value: string) => new Date(value).toLocaleDateString(),
      },
    ],
    [],
  );

  const openCreateDialog = () => setDialogState({ mode: "create", station: null });
  const openEditDialog = (station: Station) => setDialogState({ mode: "edit", station });
  const closeDialog = () => setDialogState(null);

  const initialValues: StationFormValues = dialogState?.mode === "edit" && dialogState.station
    ? {
        name: dialogState.station.name,
        location: dialogState.station.location ?? "",
      }
    : {
        name: "",
        location: "",
      };

  const handleSubmit = async (values: StationFormValues) => {
    try {
      if (dialogState?.mode === "edit" && dialogState.station) {
        await updateStation.mutateAsync({
          id: dialogState.station.id,
          name: values.name,
          location: values.location,
        });
        pushToast("Station updated.", "success");
      } else {
        await createStation.mutateAsync({
          name: values.name,
          location: values.location,
        });
        pushToast("Station created.", "success");
      }
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "We couldn’t save the station.",
        "error",
      );
    }
  };

  const handleDelete = async () => {
    if (dialogState?.mode !== "edit" || !dialogState.station) return;
    try {
      const deleted = await deleteStation.mutateAsync({ id: dialogState.station.id });
      undoBuffer.current = deleted;
      pushToast(`Deleted ${deleted.name}.`, {
        variant: "success",
        actionLabel: "Undo",
        onAction: async () => {
          const payload = undoBuffer.current;
          if (!payload) return;
          try {
            await createStation.mutateAsync({
              id: payload.id,
              name: payload.name,
              location: payload.location ?? undefined,
            });
            pushToast("Restored station.", "success");
          } catch (error) {
            pushToast(
              error instanceof Error
                ? error.message
                : "Unable to undo deletion.",
              "error",
            );
          }
        },
      });
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Failed to delete station.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Stations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage the EasyMO network of partner stations and depots.
            </p>
          </div>
          <Button variant="primary" onClick={openCreateDialog}>
            <PlusIcon className="mr-2 h-5 w-5" />
            Add Station
          </Button>
        </div>
      </div>

      <DataTable data={stations} columns={columns} loading={isLoading} onRowClick={openEditDialog} />

      {dialogState ? (
        <CrudDialog
          open={Boolean(dialogState)}
          mode={dialogState.mode}
          entityName="station"
          initialValues={initialValues}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          onDelete={dialogState.mode === "edit" ? handleDelete : undefined}
          description="Stations with clear location metadata appear faster in search and routing recommendations."
          renderFields={({ values, onChange }) => (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="station-name">
                  Name
                </label>
                <Input
                  id="station-name"
                  value={values.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="station-location">
                  Location
                </label>
                <Input
                  id="station-location"
                  value={values.location}
                  onChange={(event) => onChange({ location: event.target.value })}
                  placeholder="City, district, or coordinates"
                />
              </div>
            </>
          )}
        />
      ) : null}
    </div>
  );
}
