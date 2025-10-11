"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/ui/Drawer";
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
import { LoanSummarySection } from "./loan-review/LoanSummarySection";
import { LoanDecisionSection } from "./loan-review/LoanDecisionSection";
import { LoanCollateralSection } from "./loan-review/LoanCollateralSection";
import { LoanTimelineSection } from "./loan-review/LoanTimelineSection";
import {
  formatCurrency,
  toIsoString,
  toLocalDateTimeInput,
} from "./loan-review/utils";

interface LoanReviewDrawerProps {
  loan: LoanRow | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export function LoanReviewDrawer(
  { loan, onClose, onUpdated }: LoanReviewDrawerProps,
) {
  const { pushToast } = useToast();

  const [status, setStatus] = useState<string>(loan?.status ?? "pending");
  const [statusReason, setStatusReason] = useState<string>(loan?.statusReason ?? "");
  const [decisionNotes, setDecisionNotes] = useState<string>(loan?.saccoDecisionNotes ?? "");
  const [scheduledAt, setScheduledAt] = useState<string>(
    toLocalDateTimeInput(loan?.disbursementScheduledAt ?? null),
  );

  const [collateralSource, setCollateralSource] = useState<string>("group_savings");
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [collateralValuation, setCollateralValuation] = useState<string>("");
  const [collateralCoverage, setCollateralCoverage] = useState<string>("");

  useEffect(() => {
    if (!loan) return;
    setStatus(loan.status);
    setStatusReason(loan.statusReason ?? "");
    setDecisionNotes(loan.saccoDecisionNotes ?? "");
    setScheduledAt(toLocalDateTimeInput(loan.disbursementScheduledAt ?? null));
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

  const handleCollateralSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!collateralAmount) {
      pushToast('Enter an amount to pledge.', 'error');
      return;
    }
    collateralMutation.mutate();
  };

  const handleApprove = () => handleStatusSubmit("approved");
  const handleReject = () => handleStatusSubmit("rejected");
  const handleDisburse = () =>
    updateMutation.mutate({ disbursedAt: new Date().toISOString() });

  return (
    <Drawer
      title={`Loan review — ${loan.member?.profile?.displayName ?? loan.id.substring(0, 8)}`}
      onClose={onClose}
    >
      <div className={styles.drawerContent}>
        <LoanSummarySection
          loan={loan}
          principalText={principalText}
          collateralText={collateralText}
          ltvDisplay={ltvDisplay}
          minLtv={minLtv}
          belowCoverage={belowCoverage}
        />

        <LoanDecisionSection
          status={status}
          statusReason={statusReason}
          decisionNotes={decisionNotes}
          scheduledAt={scheduledAt}
          canApprove={canApprove}
          canReject={canReject}
          canDisburse={canDisburse}
          isBusy={updateMutation.isLoading}
          onStatusChange={(value) => setStatus(value)}
          onStatusReasonChange={(value) => setStatusReason(value)}
          onDecisionNotesChange={(value) => setDecisionNotes(value)}
          onScheduledAtChange={(value) => setScheduledAt(value)}
          onSaveStatus={handleStatusSubmit}
          onUpdateSchedule={handleScheduleSubmit}
          onApprove={handleApprove}
          onReject={handleReject}
          onDisburse={handleDisburse}
        />

        <LoanCollateralSection
          currency={currency}
          items={collateralItems}
          form={{
            source: collateralSource,
            amount: collateralAmount,
            valuation: collateralValuation,
            coverage: collateralCoverage,
          }}
          onFormChange={{
            source: (value) => setCollateralSource(value),
            amount: (value) => setCollateralAmount(value),
            valuation: (value) => setCollateralValuation(value),
            coverage: (value) => setCollateralCoverage(value),
          }}
          onSubmit={handleCollateralSubmit}
          onRemove={(collateralId) =>
            removeCollateralMutation.mutate(collateralId)}
          isSubmitting={collateralMutation.isLoading}
          isRemoving={removeCollateralMutation.isLoading}
        />

        <LoanTimelineSection
          events={eventsQuery.data}
          isLoading={eventsQuery.isLoading}
        />
      </div>
    </Drawer>
  );
}
