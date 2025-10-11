"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { Campaign } from "@/lib/schemas";
import styles from "./CampaignDrawer.module.css";

interface CampaignDrawerProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export function CampaignDrawer({ campaign, onClose }: CampaignDrawerProps) {
  const title = campaign ? campaign.name : "Campaign details";

  return (
    <Drawer title={title} onClose={onClose}>
      {!campaign
        ? <p className={styles.placeholder}>Select a campaign to view details.</p>
        : (
          <div className={styles.content}>
            <section>
              <h3>Overview</h3>
              <dl className={styles.definitionList}>
                <div>
                  <dt>Status</dt>
                  <dd>{campaign.status}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{campaign.type}</dd>
                </div>
                <div>
                  <dt>Template</dt>
                  <dd>{campaign.templateId}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(campaign.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{campaign.finishedAt ? new Date(campaign.finishedAt).toLocaleString() : "—"}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Metadata</h3>
              <pre className={styles.metadata}>{JSON.stringify(campaign.metadata ?? {}, null, 2)}</pre>
            </section>
            <section>
              <h3>Upcoming actions</h3>
              <p>
                Dispatcher controls, audience stats, and error buckets will land
                in future phases. For now use this drawer to provide quick
                context when reviewing campaigns.
              </p>
            </section>
          </div>
        )}
    </Drawer>
  );
}
