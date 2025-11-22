"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { Station } from "@/lib/schemas";

import styles from "./StationDrawer.module.css";

interface StationDrawerProps {
  station: Station | null;
  onClose: () => void;
}

export function StationDrawer({ station, onClose }: StationDrawerProps) {
  const title = station ? station.name : "Station details";

  return (
    <Drawer title={title} onClose={onClose}>
      {!station
        ? <p className={styles.placeholder}>Select a station to view details.</p>
        : (
          <div className={styles.content}>
            <section>
              <h3>Profile</h3>
              <dl className={styles.definitionList}>
                <div>
                  <dt>Engen code</dt>
                  <dd>{station.engencode}</dd>
                </div>
                <div>
                  <dt>Owner contact</dt>
                  <dd>{station.ownerContact ?? "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{station.status}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(station.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Next steps</h3>
              <p>
                Actions like deactivate, assign staff numbers, and anomaly reports
                will be wired here later. For now this drawer provides read-only
                context for support.
              </p>
            </section>
          </div>
        )}
    </Drawer>
  );
}
