"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import styles from "./SaccoBranchForm.module.css";

interface SaccoBranchFormProps {
  onCreated?: () => void;
}

export function SaccoBranchForm({ onCreated }: SaccoBranchFormProps) {
  const [name, setName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [umurengeName, setUmurengeName] = useState("");
  const [district, setDistrict] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<'pending' | 'active' | 'suspended'>("pending");
  const [ltvMinRatio, setLtvMinRatio] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pushToast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !branchCode.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/baskets/saccos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          branchCode,
          umurengeName: umurengeName || null,
          district: district || null,
          contactPhone: contactPhone || null,
          status,
          ltvMinRatio,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        pushToast(data?.message ?? "Failed to create SACCO branch.", "error");
        return;
      }

      pushToast("SACCO branch created.", "success");
      setName("");
      setBranchCode("");
      setUmurengeName("");
      setDistrict("");
      setContactPhone("");
      setStatus("pending");
      setLtvMinRatio(1.0);
      onCreated?.();
    } catch (error) {
      console.error("sacco_create_failed", error);
      pushToast("Unexpected error while creating SACCO branch.", "error");
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
            placeholder="Musanze SACCO"
          />
        </label>
        <label>
          <span>Branch code</span>
          <input
            required
            value={branchCode}
            onChange={(event) => setBranchCode(event.target.value.toUpperCase())}
            placeholder="MSZ001"
          />
        </label>
        <label>
          <span>Umurenge</span>
          <input
            value={umurengeName}
            onChange={(event) => setUmurengeName(event.target.value)}
            placeholder="Musanze"
          />
        </label>
        <label>
          <span>District</span>
          <input
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            placeholder="Northern"
          />
        </label>
        <label>
          <span>Contact (E.164)</span>
          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="+2507…"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as typeof status)}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label>
          <span>Min LTV coverage</span>
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.05}
            value={ltvMinRatio}
            onChange={(event) => {
              const next = event.target.value;
              setLtvMinRatio(next === '' ? 1 : Number(next));
            }}
          />
        </label>
      </div>
      <Button type="submit" disabled={isSubmitting} size="sm">
        {isSubmitting ? "Saving…" : "Create branch"}
      </Button>
    </form>
  );
}
