"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { Copy, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { runInsuranceSimulation } from "@/lib/insurance/insurance-workbench-service";
import {
  type InsuranceSimulationResult,
  type InsuranceSimulationQuote,
  type InsuranceRequest,
  type InsuranceDocument,
  type InsurancePolicy,
  type InsurancePayment,
} from "@/lib/schemas";
import { getInsuranceServiceUrl } from "@/lib/env-client";
import { getAdminApiPath } from "@/lib/routes";
import { apiFetch } from "@/lib/api/client";
import {
  useInsuranceRequestsQuery,
  useCreateInsuranceRequestMutation,
  useInsuranceDocumentsQuery,
  useInsurancePoliciesQuery,
  useInsurancePaymentsQuery,
  useInsuranceQuotesQuery as usePersistedQuotesQuery,
} from "@/lib/queries/insurance";

const COVER_OPTIONS = [
  { value: "COMPREHENSIVE", label: "Comprehensive (OD, theft, fire, and TP)" },
  { value: "OD_THEFT_FIRE", label: "Own damage, theft, and fire" },
  { value: "MD_ONLY", label: "Material damage only" },
  { value: "THEFT_ONLY", label: "Theft only" },
  { value: "FIRE_ONLY", label: "Fire only" },
  { value: "TP_ONLY", label: "Third party only" },
];

const VEHICLE_CATEGORIES = [
  "CAR",
  "JEEP_SUV",
  "PICKUP_SMALL_LORRY",
  "MINIBUS_VAN",
  "BUS",
  "MOTORCYCLE",
  "TRICYCLE",
  "TRUCK_LORRY_5T_PLUS",
  "TRAILER",
  "HOWO_SHACMAN_FUSO_FAW",
  "TRACTOR",
  "SPECIAL_ENGINE",
];

const USAGE_OPTIONS = [
  "PRIVATE",
  "TAXI_PSV",
  "HIRE",
  "SCHOOL_BUS",
  "COMMERCIAL_GOODS",
  "DRIVING_SCHOOL",
];

const OWNER_TYPES = ["INDIVIDUAL", "CORPORATE"];

const OCCUPANT_PLANS = [
  { value: 1, label: "Plan I – 1M RWF" },
  { value: 2, label: "Plan II – 2M RWF" },
  { value: 3, label: "Plan III – 3M RWF" },
  { value: 4, label: "Plan IV – 4M RWF" },
  { value: 5, label: "Plan V – 5M RWF" },
];

const DOCUMENT_KIND_OPTIONS = [
  { value: "yellow_card", label: "Yellow card" },
  { value: "logbook", label: "Logbook" },
  { value: "renewal_certificate", label: "Renewal certificate" },
  { value: "vehicle_photos", label: "Vehicle photos" },
  { value: "other", label: "Other" },
];

type InsuranceFormState = {
  sumInsured: number;
  vehicleCategory: string;
  usageType: string;
  seats: number;
  passengerSeatsAboveDriver: number;
  ownerType: (typeof OWNER_TYPES)[number];
  vehicleAgeYears: number;
  coverSelection: string;
  wantsComesa: boolean;
  comesaPassengers: number;
  theftTerritorialExtension: boolean;
  periodDays: number;
  goodsAreFlammable: boolean;
  governmentExcessWaiver: boolean;
  occupantEnabled: boolean;
  occupantPlan: number;
  occupantCount: number;
};

const DEFAULT_FORM: InsuranceFormState = {
  sumInsured: 20_000_000,
  vehicleCategory: "CAR",
  usageType: "PRIVATE",
  seats: 5,
  passengerSeatsAboveDriver: 4,
  ownerType: "INDIVIDUAL",
  vehicleAgeYears: 5,
  coverSelection: "COMPREHENSIVE",
  wantsComesa: false,
  comesaPassengers: 4,
  theftTerritorialExtension: false,
  periodDays: 365,
  goodsAreFlammable: false,
  governmentExcessWaiver: false,
  occupantEnabled: false,
  occupantPlan: 1,
  occupantCount: 4,
};

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatRwf(amount: number) {
  return currencyFormatter.format(Math.round(amount));
}

