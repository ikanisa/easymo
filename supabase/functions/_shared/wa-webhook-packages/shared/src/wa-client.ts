// WhatsApp Cloud API client helpers

const WA_API_URL = "https://graph.facebook.com/v18.0";
const WA_PHONE_ID = Deno.env.get("WA_PHONE_ID") ?? "";
const WA_TOKEN = Deno.env.get("WA_TOKEN") ?? "";

export async function sendText(to: string, text: string): Promise<void> {
  const response = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

export async function sendList(
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): Promise<void> {
  const response = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  const response = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}
