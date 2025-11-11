"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import {
  calculatePremiums,
  describeOcrConfidence,
  InsuranceInstallment,
  InsurancePremiumInputs,
} from "@/lib/insurance/premium-calculator";
import { InsuranceComparisonQuote } from "@/lib/schemas";

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

const wizardSteps = [
  "Upload and OCR",
  "Vehicle and cover",
  "Add-ons and installments",
  "Compare",
  "Review",
  "Payment",
  "Issuance",
] as const;

type WizardStep = (typeof wizardSteps)[number];

interface VehicleDetails {
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  bodyType: string;
  usage: string;
  year: number;
}

interface WizardState {
  files: File[];
  ocrConfidence: number | null;
  vehicle: VehicleDetails;
  sumInsured: number;
  coverType: string;
  usage: string;
  seats: number;
  vehicleAgeYears: number;
  periodDays: number;
  comesa: boolean;
  comesaPassengers: number;
  theftExtension: boolean;
  governmentWaiver: boolean;
  occupantEnabled: boolean;
  occupantPlan: number;
  occupantCount: number;
  installmentMonths: number;
  notes: string;
}

const DEFAULT_STATE: WizardState = {
  files: [],
  ocrConfidence: null,
  vehicle: {
    plateNumber: "",
    vin: "",
    make: "",
    model: "",
    bodyType: "",
    usage: "PRIVATE",
    year: new Date().getFullYear() - 5,
  },
  sumInsured: 20_000_000,
  coverType: "COMPREHENSIVE",
  usage: "PRIVATE",
  seats: 5,
  vehicleAgeYears: 5,
  periodDays: 365,
  comesa: false,
  comesaPassengers: 4,
  theftExtension: false,
  governmentWaiver: false,
  occupantEnabled: false,
  occupantPlan: 1,
  occupantCount: 4,
  installmentMonths: 12,
  notes: "",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

function buildPremiumInputs(state: WizardState): InsurancePremiumInputs {
  return {
    sumInsured: state.sumInsured,
    coverType: state.coverType,
    usage: state.usage,
    vehicleAgeYears: state.vehicleAgeYears,
    seats: state.seats,
    periodDays: state.periodDays,
    comesa: state.comesa,
    comesaPassengers: state.comesaPassengers,
    theftExtension: state.theftExtension,
    governmentWaiver: state.governmentWaiver,
    occupantPlan: state.occupantEnabled ? state.occupantPlan : null,
    occupantCount: state.occupantEnabled ? state.occupantCount : undefined,
    installmentMonths: state.installmentMonths,
  };
}

export function NewRequestWizard() {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedQuote, setSelectedQuote] = useState<InsuranceComparisonQuote | null>(null);
  const [installmentsDrawer, setInstallmentsDrawer] = useState<InsuranceInstallment[] | null>(null);

  const currentStep: WizardStep = wizardSteps[stepIndex];
  const premiumComputation = useMemo(() => {
    return calculatePremiums(buildPremiumInputs(state));
  }, [state]);

  const quotes = premiumComputation.quotes;

  useEffect(() => {
    if (!quotes.length) {
      setSelectedQuote((prev) => (prev === null ? prev : null));
      return;
    }

    setSelectedQuote((previous) => {
      const matchingQuote = previous
        ? quotes.find(
            (quote) =>
              quote.insurer === previous.insurer && quote.product === previous.product,
          )
        : undefined;

      if (matchingQuote) {
        const valuesUnchanged =
          previous?.netPremiumMinor === matchingQuote.netPremiumMinor &&
          previous?.feesMinor === matchingQuote.feesMinor &&
          previous?.taxesMinor === matchingQuote.taxesMinor &&
          previous?.grossPremiumMinor === matchingQuote.grossPremiumMinor &&
          previous?.turnaroundHours === matchingQuote.turnaroundHours &&
          (previous?.notes ?? []).join("|") === (matchingQuote.notes ?? []).join("|");

        return valuesUnchanged ? previous : matchingQuote;
      }

      return quotes[0];
    });
  }, [quotes]);

  const ocrSummary = describeOcrConfidence(state.ocrConfidence);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = event.target.files ? Array.from(event.target.files) : [];
    if (!nextFiles.length) return;
    setState((prev) => ({ ...prev, files: [...prev.files, ...nextFiles] }));
    event.target.value = "";
  };

  const runOcr = () => {
    if (!state.files.length) return;
    const simulatedConfidence = Math.random() * 0.25 + 0.6;
    setState((prev) => ({
      ...prev,
      ocrConfidence: Number(simulatedConfidence.toFixed(2)),
      vehicle: {
        ...prev.vehicle,
        plateNumber: prev.vehicle.plateNumber || "RAB 123C",
        vin: prev.vehicle.vin || "JH4DA9350MS000001",
        make: prev.vehicle.make || "Toyota",
        model: prev.vehicle.model || "RAV4",
        bodyType: prev.vehicle.bodyType || "SUV",
      },
      notes: prev.notes || "OCR completed – review highlighted fields.",
    }));
  };

  const updateVehicle = (partial: Partial<VehicleDetails>) => {
    setState((prev) => ({
      ...prev,
      vehicle: { ...prev.vehicle, ...partial },
    }));
  };

  const updateState = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const goNext = () => {
    setStepIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const canAdvance = () => {
    if (currentStep === "Upload and OCR") {
      return state.files.length > 0;
    }
    if (currentStep === "Vehicle and cover") {
      return state.vehicle.plateNumber.trim().length > 0 && state.sumInsured > 0;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="New request wizard"
        description="Guide the team through intake, pricing, review, payment, and issuance in one place."
      >
        <div className="flex flex-wrap gap-2 pb-4">
          {wizardSteps.map((label, index) => {
            const status = index === stepIndex
              ? "current"
              : index < stepIndex
              ? "complete"
              : "upcoming";
            return (
              <Badge
                key={label}
                variant={status === "current"
                  ? "default"
                  : status === "complete"
                  ? "success"
                  : "outline"}
              >
                {index + 1}. {label}
              </Badge>
            );
          })}
        </div>

        {currentStep === "Upload and OCR" && (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-muted)]">
              Upload logbooks, IDs, or previous policies. OCR confidence and extracted hints update live.
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-dashed border-[color:var(--color-border)] p-6 text-sm"
            />
            {!!state.files.length && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {state.files.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
              <div>
                <p className="font-medium">OCR confidence</p>
                <p className="text-sm text-[color:var(--color-muted)]">{ocrSummary.message}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {state.ocrConfidence ? `${Math.round(state.ocrConfidence * 100)}%` : "Pending"}
                </p>
              </div>
            </div>
            <Button onClick={runOcr} disabled={!state.files.length}>
              Run OCR scan
            </Button>
          </div>
        )}

        {currentStep === "Vehicle and cover" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-medium">Plate number</label>
              <input
                value={state.vehicle.plateNumber}
                onChange={(event) => updateVehicle({ plateNumber: event.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                placeholder="RAB 123C"
              />
              <label className="block text-sm font-medium">VIN</label>
              <input
                value={state.vehicle.vin}
                onChange={(event) => updateVehicle({ vin: event.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                placeholder="JH4DA9350MS000001"
              />
              <label className="block text-sm font-medium">Make and model</label>
              <div className="flex gap-2">
                <input
                  value={state.vehicle.make}
                  onChange={(event) => updateVehicle({ make: event.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                  placeholder="Toyota"
                />
                <input
                  value={state.vehicle.model}
                  onChange={(event) => updateVehicle({ model: event.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                  placeholder="RAV4"
                />
              </div>
              <label className="block text-sm font-medium">Body type</label>
              <input
                value={state.vehicle.bodyType}
                onChange={(event) => updateVehicle({ bodyType: event.target.value })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                placeholder="SUV"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium">Sum insured (RWF)</label>
              <input
                type="number"
                min={1_000_000}
                step={100_000}
                value={state.sumInsured}
                onChange={(event) => updateState({ sumInsured: Number(event.target.value) })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
              />
              <label className="block text-sm font-medium">Cover type</label>
                <select
                  value={state.coverType}
                  onChange={(event) => updateState({ coverType: event.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                >
                  <option value="COMPREHENSIVE">Comprehensive</option>
                  <option value="OD_THEFT_FIRE">Own damage, theft, and fire</option>
                  <option value="MD_ONLY">Material damage only</option>
                  <option value="THEFT_ONLY">Theft only</option>
                  <option value="FIRE_ONLY">Fire only</option>
                  <option value="TP_ONLY">Third party</option>
                </select>
              <label className="block text-sm font-medium">Usage</label>
              <select
                value={state.usage}
                onChange={(event) => updateState({ usage: event.target.value, vehicle: { ...state.vehicle, usage: event.target.value } })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
              >
                <option value="PRIVATE">Private</option>
                <option value="TAXI_PSV">Taxi / PSV</option>
                <option value="HIRE">Self drive hire</option>
                <option value="SCHOOL_BUS">School bus</option>
                <option value="COMMERCIAL_GOODS">Commercial goods</option>
                <option value="DRIVING_SCHOOL">Driving school</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={state.seats}
                    onChange={(event) => updateState({ seats: Number(event.target.value) })}
                    className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Vehicle age</label>
                  <input
                    type="number"
                    min={0}
                    value={state.vehicleAgeYears}
                    onChange={(event) => updateState({ vehicleAgeYears: Number(event.target.value) })}
                    className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === "Add-ons and installments" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={state.comesa}
                  onChange={(event) => updateState({ comesa: event.target.checked })}
                />
                Add COMESA / Yellow card
              </label>
              {state.comesa && (
                <input
                  type="number"
                  min={1}
                  value={state.comesaPassengers}
                  onChange={(event) => updateState({ comesaPassengers: Number(event.target.value) })}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                  placeholder="Passengers"
                />
              )}
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={state.theftExtension}
                  onChange={(event) => updateState({ theftExtension: event.target.checked })}
                />
                Theft territorial extension
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={state.governmentWaiver}
                  onChange={(event) => updateState({ governmentWaiver: event.target.checked })}
                />
                Government excess waiver
              </label>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={state.occupantEnabled}
                  onChange={(event) => updateState({ occupantEnabled: event.target.checked })}
                />
                Personal accident / occupants
              </label>
              {state.occupantEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[color:var(--color-muted)]">Plan</label>
                    <select
                      value={state.occupantPlan}
                      onChange={(event) => updateState({ occupantPlan: Number(event.target.value) })}
                      className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                    >
                      {[1, 2, 3, 4, 5].map((plan) => (
                        <option key={plan} value={plan}>
                          Plan {plan} – {formatCurrency(plan * 1_000_000)} cover
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[color:var(--color-muted)]">Occupants</label>
                    <input
                      type="number"
                      min={1}
                      value={state.occupantCount}
                      onChange={(event) => updateState({ occupantCount: Number(event.target.value) })}
                      className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
                    />
                  </div>
                </div>
              )}
              <label className="block text-sm font-medium">Installment duration (months)</label>
              <input
                type="number"
                min={3}
                step={3}
                value={state.installmentMonths}
                onChange={(event) => updateState({ installmentMonths: Number(event.target.value) })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
              />
              <label className="block text-sm font-medium">Policy period (days)</label>
              <input
                type="number"
                min={30}
                value={state.periodDays}
                onChange={(event) => updateState({ periodDays: Number(event.target.value) })}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
              />
            </div>
          </div>
        )}

        {currentStep === "Compare" && (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-muted)]">
              Premiums recompute instantly when cover, add-ons, or installments change. Open a quote to inspect fee and tax assumptions.
            </p>
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
              <table className="min-w-full divide-y divide-[color:var(--color-border)]">
                <thead className="bg-[color:var(--color-surface-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Insurer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Net premium</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fees</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Taxes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Gross premium</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Turnaround</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                  {quotes.map((quote) => (
                    <tr key={`${quote.insurer}-${quote.product}`}>
                      <td className="px-4 py-3 text-sm font-medium">{quote.insurer}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(quote.netPremiumMinor)}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(quote.feesMinor)}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(quote.taxesMinor)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatCurrency(quote.grossPremiumMinor)}
                      </td>
                      <td className="px-4 py-3 text-sm">{quote.turnaroundHours}h SLA</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedQuote(quote)}
                        >
                          View breakdown
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              onClick={() => setInstallmentsDrawer(premiumComputation.installments)}
            >
              View installment schedule
            </Button>
          </div>
        )}

        {currentStep === "Review" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Customer summary
              </h3>
              <dl className="grid grid-cols-2 gap-4 pt-3 text-sm">
                <div>
                  <dt className="text-[color:var(--color-muted)]">Vehicle</dt>
                  <dd className="font-medium">
                    {[state.vehicle.make, state.vehicle.model].filter(Boolean).join(" ") || "Pending"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Plate</dt>
                  <dd className="font-medium">{state.vehicle.plateNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Cover</dt>
                  <dd className="font-medium">{state.coverType}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Sum insured</dt>
                  <dd className="font-medium">{formatCurrency(state.sumInsured)}</dd>
                </div>
              </dl>
            </div>
            <textarea
              value={state.notes}
              onChange={(event) => updateState({ notes: event.target.value })}
              placeholder="Add review notes, customer preferences, or escalation instructions"
              className="min-h-[120px] w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm"
            />
          </div>
        )}

        {currentStep === "Payment" && (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-muted)]">
              Share MoMo instructions or split payments across installments. Update status once confirmation hits Supabase.
            </p>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Recommended payment flow
              </h3>
              <ol className="list-decimal space-y-2 pl-5 pt-3 text-sm">
                <li>Send BK Insurance quote via WhatsApp template with MOMO code BK428000.</li>
                <li>Track first installment: {formatCurrency(premiumComputation.installments[0]?.amountMinor ?? 0)}.</li>
                <li>Flag finance if payment mismatch exceeds 5% of expected amount.</li>
              </ol>
            </div>
          </div>
        )}

        {currentStep === "Issuance" && (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-muted)]">
              Mark when cover note, policy schedule, and yellow card (if applicable) are uploaded. Issuance logs sync back to Supabase policies and documents tables.
            </p>
            <div className="rounded-xl border border-[color:var(--color-border)] p-4">
              <h3 className="text-sm font-semibold">Next steps</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                <li>Upload signed cover note to Documents Library.</li>
                <li>Trigger policy issuance workflow for preferred insurer.</li>
                <li>Archive OCR docs once policy PDF is stored.</li>
              </ul>
            </div>
            <Button variant="success">Complete issuance and create policy record</Button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setState(DEFAULT_STATE)}>
              Reset
            </Button>
            <Button onClick={goNext} disabled={!canAdvance()}>
              {stepIndex === wizardSteps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {selectedQuote && (
        <Drawer
          title={`${selectedQuote.insurer} · ${selectedQuote.product}`}
          onClose={() => setSelectedQuote(null)}
        >
          <div className="space-y-3 text-sm">
            <p className="font-medium">Quoted premium</p>
            <ul className="space-y-2">
              <li>
                <span className="text-[color:var(--color-muted)]">Net premium:</span>{" "}
                <span className="font-semibold">{formatCurrency(selectedQuote.netPremiumMinor)}</span>
              </li>
              <li>
                <span className="text-[color:var(--color-muted)]">Fees:</span>{" "}
                <span className="font-semibold">{formatCurrency(selectedQuote.feesMinor)}</span>
              </li>
              <li>
                <span className="text-[color:var(--color-muted)]">Taxes:</span>{" "}
                <span className="font-semibold">{formatCurrency(selectedQuote.taxesMinor)}</span>
              </li>
              <li>
                <span className="text-[color:var(--color-muted)]">Gross premium:</span>{" "}
                <span className="font-semibold">{formatCurrency(selectedQuote.grossPremiumMinor)}</span>
              </li>
            </ul>
            {!!selectedQuote.notes?.length && (
              <div>
                <p className="font-medium">Underwriting notes</p>
                <ul className="list-disc space-y-1 pl-4">
                  {selectedQuote.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {installmentsDrawer && (
        <Drawer
          title="Installment schedule"
          onClose={() => setInstallmentsDrawer(null)}
        >
          <div className="space-y-4 text-sm">
            <table className="min-w-full divide-y divide-[color:var(--color-border)]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Installment</th>
                  <th className="px-3 py-2 text-left font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Due in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {installmentsDrawer.map((item, index) => (
                  <tr key={`${item.label}-${index}`}>
                    <td className="px-3 py-2">{item.label}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(item.amountMinor)}</td>
                    <td className="px-3 py-2">{item.dueInDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Drawer>
      )}
    </div>
  );
}