export function InsuranceWorkbench() {
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<InsuranceFormState>(DEFAULT_FORM);
  const [result, setResult] = useState<InsuranceSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState({ contactId: "", vehiclePlate: "", notes: "" });
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestKind, setIngestKind] = useState("other");
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const serviceReady = Boolean(getInsuranceServiceUrl());

  const requestParams = useMemo(() => ({ limit: 25 }), []);
  const requestsQuery = useInsuranceRequestsQuery(requestParams);
  const createRequestMutation = useCreateInsuranceRequestMutation(requestParams, {
    onSuccess: (response) => {
      requestsQuery.refetch();
      setSelectedRequestId(response.data.id);
      setNewRequest({ contactId: "", vehiclePlate: "", notes: "" });
      setRequestError(null);
      setRequestMessage("Request submitted.");
    },
  });

  const documentsParams = useMemo(
    () => (selectedRequestId ? { intentId: selectedRequestId, limit: 50 } : { limit: 50 }),
    [selectedRequestId],
  );
  const documentsQuery = useInsuranceDocumentsQuery(documentsParams);

  const persistedQuotesParams = useMemo(
    () => (selectedRequestId ? { intentId: selectedRequestId, limit: 25 } : { limit: 25 }),
    [selectedRequestId],
  );
  const persistedQuotesQuery = usePersistedQuotesQuery(persistedQuotesParams);

  const policiesQuery = useInsurancePoliciesQuery({ limit: 25 });
  const paymentsParams = useMemo(
    () => (selectedRequestId ? { intentId: selectedRequestId, limit: 25 } : { limit: 25 }),
    [selectedRequestId],
  );
  const paymentsQuery = useInsurancePaymentsQuery(paymentsParams);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedRequestId) {
      const first = requestsQuery.data?.data?.[0]?.id;
      if (first) {
        setSelectedRequestId(first);
      }
    }
  }, [requestsQuery.data, selectedRequestId]);

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id);
  };

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestMessage(null);
    setRequestError(null);
    try {
      await createRequestMutation.mutateAsync({
        contactId: newRequest.contactId ? newRequest.contactId : undefined,
        status: "collecting",
        vehiclePlate: newRequest.vehiclePlate || null,
        notes: newRequest.notes || null,
      });
    } catch (mutationError) {
      const message = mutationError instanceof Error
        ? mutationError.message
        : "We couldn’t submit the request. Try again.";
      setRequestError(message);
    }
  };

  const handleIngestSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRequestId) {
      setIngestError("Select a request before attaching documents.");
      return;
    }
    if (!ingestUrl.trim()) {
      setIngestError("Enter a media URL to ingest.");
      return;
    }
    setIngestError(null);
    setIngesting(true);
    try {
      await apiFetch(getAdminApiPath("insurance", "ingest_media"), {
        method: "POST",
        body: {
          intent_id: selectedRequestId,
          wa_media_url: ingestUrl.trim(),
          kind: ingestKind || "other",
        },
      });
      setIngestUrl("");
      documentsQuery.refetch();
    } catch (ingestErr) {
      const message = ingestErr instanceof Error
        ? ingestErr.message
        : "We couldn’t ingest the document. Try again.";
      setIngestError(message);
    } finally {
      setIngesting(false);
    }
  };

  const handleQueueOcr = async () => {
    const docs = documentsQuery.data?.data ?? [];
    if (!docs.length) {
      setOcrMessage("No documents are ready for OCR yet.");
      return;
    }
    try {
      setOcrMessage(null);
      await apiFetch(getAdminApiPath("insurance", "ocr"), {
        method: "POST",
        body: { document_ids: docs.map((doc) => doc.id) },
      });
      setOcrMessage("We queued an OCR run.");
    } catch (queueError) {
      const message = queueError instanceof Error
        ? queueError.message
        : "We couldn’t queue OCR. Try again.";
      setOcrMessage(message);
    }
  };

  const handleFilesAdded = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length) {
      setFiles((prev) => [...prev, ...selected]);
    }
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedValue(value);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedValue(null);
      }, 2000);
    } catch {
      setCopiedValue(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPersistMessage(null);
    setPersistError(null);
    try {
      const simulation = await runInsuranceSimulation({
        files,
        fields: {
          sumInsured: form.sumInsured,
          vehicleCategory: form.vehicleCategory,
          usageType: form.usageType,
          seats: form.seats,
          passengerSeatsAboveDriver: form.passengerSeatsAboveDriver,
          ownerType: form.ownerType,
          vehicleAgeYears: form.vehicleAgeYears,
          coverSelection: form.coverSelection,
          wantsComesa: form.wantsComesa,
          comesaPassengers: form.comesaPassengers,
          theftTerritorialExtension: form.theftTerritorialExtension,
          periodDays: form.periodDays,
          goodsAreFlammable: form.goodsAreFlammable,
          governmentExcessWaiver: form.governmentExcessWaiver,
          occupantEnabled: form.occupantEnabled,
          occupantPlan: form.occupantPlan,
          occupantCount: form.occupantCount,
        },
      });
      setResult(simulation);
      if (simulation.result.quotes.length) {
        try {
          const payload = simulation.result.quotes.map((quote) => ({
            insurer: quote.providerName,
            premium: quote.grossPremium,
            status: "pending",
            uploadedDocs: [],
            reviewerComment: selectedRequestId ? `intent:${selectedRequestId}` : null,
          }));
          await apiFetch(getAdminApiPath("insurance", "quotes"), {
            method: "POST",
            body: { quotes: payload },
          });
          setPersistMessage("We saved the simulation results to Supabase.");
          await persistedQuotesQuery.refetch();
        } catch (persistErr) {
          const message = persistErr instanceof Error
            ? persistErr.message
            : "We couldn’t persist the quotes. Try again.";
          setPersistError(message);
        }
      }
    } catch (simulationError) {
      const message = simulationError instanceof Error
        ? simulationError.message
        : "We couldn’t run the insurance pricing simulation.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const docSummary = useMemo(() => {
    if (!result?.doc) return [];
    const doc = result.doc;
    const rows: Array<{ label: string; value: string | number }> = [];
    if (doc.plateNumber) rows.push({ label: "Plate", value: doc.plateNumber });
    if (doc.vin) rows.push({ label: "VIN", value: doc.vin });
    if (doc.make || doc.model) {
      rows.push({ label: "Make/Model", value: [doc.make, doc.model].filter(Boolean).join(" ") });
    }
    if (doc.bodyType) rows.push({ label: "Body type", value: doc.bodyType });
    if (doc.year) rows.push({ label: "Year", value: doc.year });
    if (doc.usageHint) rows.push({ label: "Usage hint", value: doc.usageHint });
    if (doc.seats) rows.push({ label: "Seats", value: doc.seats });
    if (doc.passengersAboveDriver !== undefined && doc.passengersAboveDriver !== null) {
      rows.push({ label: "Passengers above driver", value: doc.passengersAboveDriver });
    }
    if (doc.sumInsuredHint) rows.push({ label: "Sum insured hint", value: doc.sumInsuredHint });
    if (doc.ownerType) rows.push({ label: "Owner type", value: doc.ownerType });
    if (doc.previousInsurer) rows.push({ label: "Previous insurer", value: doc.previousInsurer });
    return rows;
  }, [result]);

  const inputSummary = useMemo(() => {
    if (!result?.inputs) return [];
    const inputs = result.inputs;
    const rows: Array<{ label: string; value: string | number }> = [
      { label: "Vehicle category", value: inputs.vehicleCategory },
      { label: "Usage", value: inputs.usageType },
      { label: "Seats", value: inputs.seats },
      {
        label: "Passengers above driver",
        value: inputs.passengerSeatsAboveDriver,
      },
      { label: "Owner type", value: inputs.ownerType },
      { label: "Vehicle age (years)", value: inputs.vehicleAgeYears },
      { label: "Cover", value: inputs.coverSelection },
      { label: "Sum insured", value: formatRwf(inputs.sumInsured) },
      { label: "Period (days)", value: inputs.periodDays },
      { label: "COMESA", value: inputs.wantsComesa ? "Enabled" : "No" },
      {
        label: "COMESA passengers",
        value: inputs.comesaPassengers,
      },
      {
        label: "Theft territorial extension",
        value: inputs.theftTerritorialExtension ? "Enabled" : "No",
      },
      {
        label: "Goods flammable",
        value: inputs.goodsAreFlammable ? "Yes" : "No",
      },
      {
        label: "Gov excess waiver",
        value: inputs.governmentExcessWaiver ? "Yes" : "No",
      },
    ];
    if (inputs.occupantCover?.enabled) {
      rows.push({
        label: "Occupant cover",
        value: `Plan ${inputs.occupantCover.plan} for ${inputs.occupantCover.occupants} seats`,
      });
    }
    return rows;
  }, [result]);

  const quotes = result?.result.quotes ?? [];
  const requestItems = requestsQuery.data?.data ?? [];
  const documentItems = documentsQuery.data?.data ?? [];
  const persistedQuotes = persistedQuotesQuery.data?.data ?? [];
  const policyItems = policiesQuery.data?.data ?? [];
  const paymentItems = paymentsQuery.data?.data ?? [];
  const policiesDisabled = Boolean(policiesQuery.data?.disabled);
  const paymentsDisabled = Boolean(paymentsQuery.data?.disabled);

  const handleRefreshWorkflow = () => {
    void persistedQuotesQuery.refetch();
    void policiesQuery.refetch();
    void paymentsQuery.refetch();
  };

  const workflowRefreshing =
    persistedQuotesQuery.isFetching || policiesQuery.isFetching || paymentsQuery.isFetching;

  return (
    <div className="space-y-6">
      {!serviceReady
        ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Configure <code>NEXT_PUBLIC_INSURANCE_SERVICE_URL</code> (or <code>INSURANCE_SERVICE_URL</code>) to enable the live pricing engine. The mock queue below remains available for UI review.
          </div>
        )
        : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Requests</h3>
              <p className="text-sm text-slate-600">
                Select the active intent to attach OCR, quotes, and payments.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void requestsQuery.refetch();
              }}
              disabled={requestsQuery.isFetching}
            >
              {requestsQuery.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {requestsQuery.isLoading
              ? (
                <p className="text-sm text-slate-500">Loading requests…</p>
              )
              : requestsQuery.isError
                ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">
                      {requestsQuery.error instanceof Error
                        ? requestsQuery.error.message
                        : "We couldn’t load requests. Try again."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void requestsQuery.refetch();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                )
                : requestItems.length
                  ? (
                    <ul className="space-y-2">
                      {requestItems.map((request) => {
                        const createdAt = new Date(request.createdAt).toLocaleString();
                        return (
                          <li key={request.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectRequest(request.id)}
                              className={classNames(
                                "w-full rounded border px-3 py-2 text-left transition",
                                selectedRequestId === request.id
                                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                  : "border-slate-200 hover:border-slate-300",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide">
                                  {request.status || "unknown"}
                                </span>
                                <span
                                  className={classNames(
                                    "text-xs",
                                    selectedRequestId === request.id
                                      ? "text-white/80"
                                      : "text-slate-500",
                                  )}
                                >
                                  {createdAt}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span
                                  className={classNames(
                                    "font-medium",
                                    selectedRequestId === request.id
                                      ? "text-white"
                                      : "text-slate-700",
                                  )}
                                >
                                  {request.vehiclePlate ?? "Plate unknown"}
                                </span>
                                {request.contactId
                                  ? (
                                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
                                      Contact
                                    </span>
                                  )
                                  : null}
                              </div>
                              {request.notes
                                ? (
                                  <p
                                    className={classNames(
                                      "mt-1 text-xs",
                                      selectedRequestId === request.id
                                        ? "text-white/80"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {request.notes}
                                  </p>
                                )
                                : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )
                  : (
                    <p className="text-sm text-slate-500">No insurance requests yet.</p>
                  )}
            {requestMessage
              ? (
                <p className="text-sm text-emerald-600">{requestMessage}</p>
              )
              : null}
            {requestError
              ? (
                <p className="text-sm text-red-600">{requestError}</p>
              )
              : null}
          </div>
          <form className="mt-4 space-y-3 border-t border-slate-200 pt-4" onSubmit={handleCreateRequest}>
            <h4 className="text-sm font-semibold text-slate-700">Create request</h4>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Contact ID (optional)
              <input
                value={newRequest.contactId}
                onChange={(event) => setNewRequest((prev) => ({ ...prev, contactId: event.target.value }))}
                placeholder="UUID for the contact"
                className="mt-1 rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Vehicle plate (optional)
              <input
                value={newRequest.vehiclePlate}
                onChange={(event) => setNewRequest((prev) => ({ ...prev, vehiclePlate: event.target.value }))}
                placeholder="e.g. RAD123X"
                className="mt-1 rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Notes for reviewers
              <textarea
                value={newRequest.notes}
                onChange={(event) => setNewRequest((prev) => ({ ...prev, notes: event.target.value }))}
                rows={2}
                placeholder="Context or special instructions"
                className="mt-1 rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <Button type="submit" disabled={createRequestMutation.isPending}>
              {createRequestMutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Stored documents</h3>
              <p className="text-sm text-slate-600">
                Push WhatsApp uploads to Supabase storage, then queue them for OCR.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void documentsQuery.refetch();
              }}
              disabled={documentsQuery.isFetching}
            >
              {documentsQuery.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleIngestSubmit}>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Media URL
              <input
                value={ingestUrl}
                onChange={(event) => setIngestUrl(event.target.value)}
                placeholder="https://..."
                className="mt-1 rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Document kind
              <select
                value={ingestKind}
                onChange={(event) => setIngestKind(event.target.value)}
                className="mt-1 rounded border border-slate-300 px-3 py-2"
              >
                {DOCUMENT_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {ingestError
              ? (
                <p className="text-sm text-red-600">{ingestError}</p>
              )
              : null}
            <Button type="submit" disabled={ingesting}>
              {ingesting ? "Uploading…" : "Ingest media"}
            </Button>
          </form>
          <div className="mt-4 space-y-3">
            {documentItems.length
              ? (
                <ul className="space-y-2 text-sm">
                  {documentItems.map((document) => (
                    <li
                      key={document.id}
                      className="rounded border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-800">{document.kind}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {document.ocrState}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {document.storagePath}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(document.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )
              : (
                <p className="text-sm text-slate-500">No stored documents for this intent yet.</p>
              )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleQueueOcr}>
                Queue OCR run
              </Button>
              {ocrMessage
                ? (
                  <span className="text-sm text-slate-600">{ocrMessage}</span>
                )
                : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Persisted quotes and workflow</h3>
              <p className="text-sm text-slate-600">
                View Supabase rows for quotes, policies, and payments tied to this intent.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshWorkflow}
              disabled={workflowRefreshing}
            >
              {workflowRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {persistMessage
              ? (
                <p className="text-emerald-600">{persistMessage}</p>
              )
              : null}
            {persistError
              ? (
                <p className="text-red-600">{persistError}</p>
              )
              : null}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Quotes</h4>
              {persistedQuotesQuery.isLoading
                ? (
                  <p className="text-slate-500">Loading quotes…</p>
                )
                : persistedQuotesQuery.isError
                  ? (
                    <p className="text-red-600">
                      {persistedQuotesQuery.error instanceof Error
                        ? persistedQuotesQuery.error.message
                        : "We couldn’t load quotes. Try again."}
                    </p>
                  )
                  : persistedQuotes.length
                    ? (
                      <ul className="space-y-2">
                        {persistedQuotes.map((quote) => (
                          <li
                            key={quote.id}
                            className="rounded border border-slate-200 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-slate-800">
                                {quote.insurer ?? "Unknown insurer"}
                              </span>
                              <span className="text-xs uppercase tracking-wide text-slate-500">
                                {quote.status}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>
                                {quote.premium
                                  ? `${formatRwf(quote.premium)} premium`
                                  : "Premium pending"}
                              </span>
                              {quote.reviewerComment
                                ? (
                                  <span className="truncate">
                                    {quote.reviewerComment}
                                  </span>
                                )
                                : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                    : (
                      <p className="text-slate-500">No quotes stored yet.</p>
                    )}
            </section>
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Policies</h4>
              {policiesDisabled
                ? (
                  <p className="text-slate-500">Policies table is unavailable in this environment.</p>
                )
                : policiesQuery.isLoading
                  ? (
                    <p className="text-slate-500">Loading policies…</p>
                  )
                  : policiesQuery.isError
                    ? (
                      <p className="text-red-600">
                        {policiesQuery.error instanceof Error
                          ? policiesQuery.error.message
                          : "We couldn’t load policies. Try again."}
                      </p>
                    )
                    : policyItems.length
                      ? (
                        <ul className="space-y-2">
                          {policyItems.map((policy) => (
                            <li
                              key={policy.id}
                              className="rounded border border-slate-200 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-800">
                                  {policy.policyNumber}
                                </span>
                                <span className="text-xs uppercase tracking-wide text-slate-500">
                                  {policy.status}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span>{policy.insurer ?? "Insurer pending"}</span>
                                {policy.premiumTotalMinor != null
                                  ? (
                                    <span>{formatRwf(policy.premiumTotalMinor)} premium</span>
                                  )
                                  : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                      : (
                        <p className="text-slate-500">No policies issued yet.</p>
                      )}
            </section>
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Payments</h4>
              {paymentsDisabled
                ? (
                  <p className="text-slate-500">Payments table is unavailable in this environment.</p>
                )
                : paymentsQuery.isLoading
                  ? (
                    <p className="text-slate-500">Loading payments…</p>
                  )
                  : paymentsQuery.isError
                    ? (
                      <p className="text-red-600">
                        {paymentsQuery.error instanceof Error
                          ? paymentsQuery.error.message
                          : "We couldn’t load payments. Try again."}
                      </p>
                    )
                    : paymentItems.length
                      ? (
                        <ul className="space-y-2">
                          {paymentItems.map((payment) => (
                            <li
                              key={payment.id}
                              className="rounded border border-slate-200 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-800">
                                  {payment.currency && payment.currency !== "RWF"
                                    ? `${payment.amount.toLocaleString()} ${payment.currency}`
                                    : formatRwf(payment.amount)}
                                </span>
                                <span className="text-xs uppercase tracking-wide text-slate-500">
                                  {payment.status}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                {payment.channel ? <span>{payment.channel}</span> : null}
                                {payment.reference ? <span>Ref: {payment.reference}</span> : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                      : (
                        <p className="text-slate-500">No payments recorded yet.</p>
                      )}
            </section>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Document intake</h3>
              <p className="text-sm text-slate-600">
                Yellow card, logbook, renewal certificate, or vehicle photos (PNG/JPG/PDF).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Add files
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="sr-only"
            onChange={handleFilesAdded}
          />
          <ul className="mt-4 space-y-2 text-sm">
            {files.length === 0
              ? (
                <li className="text-slate-500">
                  No documents selected yet. Attach at least one scan/photo for OCR or rely on manual inputs.
                </li>
              )
              : files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                >
                  <span className="truncate pr-3 font-medium">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove {file.name}</span>
                  </Button>
                </li>
              ))}
          </ul>
          {files.length
            ? (
              <div className="mt-3 text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => setFiles([])}>
                  Clear all
                </Button>
              </div>
            )
            : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">OCR summary</h3>
            {docSummary.length === 0
              ? (
                <p className="mt-2 text-sm text-slate-600">
                  Run a simulation to preview extracted fields. Missing values are requested from the operator automatically.
                </p>
              )
              : (
                <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {docSummary.map((item) => (
                    <div key={item.label}>
                      <dt className="font-medium text-slate-700">{item.label}</dt>
                      <dd className="text-slate-900">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">Inputs used</h3>
            {inputSummary.length === 0
              ? (
                <p className="mt-2 text-sm text-slate-600">
                  Inputs appear here after the next run. Adjust the form below to override defaults before quoting.
                </p>
              )
              : (
                <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {inputSummary.map((item) => (
                    <div key={item.label}>
                      <dt className="font-medium text-slate-700">{item.label}</dt>
                      <dd className="text-slate-900">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm font-medium">
            Sum insured (RWF)
            <input
              type="number"
              min={0}
              step={100_000}
              value={form.sumInsured}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sumInsured: Number(event.target.value) || 0 }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            Vehicle category
            <select
              value={form.vehicleCategory}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, vehicleCategory: event.target.value }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            >
              {VEHICLE_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium">
            Usage
            <select
              value={form.usageType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  usageType: event.target.value,
                  goodsAreFlammable: event.target.value === "COMMERCIAL_GOODS"
                    ? prev.goodsAreFlammable
                    : false,
                }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            >
              {USAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium">
            Seats (incl. driver)
            <input
              type="number"
              min={1}
              value={form.seats}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, seats: Number(event.target.value) || 0 }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            Passenger seats above driver
            <input
              type="number"
              min={0}
              value={form.passengerSeatsAboveDriver}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  passengerSeatsAboveDriver: Number(event.target.value) || 0,
                }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            Owner type
            <select
              value={form.ownerType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ownerType: event.target.value as InsuranceFormState["ownerType"] }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            >
              {OWNER_TYPES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium">
            Vehicle age (years)
            <input
              type="number"
              min={0}
              value={form.vehicleAgeYears}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, vehicleAgeYears: Number(event.target.value) || 0 }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            Cover selection
            <select
              value={form.coverSelection}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, coverSelection: event.target.value }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            >
              {COVER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium">
            Period (days)
            <input
              type="number"
              min={1}
              value={form.periodDays}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, periodDays: Number(event.target.value) || 1 }))}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.wantsComesa}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  wantsComesa: event.target.checked,
                }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            COMESA extension
          </label>
          <label className="flex flex-col text-sm font-medium">
            COMESA passengers
            <input
              type="number"
              min={0}
              value={form.comesaPassengers}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  comesaPassengers: Number(event.target.value) || 0,
                }))}
              disabled={!form.wantsComesa}
              className="mt-1 rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.theftTerritorialExtension}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  theftTerritorialExtension: event.target.checked,
                }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Theft territorial extension
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.goodsAreFlammable}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  goodsAreFlammable: event.target.checked,
                }))}
              disabled={form.usageType !== "COMMERCIAL_GOODS"}
              className="h-4 w-4 rounded border-slate-300 disabled:bg-slate-100"
            />
            Flammable goods (+20% TP)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.governmentExcessWaiver}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  governmentExcessWaiver: event.target.checked,
                }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Government excess waiver
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.occupantEnabled}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  occupantEnabled: event.target.checked,
                }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Occupant / Personal Accident cover
          </label>
        </div>

        {form.occupantEnabled
          ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col text-sm font-medium">
                Plan
                <select
                  value={form.occupantPlan}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      occupantPlan: Number(event.target.value) || 1,
                    }))}
                  className="mt-1 rounded border border-slate-300 px-3 py-2"
                >
                  {OCCUPANT_PLANS.map((plan) => (
                    <option key={plan.value} value={plan.value}>{plan.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm font-medium">
                Occupants covered
                <input
                  type="number"
                  min={1}
                  value={form.occupantCount}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      occupantCount: Number(event.target.value) || 1,
                    }))}
                  className="mt-1 rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          )
          : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!serviceReady || loading}>
            Run multi-insurer pricing
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setForm(DEFAULT_FORM);
              setResult(null);
              setError(null);
            }}
          >
            Reset form
          </Button>
        </div>
      </form>

      {error
        ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )
        : null}

      {loading
        ? (
          <LoadingState
            title="Running pricing engine"
            description="Uploading documents, parsing OCR, and requesting quotes from BK, Old Mutual, Prime, and Radiant."
          />
        )
        : null}

      {quotes.length > 0
        ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">
              Quotes retrieved ({quotes.length})
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {quotes.map((quote) => (
                <QuoteCard
                  key={quote.providerName}
                  quote={quote}
                  copiedValue={copiedValue}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </div>
        )
        : null}
    </div>
  );
}

function QuoteCard(
  { quote, copiedValue, onCopy }: {
    quote: InsuranceSimulationQuote;
    copiedValue: string | null;
    onCopy: (value: string) => Promise<void> | void;
  },
) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase text-slate-500">Insurer</p>
          <h4 className="text-lg font-semibold">{quote.providerName}</h4>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total premium</p>
          <p className="text-xl font-semibold text-slate-900">{formatRwf(quote.grossPremium)}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {quote.breakdown.map((item) => (
          <div key={`${quote.providerName}-${item.label}`} className="flex justify-between gap-3">
            <dt className="text-slate-600">{item.label}</dt>
            <dd className="font-medium text-slate-900">{formatRwf(item.amount)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-700">Mandatory excess</p>
        <p className="text-slate-700">
          {Math.round(quote.mandatoryExcessApplicable.md_percent_of_claim * 100)}% MD ·{" "}
          {Math.round(quote.mandatoryExcessApplicable.theft_fire_percent_total_loss * 100)}% Theft/Fire ·
          Min {formatRwf(quote.mandatoryExcessApplicable.minimum_rwf)}
        </p>
      </div>

      {quote.installmentOptions.length
        ? (
          <div className="mt-4 text-sm">
            <p className="font-medium text-slate-700">Installment options</p>
            <ul className="mt-1 space-y-1">
              {quote.installmentOptions.map((plan) => (
                <li key={plan.name} className="text-slate-700">
                  <strong>{plan.name}:</strong>{" "}
                  {plan.tranches.map((t) => `${t.percent}% @ ${t.atMonth}m`).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )
        : null}

      {quote.momo ? (
        (() => {
          const momo = quote.momo!;
          return (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-900">MoMo payment</p>
          <p className="text-emerald-900">Dial {momo.ussd}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCopy(momo.ussd)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy USSD
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={momo.tel}>Open dialer</a>
            </Button>
          </div>
          {copiedValue === momo.ussd ? (
            <p className="mt-1 text-xs text-emerald-800">Copied!</p>
          ) : null}
        </div>
          );
        })()
      ) : null}

      {quote.insurerProfile
        ? (
          <div className="mt-4 text-sm text-slate-700">
            <p className="font-medium">Contacts</p>
            <p>{quote.insurerProfile.supportPhone}</p>
            <p>{quote.insurerProfile.supportEmail}</p>
            <p>{quote.insurerProfile.claimsEmail}</p>
          </div>
        )
        : null}

      {quote.warnings?.length
        ? (
          <ul className="mt-4 list-inside list-disc text-sm text-amber-700">
            {quote.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )
        : null}
    </div>
  );
}
