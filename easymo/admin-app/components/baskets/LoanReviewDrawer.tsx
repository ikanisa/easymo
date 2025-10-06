"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/ToastProvider";
import {
  addLoanCollateral,
  deleteLoanCollateral,
  fetchLoanEvents,
  type LoanEvent,
  type LoanRow,
  type LoanUpdatePayload,
  updateLoan,
} from "@/lib/queries/baskets";
import styles from "./LoanReviewDrawer.module.css";

interface LoanReviewDrawerProps {
  loan: LoanRow | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function LoanReviewDrawer(
  { loan, onClose, onUpdated }: LoanReviewDrawerProps,
) {
  const { pushToast } = useToast();

  const [status, setStatus] = useState<string>(loan?.status ?? "pending");
  const [statusReason, setStatusReason] = useState<string>(loan?.statusReason ?? "");
  const [decisionNotes, setDecisionNotes] = useState<string>(loan?.saccoDecisionNotes ?? "");
  const [scheduledAt, setScheduledAt] = useState<string>(toLocalInputValue(loan?.disbursementScheduledAt ?? null));

  const [collateralSource, setCollateralSource] = useState<string>("group_savings");
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [collateralValuation, setCollateralValuation] = useState<string>("");
  const [collateralCoverage, setCollateralCoverage] = useState<string>("");

  useEffect(() => {
    if (!loan) return;
    setStatus(loan.status);
    setStatusReason(loan.statusReason ?? "");
    setDecisionNotes(loan.saccoDecisionNotes ?? "");
    setScheduledAt(toLocalInputValue(loan.disbursementScheduledAt ?? null));
  }, [loan]);

  const eventsQuery = useQuery<LoanEvent[]>({
    queryKey: ["baskets", "loans", "events", loan?.id],
    queryFn: () => fetchLoanEvents(loan!.id),
    enabled: Boolean(loan?.id),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: LoanUpdatePayload) => updateLoan(loan!.id, payload),
    onSuccess: async () => {
      pushToast("Loan updated.", "success");
      await onUpdated();
      await eventsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update loan.";
      pushToast(message, "error");
    },
  });

  const collateralMutation = useMutation({
    mutationFn: () => addLoanCollateral(loan!.id, {
      source: collateralSource,
      amount: Number(collateralAmount),
      coverageRatio: collateralCoverage ? Number(collateralCoverage) : undefined,
      valuation: collateralValuation ? Number(collateralValuation) : undefined,
    }),
    onSuccess: async () => {
      pushToast("Collateral added.", "success");
      setCollateralAmount("");
      setCollateralValuation("");
      setCollateralCoverage("");
      await onUpdated();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to add collateral.";
      pushToast(message, "error");
    },
  });

  const removeCollateralMutation = useMutation({
    mutationFn: (collateralId: string) => deleteLoanCollateral(loan!.id, collateralId),
    onSuccess: async () => {
      pushToast("Collateral removed.", "success");
      await onUpdated();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to remove collateral.";
      pushToast(message, "error");
    },
  });

  const collateralItems = loan?.collateral ?? [];

  const ltvDisplay = useMemo(() => {
    if (!loan) return "—";
    if (loan.principal === 0) return "—";
    const ratio = loan.collateralTotal / loan.principal;
    return `${(ratio * 100).toFixed(1)}%`;
  }, [loan]);

  const belowCoverage = useMemo(() => {
    if (!loan) return false;
    const minRequirement = loan.ikimina?.sacco?.ltvMinRatio ?? null;
    if (minRequirement == null || loan.ltvRatio == null) return false;
    return loan.ltvRatio < minRequirement;
  }, [loan]);

  if (!loan) {
    return null;
  }

  const currency = loan.currency ?? "RWF";
  const principalText = formatCurrency(loan.principal, currency);
  const collateralText = formatCurrency(loan.collateralTotal, currency);
  const minLtv = loan.ikimina?.sacco?.ltvMinRatio ?? null;

  const canApprove = loan.status === 'endorsing' || loan.status === 'pending';
  const canReject = loan.status !== 'rejected' && loan.status !== 'closed';
  const canDisburse = loan.status === 'approved' || loan.status === 'disbursed';

  const handleStatusSubmit = (nextStatus: LoanRow['status']) => {
    updateMutation.mutate({
      status: nextStatus,
      statusReason: statusReason || null,
      saccoDecisionNotes: decisionNotes || null,
    });
  };

  const handleScheduleSubmit = () => {
    updateMutation.mutate({
      disbursementScheduledAt: scheduledAt ? toIsoString(scheduledAt) : null,
    });
  };

