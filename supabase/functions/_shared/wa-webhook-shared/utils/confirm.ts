import { sendButtons } from "../wa/client.ts";

export async function sendConfirmPrompt(
  to: string,
  message: string,
  options: {
    confirmId: string;
    cancelId: string;
    confirmLabel?: string;
    cancelLabel?: string;
  },
): Promise<void> {
  await sendButtons(to, message, [
    { id: options.confirmId, title: options.confirmLabel ?? "Confirm" },
    { id: options.cancelId, title: options.cancelLabel ?? "Cancel" },
  ]);
}
