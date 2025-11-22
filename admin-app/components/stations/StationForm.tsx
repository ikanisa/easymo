"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";

import styles from "./StationForm.module.css";

interface StationFormProps {
  onCreated: () => void;
}

export function StationForm({ onCreated }: StationFormProps) {
  const [name, setName] = useState("");
  const [engencode, setEngencode] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pushToast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(getAdminApiPath("stations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          engencode,
          ownerContact: ownerContact || null,
          status,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        pushToast(data?.error ?? "Failed to create station.", "error");
        return;
      }
      pushToast("Station created.", "success");
      setName("");
      setEngencode("");
      setOwnerContact("");
      setStatus("active");
      onCreated();
    } catch (error) {
      console.error("Station create failed", error);
      pushToast("Unexpected error while creating station.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label>
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Engen code</span>
          <input
            required
            value={engencode}
            onChange={(event) => setEngencode(event.target.value)}
          />
        </label>
        <label>
          <span>Owner contact</span>
          <input
            value={ownerContact}
            onChange={(event) => setOwnerContact(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "active" | "inactive")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Create station"}
      </button>
    </form>
  );
}
