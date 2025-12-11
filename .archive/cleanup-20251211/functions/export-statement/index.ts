import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTHORIZED_ROLES = new Set(["SYSTEM_ADMIN", "SACCO_MANAGER", "SACCO_STAFF"]);

const parseDate = (value: string | null, fallback: Date) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
};

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("rw-RW", {
    style: "currency",
    currency: "RWF",
    minimumFractionDigits: 0,
  }).format(amount);

serveWithObservability("export-statement", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ikiminaId = url.searchParams.get("ikiminaId");
    const format = (url.searchParams.get("format") as "csv" | "pdf" | null) ?? "pdf";

    if (!ikiminaId) {
      throw new Error("ikiminaId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: requesterProfile, error: profileError } = await serviceClient
      .from("users")
      .select("id, role, sacco_id")
      .eq("id", user.id)
      .single();

    if (profileError || !requesterProfile || !AUTHORIZED_ROLES.has(requesterProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const start = parseDate(
      url.searchParams.get("start"),
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const end = parseDate(url.searchParams.get("end"), new Date());

    const { data: ikimina, error: ikiminaError } = await serviceClient
      .from("ibimina")
      .select("id, name, code, sacco_id")
      .eq("id", ikiminaId)
      .single();

    if (ikiminaError || !ikimina) {
      throw ikiminaError ?? new Error("Ikimina not found");
    }

    const isSystemAdmin = requesterProfile.role === "SYSTEM_ADMIN";
    const isSameSacco = Boolean(
      requesterProfile.sacco_id && requesterProfile.sacco_id === ikimina.sacco_id
    );
    const hasSaccoPrivileges =
      requesterProfile.role === "SACCO_MANAGER" || requesterProfile.role === "SACCO_STAFF";

    if (!isSystemAdmin && !(isSameSacco && hasSaccoPrivileges)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { data: payments, error: paymentsError } = await serviceClient
      .from("payments")
      .select("id, amount, occurred_at, status, reference, txn_id")
      .eq("ikimina_id", ikiminaId)
      .gte("occurred_at", start.toISOString())
      .lte("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: true });

    if (paymentsError) {
      throw paymentsError;
    }

    let running = 0;
    const ledgerRows = (payments ?? [])
      .filter((payment) => ["POSTED", "SETTLED"].includes(payment.status))
      .map((payment) => {
        running += payment.amount;
        return {
          occurred: payment.occurred_at,
          txnId: payment.txn_id,
          reference: payment.reference ?? "—",
          amount: payment.amount,
          running: running,
        };
      });

    if (format === "csv") {
      let csv = "Occurred,Txn ID,Reference,Amount,Running Balance\n";
      for (const row of ledgerRows) {
        csv += `${row.occurred},${row.txnId},${row.reference},${row.amount},${row.running}\n`;
      }

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${ikimina.code}-statement-${toDateOnly(start)}-to-${toDateOnly(end)}.csv"`,
        },
      });
    }

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();

    page.drawText("Ikimina Statement", {
      x: 48,
      y: height - 72,
      size: 18,
      font: bold,
      color: rgb(0, 0.63, 0.87),
    });
    page.drawText(`${ikimina.name} (${ikimina.code})`, { x: 48, y: height - 96, size: 12, font });
    page.drawText(`Period ${toDateOnly(start)} → ${toDateOnly(end)}`, {
      x: 48,
      y: height - 114,
      size: 10,
      font,
    });

    let cursorY = height - 150;
    const rowHeight = 18;

    page.drawText("Occurred", { x: 48, y: cursorY, size: 11, font: bold });
    page.drawText("Txn ID", { x: 170, y: cursorY, size: 11, font: bold });
    page.drawText("Reference", { x: 280, y: cursorY, size: 11, font: bold });
    page.drawText("Amount", { x: 400, y: cursorY, size: 11, font: bold });
    page.drawText("Running", { x: 480, y: cursorY, size: 11, font: bold });
    cursorY -= rowHeight;

    for (const row of ledgerRows) {
      if (cursorY < 72) {
        page.drawText("…", { x: 48, y: cursorY, size: 11, font });
        break;
      }
      page.drawText(new Date(row.occurred).toISOString().replace("T", " ").slice(0, 16), {
        x: 48,
        y: cursorY,
        size: 10,
        font,
      });
      page.drawText(row.txnId, { x: 170, y: cursorY, size: 10, font });
      page.drawText(row.reference, { x: 280, y: cursorY, size: 10, font });
      page.drawText(formatCurrency(row.amount), { x: 400, y: cursorY, size: 10, font });
      page.drawText(formatCurrency(row.running), { x: 480, y: cursorY, size: 10, font });
      cursorY -= rowHeight;
    }

    page.drawRectangle({
      x: 48,
      y: cursorY - 1,
      width: 472,
      height: 0.75,
      color: rgb(0.12, 0.25, 0.2),
    });
    cursorY -= rowHeight;
    page.drawText(`Closing balance: ${formatCurrency(running)}`, {
      x: 48,
      y: cursorY,
      size: 11,
      font: bold,
    });

    const pdfBytes = await pdf.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ikimina.code}-statement-${toDateOnly(start)}-to-${toDateOnly(end)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Export statement failed", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
