import React, { useEffect, useMemo, useState } from "react";
import {
  enqueueMany,
  listLogs,
  listQueue,
  deleteQueueRow,
  runDispatcherOnce,
  updateQueueStatus,
} from "./api";
import { parseRecipients, prettyJSON } from "./utils";
import type { QPayload, SendLogRow, SendQueueRow, QueueStatus } from "./types";
import AdminLayout from "@/components/AdminLayout";

/** Tailwind-based admin surface
 *  Drop this page into your admin router, e.g. /admin/marketing
 */

const SectionCard: React.FC<{ title: string; children: React.ReactNode; actions?: React.ReactNode }> =
  ({ title, children, actions }) => (
    <div className="bg-white rounded-2xl shadow p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={
      "w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
      (props.className ?? "")
    }
  />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    className={
      "w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono " +
      (props.className ?? "")
    }
  />
);

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" }
> = ({ tone = "primary", ...props }) => {
  const base = "px-4 py-2 rounded-xl text-sm";
  const styles =
    tone === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-gray-100 text-gray-800 hover:bg-gray-200";
  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
};

function useLocalSetting(key: string, initial = "") {
  const [val, setVal] = useState<string>(() => localStorage.getItem(key) || initial);
  useEffect(() => {
    localStorage.setItem(key, val);
  }, [key, val]);
  return [val, setVal] as const;
}

