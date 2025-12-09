import { headers } from "next/headers";
import { logError, logInfo, withLogContext } from "@/lib/observability/logger";

type AsyncAction<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export function instrumentServerAction<TArgs extends unknown[], TResult>(
  name: string,
  action: AsyncAction<TArgs, TResult>
): AsyncAction<TArgs, TResult> {
  return (async (...args: TArgs) => {
    const headerList = await headers();
    const requestId =
      headerList.get("x-request-id") ?? headerList.get("x-correlation-id") ?? undefined;

    const startedAt = Date.now();

    return withLogContext(
      {
        requestId: requestId ?? undefined,
        source: `action:${name}`,
      },
      async () => {
        logInfo("server_action_started", { name });
        try {
          const result = await action(...args);
          logInfo("server_action_completed", { name, durationMs: Date.now() - startedAt });
          return result;
        } catch (error) {
          logError("server_action_failed", { name, durationMs: Date.now() - startedAt, error });
          throw error;
        }
      }
    );
  }) as AsyncAction<TArgs, TResult>;
}
