"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { runInsuranceSimulation } from "@/lib/insurance/insurance-workbench-service";
import {
  type InsuranceSimulationResult,
  type InsuranceSimulationQuote,
} from "@/lib/schemas";
import { getInsuranceServiceUrl } from "@/lib/env-client";

const COVER_OPTIONS = [
  { value: "COMPREHENSIVE", label: "Comprehensive (OD, Theft, Fire & TP)" },
  { value: "OD_THEFT_FIRE", label: "Own damage + Theft + Fire" },
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const serviceReady = Boolean(getInsuranceServiceUrl());

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
    } catch (simulationError) {
      const message = simulationError instanceof Error
        ? simulationError.message
        : "Failed to run insurance pricing.";
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

  return (
    <div className="space-y-6">
      {!serviceReady
        ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Configure <code>NEXT_PUBLIC_INSURANCE_SERVICE_URL</code> (or <code>INSURANCE_SERVICE_URL</code>) to enable the live pricing engine. The mock queue below remains available for UI review.
          </div>
        )
        : null}

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