/** ========== Quick Send Form ========== */
const QuickSend: React.FC = () => {
  const [kind, setKind] = useState<"TEXT" | "TEMPLATE" | "INTERACTIVE">("TEXT");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const recipients = useMemo(() => parseRecipients(recipientsRaw), [recipientsRaw]);

  // TEXT
  const [textBody, setTextBody] = useState("Hello from Easymo ✅");

  // TEMPLATE
  const [tplName, setTplName] = useState("promo_2025");
  const [tplLang, setTplLang] = useState("en");
  const [tplComponents, setTplComponents] = useState(prettyJSON([{ type: "body", parameters: [{ type: "text", text: "Friend" }] }]));

  // INTERACTIVE
  const [interactiveJSON, setInteractiveJSON] = useState(
    prettyJSON({
      type: "button",
      body: { text: "Try Easymo?" },
      action: { buttons: [{ type: "reply", reply: { id: "ok", title: "OK" } }] },
    })
  );

  const [scheduleAt, setScheduleAt] = useState<string>(""); // ISO local without TZ

  async function onQueue() {
    try {
      let payload: QPayload;
      if (kind === "TEXT") {
        payload = { kind: "TEXT", text: textBody };
      } else if (kind === "TEMPLATE") {
        let comps: any[] = [];
        try {
          comps = JSON.parse(tplComponents || "[]");
          if (!Array.isArray(comps)) throw new Error("components must be an array");
        } catch (e) {
          alert("Invalid Template components JSON: " + (e as Error).message);
          return;
        }
        payload = {
          kind: "TEMPLATE",
          name: tplName.trim(),
          language_code: tplLang.trim() || "en",
          components: comps,
        };
      } else {
        let obj: any = {};
        try {
          obj = JSON.parse(interactiveJSON || "{}");
        } catch (e) {
          alert("Invalid interactive JSON: " + (e as Error).message);
          return;
        }
        payload = { kind: "INTERACTIVE", interactive: obj };
      }
      if (!recipients.length) {
        alert("Add at least one recipient (E.164, e.g. +2507...)");
        return;
      }
      // Optional schedule
      const scheduleISO = scheduleAt ? new Date(scheduleAt).toISOString() : null;

      await enqueueMany(recipients, payload, { scheduleAt: scheduleISO });
      setRecipientsRaw("");
      alert(`Queued ${recipients.length} message(s).`);
    } catch (e) {
      console.error(e);
      alert("Failed to enqueue: " + (e as Error).message);
    }
  }

  return (
    <SectionCard
      title="Quick Send"
      actions={<span className="text-sm text-gray-500">{recipients.length} recipient(s)</span>}
    >
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: recipients + schedule */}
        <div className="lg:col-span-1 space-y-3">
          <label className="text-sm text-gray-600">Recipients (one per line or comma)</label>
          <TextArea
            rows={8}
            placeholder="+2507..., +2507..., 07..., 2507..., 02507..."
            value={recipientsRaw}
            onChange={(e) => setRecipientsRaw(e.target.value)}
          />
          <label className="text-sm text-gray-600">Schedule at (optional)</label>
          <TextInput
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={onQueue}>Queue Messages</Button>
          </div>
        </div>

        {/* Middle: kind-specific editors */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            {(["TEXT", "TEMPLATE", "INTERACTIVE"] as const).map((k) => (
              <Button key={k} tone={kind === k ? "primary" : "ghost"} onClick={() => setKind(k)}>
                {k}
              </Button>
            ))}
          </div>

          {kind === "TEXT" && (
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Text message</label>
              <TextArea rows={6} value={textBody} onChange={(e) => setTextBody(e.target.value)} />
            </div>
          )}

          {kind === "TEMPLATE" && (
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Template name</label>
                <TextInput value={tplName} onChange={(e) => setTplName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Language code</label>
                <TextInput value={tplLang} onChange={(e) => setTplLang(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Components JSON</label>
                <TextArea rows={8} value={tplComponents} onChange={(e) => setTplComponents(e.target.value)} />
              </div>
            </div>
          )}

          {kind === "INTERACTIVE" && (
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Interactive JSON</label>
              <TextArea
                rows={10}
                value={interactiveJSON}
                onChange={(e) => setInteractiveJSON(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

/** ========== Queue Table ========== */
const QueueTable: React.FC = () => {
  const [rows, setRows] = useState<SendQueueRow[]>([]);
  const [status, setStatus] = useState<QueueStatus | "ALL">("PENDING");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listQueue({ status, limit: 200 });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function retryNow(id: number) {
    await updateQueueStatus(id, { status: "PENDING", next_attempt_at: new Date().toISOString() });
    await load();
  }

  async function cancel(id: number) {
    await updateQueueStatus(id, { status: "FAILED", next_attempt_at: new Date().toISOString() });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Delete from queue?")) return;
    await deleteQueueRow(id);
    await load();
  }

  const [fnUrl, setFnUrl] = useLocalSetting("dispatcher_url", "");

  async function runNow() {
    if (!fnUrl) return alert("Set the dispatcher function URL in Settings first.");
    try {
      const res = await runDispatcherOnce(fnUrl);
      alert(`Dispatcher: ${JSON.stringify(res)}`);
      await load();
    } catch (e) {
      alert("Failed: " + (e as Error).message);
    }
  }

  return (
    <SectionCard
      title="Queue"
      actions={
        <div className="flex gap-2">
          <select
            className="border rounded-lg px-2 py-1"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {["PENDING", "SENT", "FAILED", "SKIPPED", "ALL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button tone="ghost" onClick={load}>Refresh</Button>
          <Button onClick={runNow}>Run dispatcher now</Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">To</th>
              <th className="py-2 pr-4">Kind</th>
              <th className="py-2 pr-4">Attempt</th>
              <th className="py-2 pr-4">Next attempt</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-6 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="py-6 text-gray-400">No rows.</td></tr>
            ) : (
              rows.map((r) => {
                const kind =
                  (r.payload as any)?.kind ||
                  (r as any)?.payload?.kind ||
                  (typeof r.payload === "string" ? "TEXT" : "TEXT");
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4">{r.id}</td>
                    <td className="py-2 pr-4">{r.msisdn_e164}</td>
                    <td className="py-2 pr-4">{kind}</td>
                    <td className="py-2 pr-4">{r.attempt}</td>
                    <td className="py-2 pr-4">{new Date(r.next_attempt_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Button tone="ghost" onClick={() => retryNow(r.id)}>Retry</Button>
                        <Button tone="danger" onClick={() => cancel(r.id)}>Fail</Button>
                        <Button tone="ghost" onClick={() => remove(r.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

/** ========== Logs Table ========== */
const LogsTable: React.FC = () => {
  const [rows, setRows] = useState<SendLogRow[]>([]);
  const [msisdn, setMsisdn] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listLogs({ msisdn: msisdn.trim() || undefined, limit: 300 });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SectionCard
      title="Send Logs"
      actions={
        <div className="flex gap-2">
          <TextInput
            placeholder="Filter by MSISDN (+2507...)"
            value={msisdn}
            onChange={(e) => setMsisdn(e.target.value)}
          />
          <Button tone="ghost" onClick={load}>Refresh</Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">To</th>
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Provider ID</th>
              <th className="py-2 pr-4">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-6 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="py-6 text-gray-400">No logs.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-4">{r.id}</td>
                  <td className="py-2 pr-4">{r.msisdn_e164}</td>
                  <td className="py-2 pr-4">{r.sent_at ? new Date(r.sent_at).toLocaleString() : "-"}</td>
                  <td className="py-2 pr-4">{r.delivery_status ?? "-"}</td>
                  <td className="py-2 pr-4 truncate max-w-[220px]">{r.provider_msg_id ?? "-"}</td>
                  <td className="py-2 pr-4 text-red-600 truncate max-w-[360px]">{r.error ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

/** ========== Settings (Dispatcher URL) ========== */
const SettingsPanel: React.FC = () => {
  const [fnUrl, setFnUrl] = useLocalSetting("dispatcher_url", "");
  return (
    <SectionCard title="Settings">
      <div className="space-y-2">
        <label className="text-sm text-gray-600">Dispatcher Function URL</label>
        <TextInput
          placeholder="https://<your-ref>.supabase.co/functions/v1/campaign-dispatch"
          value={fnUrl}
          onChange={(e) => setFnUrl(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          This is used by "Run dispatcher now". The cron job can run it automatically.
        </p>
      </div>
    </SectionCard>
  );
};

/** ========== Page Shell ========== */
const CampaignsPage: React.FC = () => {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">WhatsApp Campaigns</h1>
        <QuickSend />
        <QueueTable />
        <LogsTable />
        <SettingsPanel />
      </div>
    </AdminLayout>
  );
};

export default CampaignsPage;
