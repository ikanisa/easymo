"use client";

import { useState } from "react";
import { getAdminApiPath } from "@/lib/routes";
import type { Campaign } from "@/lib/schemas";
import { Button } from "@/components/ui/Button";
import styles from "./CampaignControls.module.css";

interface CampaignControlsProps {
  campaigns: Campaign[];
}

export function CampaignControls({ campaigns }: CampaignControlsProps) {
  const [selected, setSelected] = useState<string>(campaigns[0]?.id ?? "");
  const [status, setStatus] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runAction = async (action: "start" | "pause" | "stop") => {
    if (!selected) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(getAdminApiPath("campaigns", selected, action), {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.message ?? `${action} failed`);
        return;
      }
      setStatus(data.state ?? action);
      setMessage(data.message ?? `Campaign ${action}ed.`);
    } catch (error) {
      console.error("Campaign action failed", error);
      setMessage("Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.selectLabel}>
        <span>Campaign</span>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.status})
            </option>
          ))}
        </select>
      </label>
      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => runAction("start")}
          disabled={isSubmitting}
          variant="default"
        >
          Start
        </Button>
        <Button
          type="button"
          onClick={() => runAction("pause")}
          disabled={isSubmitting}
          variant="outline"
        >
          Pause
        </Button>
        <Button
          type="button"
          onClick={() => runAction("stop")}
          disabled={isSubmitting}
          variant="danger"
        >
          Stop
        </Button>
      </div>
      {status
        ? <p className={styles.status}>Dispatcher state: {status}</p>
        : null}
      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
}
