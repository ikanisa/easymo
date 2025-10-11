import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./IbiminaRegistryTable.module.css";
import {
  createIkiminaInvite,
  updateIkimina,
  type IbiminaRow,
  type IkiminaInvitePayload,
  type IkiminaInviteResult,
  type IkiminaUpdatePayload,
  type SaccoRow,
} from "@/lib/baskets/baskets-service";

type FormState = {
  name: string;
  description: string;
  status: IbiminaRow["status"];
  saccoId: string;
  quorumThreshold: string;
  quorumRoles: string;
};

type IbiminaEditPanelProps = {
  row: IbiminaRow;
  saccoOptions: SaccoRow[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
};

function buildInitialForm(row: IbiminaRow): FormState {
  return {
    name: row.name,
    description: row.description ?? "",
    status: row.status,
    saccoId: row.saccoId ?? "",
    quorumThreshold: row.quorum?.threshold != null
      ? String(row.quorum.threshold)
      : "",
    quorumRoles: row.quorum?.roles.join(", ") ?? "",
  };
}

const DEFAULT_INVITE_TTL = 1_440;

export function IbiminaEditPanel({
  row,
  saccoOptions,
  onClose,
  onUpdated,
}: IbiminaEditPanelProps) {
  const { pushToast } = useToast();
  const [form, setForm] = useState<FormState>(() => buildInitialForm(row));
  const [issuerMemberId, setIssuerMemberId] = useState("");
  const [inviteTtl, setInviteTtl] = useState(DEFAULT_INVITE_TTL);
  const [inviteResult, setInviteResult] = useState<IkiminaInviteResult | null>(
    null,
  );

  useEffect(() => {
    setForm(buildInitialForm(row));
    setIssuerMemberId("");
    setInviteTtl(DEFAULT_INVITE_TTL);
    setInviteResult(null);
  }, [row.id]);

  const updateMutation = useMutation({
    mutationFn: (payload: IkiminaUpdatePayload) => updateIkimina(row.id, payload),
    onSuccess: async () => {
      pushToast("Ikimina updated.", "success");
      await onUpdated();
      onClose();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : "Failed to update Ikimina.";
      pushToast(message, "error");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (payload: IkiminaInvitePayload) =>
      createIkiminaInvite(payload),
    onSuccess: (result) => {
      setInviteResult(result);
      pushToast("Invite created.", "success");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : "Failed to create invite.";
      pushToast(message, "error");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const thresholdRaw = form.quorumThreshold.trim();
    const thresholdNumber = thresholdRaw ? Number(thresholdRaw) : null;
    const safeThreshold =
      thresholdNumber != null && Number.isFinite(thresholdNumber)
        ? thresholdNumber
        : null;

    const normalizedRoles = form.quorumRoles
      .split(",")
      .map((role) => role.trim())
      .filter((role) => role.length > 0);

    const shouldPersistQuorum =
      Boolean(thresholdRaw) || normalizedRoles.length > 0;

    const payload: IkiminaUpdatePayload = {
      name: form.name,
      description: form.description,
      status: form.status,
      saccoId: form.saccoId || null,
      quorum: shouldPersistQuorum
        ? {
          threshold: safeThreshold,
          roles: normalizedRoles,
        }
        : {
          threshold: null,
          roles: [],
        },
    };

    updateMutation.mutate(payload);
  };

  const handleCreateInvite = () => {
    if (!issuerMemberId) {
      pushToast("Provide issuer member ID before creating an invite.", "error");
      return;
    }

    const payload: IkiminaInvitePayload = {
      ikiminaId: row.id,
      issuerMemberId,
      ttlMinutes: inviteTtl,
    };

    inviteMutation.mutate(payload);
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      pushToast(`Clipboard unavailable.`, "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      pushToast(`${label} copied to clipboard.`, "success");
    } catch (error) {
      console.error("clipboard_copy_failed", error);
      pushToast(`Unable to copy ${label.toLowerCase()}.`, "error");
    }
  };

  return (
    <form className={styles.editCard} onSubmit={handleSubmit}>
      <h3 className={styles.editTitle}>Update {row.name}</h3>
      <div className={styles.editGrid}>
        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label className={styles.fullWidth}>
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as IbiminaRow["status"],
              }))}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className={styles.fullWidth}>
          <span>SACCO</span>
          <select
            value={form.saccoId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, saccoId: event.target.value }))}
          >
            <option value="">Unassigned</option>
            {saccoOptions.map((sacco) => (
              <option key={sacco.id} value={sacco.id}>
                {sacco.name}
                {sacco.branchCode ? ` (${sacco.branchCode})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Quorum threshold</span>
          <input
            value={form.quorumThreshold}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                quorumThreshold: event.target.value,
              }))}
            placeholder="Default committee size"
          />
        </label>
        <label className={styles.fullWidth}>
          <span>Quorum roles</span>
          <input
            value={form.quorumRoles}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                quorumRoles: event.target.value,
              }))}
            placeholder="Comma separated roles"
          />
        </label>
      </div>
      <div className={styles.editActions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={updateMutation.isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateMutation.isLoading}>
          {updateMutation.isLoading ? "Updating…" : "Save changes"}
        </Button>
      </div>

      <div className={styles.invitePanel}>
        <div className={styles.inviteFields}>
          <label>
            <span>Issuer member ID</span>
            <input
              value={issuerMemberId}
              onChange={(event) => setIssuerMemberId(event.target.value)}
              placeholder="UUID from ibimina_members"
            />
          </label>
          <label>
            <span>TTL (minutes)</span>
            <input
              type="number"
              min={5}
              max={7_200}
              value={inviteTtl}
              onChange={(event) =>
                setInviteTtl(() => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  if (!Number.isFinite(parsed)) return DEFAULT_INVITE_TTL;
                  return Math.min(7_200, Math.max(5, parsed));
                })}
            />
          </label>
        </div>
        <div className={styles.inviteActions}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCreateInvite}
            disabled={inviteMutation.isLoading}
          >
            {inviteMutation.isLoading ? "Creating…" : "Create invite token"}
          </Button>
          {inviteResult
            ? (
              <div className={styles.inviteResults}>
                <div className={styles.inviteRow}>
                  <span>
                    <strong>Share code:</strong> {inviteResult.shareCode}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(inviteResult.shareCode, "Share code")}
                  >
                    Copy
                  </Button>
                </div>
                {inviteResult.deepLinkUrl
                  ? (
                    <div className={styles.inviteRow}>
                      <span>
                        <strong>Deep link:</strong>{" "}
                        <a
                          href={inviteResult.deepLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {inviteResult.deepLinkUrl}
                        </a>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(
                            inviteResult.deepLinkUrl ?? "",
                            "Deep link URL",
                          )}
                      >
                        Copy
                      </Button>
                    </div>
                  )
                  : null}
                {inviteResult.waShareUrl
                  ? (
                    <div className={styles.inviteRow}>
                      <span>
                        <strong>WhatsApp:</strong>{" "}
                        <a
                          href={inviteResult.waShareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open conversation
                        </a>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(
                            inviteResult.waShareUrl ?? "",
                            "WhatsApp link",
                          )}
                      >
                        Copy
                      </Button>
                    </div>
                  )
                  : null}
                <div className={styles.inviteRowMuted}>
                  <span>
                    Raw token: <code>{inviteResult.token}</code>
                  </span>
                </div>
              </div>
            )
            : null}
        </div>
      </div>
    </form>
  );
}
