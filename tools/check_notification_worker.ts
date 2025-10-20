/**
 * Usage:
 *   deno run --allow-env --allow-net tools/check_notification_worker.ts \
 *     https://<project-ref>.functions.supabase.co/notification-worker
 */

const endpoint = Deno.args[0];
if (!endpoint) {
  console.error(
    "Usage: deno run --allow-env --allow-net tools/check_notification_worker.ts <notification-worker-url>",
  );
  Deno.exit(1);
}

const res = await fetch(endpoint, { method: "POST" });
if (!res.ok) {
  console.error(`notification-worker responded with status ${res.status}`);
  Deno.exit(1);
}

const body = await res.json();
console.warn("notification-worker response", body);
if (body?.cronEnabled === true) {
  console.warn(
    "Cron scheduling is enabled (NOTIFICATION_WORKER_CRON_ENABLED=true).",
  );
} else {
  console.warn(
    "Cron scheduling disabled. Ensure NOTIFICATION_WORKER_CRON_ENABLED=true and Supabase cron is configured if queue processing should be automatic.",
  );
}
