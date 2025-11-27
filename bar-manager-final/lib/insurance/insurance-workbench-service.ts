"use client";

import { getInsuranceServiceUrl } from "@/lib/env-client";
import {
  type InsuranceSimulationResult,
  insuranceSimulationResultSchema,
} from "@/lib/schemas";

export type InsuranceSimulationFields = Record<
  string,
  string | number | boolean | undefined | null
>;

export interface InsuranceSimulationRequest {
  files: File[];
  fields: InsuranceSimulationFields;
}

function normalizeUrl(baseUrl: string): string {
  return baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;
}

function appendField(formData: FormData, key: string, value: string | number | boolean) {
  if (typeof value === "boolean") {
    formData.append(key, value ? "true" : "false");
  } else {
    formData.append(key, String(value));
  }
}

export async function runInsuranceSimulation(
  request: InsuranceSimulationRequest,
): Promise<InsuranceSimulationResult> {
  const serviceUrl = getInsuranceServiceUrl();
  if (!serviceUrl) {
    throw new Error(
      "Insurance pricing service URL is not configured. Set NEXT_PUBLIC_INSURANCE_SERVICE_URL or INSURANCE_SERVICE_URL.",
    );
  }

  const formData = new FormData();
  request.files.forEach((file) => {
    formData.append("files", file, file.name);
  });

  Object.entries(request.fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    appendField(formData, key, value);
  });

  const endpoint = `${normalizeUrl(serviceUrl)}/simulate`;
  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Insurance simulation failed.";
    try {
      const body = await response.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  const json = await response.json();
  return insuranceSimulationResultSchema.parse(json);
}
