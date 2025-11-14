#!/usr/bin/env -S deno run --allow-env --allow-net

import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";

const args = parse(Deno.args, {
  string: ["name", "value", "project", "token", "previous"],
  boolean: ["replace", "dry-run"],
  alias: {
    n: "name",
    v: "value",
    p: "project",
  },
  default: {
    replace: false,
    "dry-run": false,
  },
});

const secretName = (args.name ?? args._[0]) as string | undefined;
const projectRef = args.project ??
  Deno.env.get("SUPABASE_PROJECT_ID") ??
  Deno.env.get("SUPABASE_PROJECT_REF");
const accessToken = args.token ?? Deno.env.get("SUPABASE_ACCESS_TOKEN");
const newValue = args.value ?? (args._.length > 1 ? String(args._[1]) : undefined) ??
  Deno.env.get("SECRET_VALUE");
const previousValue = args.previous ?? Deno.env.get("SECRET_PREVIOUS_VALUE");

if (!secretName) {
  console.error("[rotate-secret] --name is required (or provide as first positional argument)");
  Deno.exit(1);
}

if (!projectRef) {
  console.error("[rotate-secret] SUPABASE_PROJECT_ID or --project is required");
  Deno.exit(1);
}

if (!accessToken) {
  console.error("[rotate-secret] SUPABASE_ACCESS_TOKEN or --token is required");
  Deno.exit(1);
}

if (!newValue) {
  console.error("[rotate-secret] --value, positional value, or SECRET_VALUE env is required");
  Deno.exit(1);
}

const secretsPayload = [
  { name: secretName, value: String(newValue) },
];

if (typeof previousValue === "string" && previousValue.length > 0) {
  secretsPayload.push({ name: `${secretName}_PREVIOUS`, value: previousValue });
}

const body = JSON.stringify({
  secrets: secretsPayload,
  replace: Boolean(args.replace),
});

console.info("[rotate-secret] Prepared payload", {
  projectRef,
  secretCount: secretsPayload.length,
  replace: Boolean(args.replace),
  dryRun: Boolean(args["dry-run"]),
});

if (args["dry-run"]) {
  console.info("[rotate-secret] Dry run enabled, skipping API request");
  Deno.exit(0);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
  method: args.replace ? "PUT" : "PATCH",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body,
});

if (!response.ok) {
  const text = await response.text();
  console.error("[rotate-secret] Failed to update secrets", {
    status: response.status,
    statusText: response.statusText,
    body: text,
  });
  Deno.exit(1);
}

const result = await response.json().catch(() => ({ ok: true }));
console.info("[rotate-secret] Secret rotation request accepted", result);
