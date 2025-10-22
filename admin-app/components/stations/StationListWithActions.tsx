"use client";

import { useEffect, useState } from "react";
import type { Station } from "@/lib/schemas";
import { StationForm } from "./StationForm";
import styles from "./StationListWithActions.module.css";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { StationDrawer } from "@/components/stations/StationDrawer";
import { getAdminApiPath } from "@/lib/routes";

interface StationListWithActionsProps {
  stations: Station[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function StationListWithActions(
  { stations, hasMore, onLoadMore, loadingMore }: StationListWithActionsProps,
) {
  const [items, setItems] = useState(stations);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    setItems(stations);
  }, [stations]);

  const refresh = async () => {
    const response = await fetch(getAdminApiPath("stations"), { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setItems(data.data || []);
    }
  };

  const updateStatus = async (id: string, status: "active" | "inactive") => {
    setIsProcessing(true);
    try {
      const response = await fetch(getAdminApiPath("stations", id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json();
        pushToast(data?.error ?? "Failed to update station.", "error");
      } else {
        pushToast("Station updated.", "success");
        refresh();
      }
    } catch (error) {
      console.error("Station update failed", error);
      pushToast("Unexpected error while updating station.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeStation = async (id: string) => {
    if (!confirm("Delete this station?")) return;
    setIsProcessing(true);
    try {
      const response = await fetch(getAdminApiPath("stations", id), { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        pushToast(data?.error ?? "Failed to delete station.", "error");
      } else {
        pushToast("Station deleted.", "success");
        refresh();
      }
    } catch (error) {
      console.error("Station delete failed", error);
      pushToast("Unexpected error while deleting station.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <StationForm onCreated={refresh} />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Engen code</th>
            <th>Owner contact</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((station) => (
            <tr key={station.id}>
              <td>{station.name}</td>
              <td>{station.engencode}</td>
              <td>{station.ownerContact ?? "—"}</td>
              <td>{station.status}</td>
              <td>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStation(station)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      updateStatus(
                        station.id,
                        station.status === "active" ? "inactive" : "active",
                      )}
                    disabled={isProcessing}
                    size="sm"
                    variant="outline"
                  >
                    {station.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => removeStation(station.id)}
                    disabled={isProcessing}
                    size="sm"
                    variant="danger"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadMore}
        className="flex justify-center"
      >
        Load more stations
      </LoadMoreButton>
      <StationDrawer
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </div>
  );
}
