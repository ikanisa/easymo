"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./IbiminaRegistryTable.module.css";
import {
  basketsQueryKeys,
  useIbiminaQuery,
  useSaccosQuery,
  type BasketsQueryParams,
  type IbiminaRow,
  type SaccoRow,
} from "@/lib/queries/baskets";

interface IbiminaRegistryTableProps {
  params: BasketsQueryParams;
}

type EditableIkimina = Pick<
  IbiminaRow,
  'id' | 'name' | 'description' | 'status' | 'saccoId'
> & {
  quorumThreshold: string;
  quorumRoles: string;
};

const SACCO_OPTIONS_PARAMS: BasketsQueryParams = { limit: 200, status: 'active' };

export function IbiminaRegistryTable({ params }: IbiminaRegistryTableProps) {
  const [filters, setFilters] = useState<{ status: string; saccoId: string; search: string }>({
    status: 'all',
    saccoId: '',
    search: '',
  });

  const queryParams: BasketsQueryParams = useMemo(() => ({
    ...params,
    status: filters.status === 'all' ? undefined : filters.status,
    saccoId: filters.saccoId || undefined,
    search: filters.search || undefined,
  }), [filters, params]);

  const queryClient = useQueryClient();
  const ibiminaQuery = useIbiminaQuery(queryParams, { keepPreviousData: true });
  const saccoOptionsQuery = useSaccosQuery(SACCO_OPTIONS_PARAMS);
  const { pushToast } = useToast();
  const [editing, setEditing] = useState<EditableIkimina | null>(null);

  const invalidateIbimina = async () => {
    await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.ibimina(queryParams) });
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(`${label} copied to clipboard.`, 'success');
    } catch (error) {
      console.error('clipboard_copy_failed', error);
      pushToast(`Unable to copy ${label}.`, 'error');
    }
  };

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: IbiminaRow['status'] }) => {
      const response = await fetch(`/api/baskets/ibimina/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Ikimina status updated.', 'success');
      await invalidateIbimina();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update status.', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: EditableIkimina) => {
      const normalizedRoles = input.quorumRoles
        .split(',')
        .map((role) => role.trim())
        .filter((role) => role.length > 0);
      const thresholdRaw = input.quorumThreshold.trim();
      const thresholdNumber = thresholdRaw ? Number(thresholdRaw) : null;
      const safeThreshold = thresholdNumber != null && Number.isFinite(thresholdNumber)
        ? thresholdNumber
        : null;
      const quorumPayload = thresholdRaw || normalizedRoles.length
        ? {
          threshold: safeThreshold,
          roles: normalizedRoles,
        }
        : { threshold: null, roles: [] };

      const response = await fetch(`/api/baskets/ibimina/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          status: input.status,
          saccoId: input.saccoId,
          quorum: quorumPayload,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update Ikimina');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Ikimina updated.', 'success');
      setEditing(null);
      await invalidateIbimina();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update Ikimina.', 'error');
    },
  });

  const ibiminaRows = ibiminaQuery.data?.data ?? [];
  const total = ibiminaQuery.data?.total ?? 0;

  const saccoOptions: SaccoRow[] = saccoOptionsQuery.data?.data ?? [];

  const editingRow = useMemo(() => (
    editing && ibiminaRows.find((row) => row.id === editing.id)
      ? editing
      : null
  ), [editing, ibiminaRows]);

  const [issuerMemberId, setIssuerMemberId] = useState("");
  const [inviteTTL, setInviteTTL] = useState(1440);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteShareCode, setInviteShareCode] = useState<string | null>(null);
  const [inviteDeepLink, setInviteDeepLink] = useState<string | null>(null);
  const [inviteWaLink, setInviteWaLink] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    setInviteToken(null);
    setInviteShareCode(null);
    setInviteDeepLink(null);
    setInviteWaLink(null);
  }, [editingRow?.id]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} ikimina</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => invalidateIbimina()}
          disabled={ibiminaQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.filtersRow}>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label>
          <span>SACCO</span>
          <select
            value={filters.saccoId}
            onChange={(event) => setFilters((prev) => ({ ...prev, saccoId: event.target.value }))}
          >
            <option value="">All</option>
            {saccoOptions.map((sacco) => (
              <option key={sacco.id} value={sacco.id}>
                {sacco.name}
                {sacco.branchCode ? ` (${sacco.branchCode})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Name or slug"
          />
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>SACCO</th>
              <th>Committee</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ibiminaRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className={styles.slugCell}>{row.slug}</td>
                <td>
                  {row.sacco
                    ? `${row.sacco.name}${row.sacco.branchCode ? ` • ${row.sacco.branchCode}` : ''}`
                    : '—'}
                </td>
                <td className={styles.committeeCell}>
                  {(() => {
                    const expectedRoles = ['president', 'vp', 'secretary', 'treasurer'];
                    const present = row.committee.map((member) => member.role);
                    const missing = expectedRoles.filter((role) => !present.includes(role));
                    return (
                      <>
                        <span>{present.length}/4 filled</span>
                        {missing.length ? (
                          <span className={styles.committeeMissing}>
                            Missing: {missing.join(', ')}
                          </span>
                        ) : null}
                        {row.quorum ? (
                          <span className={styles.committeeMeta}>
                            Quorum: {row.quorum.threshold ?? row.committee.length}
                            {row.quorum.roles.length
                              ? ` approvals • roles: ${row.quorum.roles.join(', ')}`
                              : ' approvals'}
                          </span>
                        ) : null}
                      </>
                    );
                  })()}
                </td>
                <td>
                  <select
                    className={styles.statusSelect}
                    value={row.status}
                    onChange={(event) =>
                      statusMutation.mutate({ id: row.id, status: event.target.value as IbiminaRow['status'] })}
                    disabled={statusMutation.isLoading}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing({
                      id: row.id,
                      name: row.name,
                      description: row.description,
                      status: row.status,
                      saccoId: row.saccoId,
                    })}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRow ? (
        <form
          className={styles.editCard}
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(editingRow);
          }}
        >
          <h3 className={styles.editTitle}>Update {editingRow.name}</h3>
          <div className={styles.editGrid}>
            <label>
              <span>Name</span>
              <input
                value={editingRow.name}
                onChange={(event) => setEditing({ ...editingRow, name: event.target.value })}
              />
            </label>
            <label className={styles.fullWidth}>
              <span>Description</span>
              <textarea
                value={editingRow.description ?? ''}
                onChange={(event) => setEditing({ ...editingRow, description: event.target.value })}
                rows={3}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={editingRow.status}
                onChange={(event) =>
                  setEditing({ ...editingRow, status: event.target.value as EditableIkimina['status'] })}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label className={styles.fullWidth}>
              <span>SACCO</span>
              <select
                value={editingRow.saccoId ?? ''}
                onChange={(event) =>
                  setEditing({ ...editingRow, saccoId: event.target.value || null })}
              >
                <option value="">Unassigned</option>
                {saccoOptions.map((sacco) => (
                  <option key={sacco.id} value={sacco.id}>
                    {sacco.name} {sacco.branchCode ? `(${sacco.branchCode})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.editActions}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? 'Updating…' : 'Save changes'}
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
                  max={7200}
                  value={inviteTTL}
                  onChange={(event) => setInviteTTL(Number(event.target.value))}
                />
              </label>
            </div>
            <div className={styles.inviteActions}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!issuerMemberId) {
                    pushToast('Provide issuer member ID before creating an invite.', 'error');
                    return;
                  }
                  setCreatingInvite(true);
                  try {
                    const response = await fetch('/api/baskets/invites', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ikiminaId: editingRow.id,
                        issuerMemberId,
                        ttlMinutes: inviteTTL,
                      }),
                    });
                    if (!response.ok) {
                      const data = await response.json().catch(() => null);
                      pushToast(data?.message ?? 'Failed to create invite.', 'error');
                      return;
                    }
                    const data = await response.json();
                    setInviteToken(data.token ?? null);
                    setInviteShareCode(data.shareCode ?? null);
                    setInviteDeepLink(data.deepLinkUrl ?? null);
                    setInviteWaLink(data.waShareUrl ?? null);
                    pushToast('Invite created.', 'success');
                  } catch (error) {
                    console.error('basket_invite_create_failed', error);
                    pushToast('Unexpected error while creating invite.', 'error');
                  } finally {
                    setCreatingInvite(false);
                  }
                }}
                disabled={creatingInvite}
              >
                {creatingInvite ? 'Creating…' : 'Create invite token'}
              </Button>
              {inviteShareCode ? (
                <div className={styles.inviteResults}>
                  <div className={styles.inviteRow}>
                    <span>
                      <strong>Share code:</strong> {inviteShareCode}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(inviteShareCode, 'Share code')}
                    >
                      Copy
                    </Button>
                  </div>
                  {inviteDeepLink ? (
                    <div className={styles.inviteRow}>
                      <span>
                        <strong>Deep link:</strong>{' '}
                        <a href={inviteDeepLink} target="_blank" rel="noopener noreferrer">
                          {inviteDeepLink}
                        </a>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(inviteDeepLink, 'Deep link URL')}
                      >
                        Copy
                      </Button>
                    </div>
                  ) : null}
                  {inviteWaLink ? (
                    <div className={styles.inviteRow}>
                      <span>
                        <strong>WhatsApp:</strong>{' '}
                        <a href={inviteWaLink} target="_blank" rel="noopener noreferrer">
                          Open conversation
                        </a>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(inviteWaLink, 'WhatsApp link')}
                      >
                        Copy
                      </Button>
                    </div>
                  ) : null}
                  {inviteToken ? (
                    <div className={styles.inviteRowMuted}>
                      <span>
                        Raw token:{' '}
                        <code>{inviteToken}</code>
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