  const handleCollateralSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!collateralAmount) {
      pushToast('Enter an amount to pledge.', 'error');
      return;
    }
    collateralMutation.mutate();
  };

  return (
    <Drawer
      title={`Loan review — ${loan.member?.profile?.displayName ?? loan.id.substring(0, 8)}`}
      onClose={onClose}
    >
      <div className={styles.drawerContent}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Summary</h3>
            <span className={styles.badge}>{loan.status}</span>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span>Principal</span>
              <div className={styles.summaryValue}>{principalText}</div>
            </div>
            <div className={styles.summaryItem}>
              <span>Tenure</span>
              <div className={styles.summaryValue}>{loan.tenureMonths} months</div>
            </div>
            <div className={styles.summaryItem}>
              <span>Rate APR</span>
              <div className={styles.summaryValue}>
                {loan.rateApr != null ? `${loan.rateApr}%` : '—'}
              </div>
            </div>
            <div className={styles.summaryItem}>
              <span>Collateral pledged</span>
              <div className={styles.summaryValue}>{collateralText}</div>
            </div>
            <div className={styles.summaryItem}>
              <span>LTV coverage</span>
              <div className={styles.summaryValue}>{ltvDisplay}</div>
            </div>
            {minLtv != null ? (
              <div className={styles.summaryItem}>
                <span>Min required LTV</span>
                <div className={styles.summaryValue}>{minLtv.toFixed(2)}x</div>
              </div>
            ) : null}
          </div>
          {belowCoverage ? (
            <p className={styles.alert}>Collateral below required coverage. Gather additional collateral or reject.</p>
          ) : null}
          {loan.purpose ? (
            <p className={styles.summaryValue}>Purpose: {loan.purpose}</p>
          ) : null}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>SACCO decision</h3>
          </div>
          <div className={`${styles.fieldGroup} ${styles.inline}`}>
            <label className={styles.field}>
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="endorsing">Endorsing</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="disbursed">Disbursed</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Disbursement scheduled</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>Status reason</span>
            <textarea
              className={styles.small}
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Internal reason or borrower-facing note"
            />
          </label>
          <label className={styles.field}>
            <span>Decision notes</span>
            <textarea
              className={styles.small}
              value={decisionNotes}
              onChange={(event) => setDecisionNotes(event.target.value)}
              placeholder="Optional notes shown in audit trail"
            />
          </label>
          <div className={styles.actionsRow}>
            <Button
              size="sm"
              onClick={() => handleStatusSubmit(status as LoanRow['status'])}
              disabled={updateMutation.isLoading}
            >
              Save status
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleScheduleSubmit}
              disabled={updateMutation.isLoading}
            >
              Update schedule
            </Button>
            {canApprove && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusSubmit('approved')}
                disabled={updateMutation.isLoading}
              >
                Approve
              </Button>
            )}
            {canReject && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleStatusSubmit('rejected')}
                disabled={updateMutation.isLoading}
              >
                Reject
              </Button>
            )}
            {canDisburse && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMutation.mutate({ disbursedAt: new Date().toISOString() })}
                disabled={updateMutation.isLoading}
              >
                Mark disbursed
              </Button>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Collateral</h3>
          </div>
          {collateralItems.length
            ? (
              <div className={styles.collateralList}>
                {collateralItems.map((item) => (
                  <div key={item.id} className={styles.collateralItem}>
                    <div>
                      <div className={styles.summaryValue}>
                        {formatCurrency(item.amount, currency)} • {item.source.replace('_', ' ')}
                      </div>
                      <div className={styles.collateralMeta}>
                        Coverage: {item.coverageRatio != null ? `${(item.coverageRatio * 100).toFixed(1)}%` : '—'}
                      </div>
                      {item.valuation != null ? (
                        <div className={styles.collateralMeta}>
                          Valuation: {formatCurrency(item.valuation, currency)}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCollateralMutation.mutate(item.id)}
                      disabled={removeCollateralMutation.isLoading}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )
            : (
              <p className={styles.emptyText}>No collateral pledged yet.</p>
            )}

          <form className={styles.fieldGroup} onSubmit={handleCollateralSubmit}>
            <div className={styles.fieldGroup + ' ' + styles.inline}>
              <label className={styles.field}>
                <span>Source</span>
                <select
                  value={collateralSource}
                  onChange={(event) => setCollateralSource(event.target.value)}
                >
                  <option value="group_savings">Group savings</option>
                  <option value="member_savings">Member savings</option>
                  <option value="guarantor">Guarantor pledge</option>
                  <option value="asset">Asset</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Amount ({currency})</span>
                <input
                  required
                  value={collateralAmount}
                  onChange={(event) => setCollateralAmount(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <label className={styles.field}>
                <span>Valuation ({currency})</span>
                <input
                  value={collateralValuation}
                  onChange={(event) => setCollateralValuation(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <label className={styles.field}>
                <span>Coverage ratio</span>
                <input
                  value={collateralCoverage}
                  onChange={(event) => setCollateralCoverage(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
            </div>
            <div className={styles.actionsRow}>
              <Button
                type="submit"
                size="sm"
                disabled={collateralMutation.isLoading}
              >
                Add collateral
              </Button>
            </div>
          </form>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Timeline</h3>
          </div>
          {eventsQuery.isLoading ? (
            <LoadingState title="Loading timeline" description="Fetching loan events." />
          ) : eventsQuery.data && eventsQuery.data.length ? (
            <div className={styles.timeline}>
              {eventsQuery.data.map((event) => (
                <div key={event.id} className={styles.timelineItem}>
                  <strong>{event.toStatus}</strong>
                  <div className={styles.timelineMeta}>
                    {new Date(event.createdAt).toLocaleString()} — {event.actorRole ?? 'system'}
                  </div>
                  {event.notes ? (
                    <div className={styles.timelineMeta}>{event.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>No timeline events recorded yet.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
