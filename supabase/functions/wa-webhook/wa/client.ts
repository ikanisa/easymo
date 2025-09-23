import { WA_PHONE_ID, WA_TOKEN } from "../config.ts";
import { safeButtonTitle, safeRowTitle, safeRowDesc } from "../utils/text.ts";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

async function post(payload: unknown): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("wa_client.send_fail", res.status, text);
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: safeButtonTitle(btn.title) },
        })),
      },
    },
  });
}

export async function sendList(
  to: string,
  opts: {
    title: string;
    body: string;
    buttonText?: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  },
): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: safeRowTitle(opts.title, 60) },
      body: { text: opts.body.slice(0, 1024) },
      action: {
        button: safeButtonTitle(opts.buttonText ?? "Choose"),
        sections: [
          {
            title: safeRowTitle(opts.sectionTitle, 60),
            rows: opts.rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: safeRowTitle(row.title),
              description: row.description ? safeRowDesc(row.description) : undefined,
            })),
          },
        ],
      },
    },
  });
}

export async function sendImageUrl(to: string, link: string, caption?: string): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link, caption: caption?.slice(0, 1024) },
  });
}
