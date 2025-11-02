import type { FeatureFlagKey } from "@app-apis/config/environment";
import { getFeatureFlagService } from "@app-apis/lib/featureFlags";
import { normalizeError } from "@app-apis/lib/errors";
import { logger } from "@app-apis/lib/logger";
import { measure } from "@app-apis/lib/perf";
import { getRequestId } from "@app-apis/lib/request";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import type { DomainRepositories } from "@app-apis/lib/supabase";
import type { RequestContext } from "@easymo/clients";
import { NextRequest, NextResponse } from "next/server";

export interface DomainHandlerContext extends RequestContext {
  repositories: DomainRepositories;
}

export interface DomainHandlerOptions<Input, Output> {
  domain: FeatureFlagKey;
  method: string;
  parse: (request: NextRequest) => Promise<Input> | Input;
  execute: (context: DomainHandlerContext, input: Input) => Promise<Output>;
}

export const createDomainHandler = <Input, Output>({
  domain,
  method,
  parse,
  execute,
}: DomainHandlerOptions<Input, Output>) => {
  return async (request: NextRequest) => {
    const requestId = getRequestId(request);
    const featureFlags = getFeatureFlagService();
    const repositories = getSupabaseRepositories();

    logger.info("request.received", {
      requestId,
      path: request.nextUrl.pathname,
      method,
      domain,
    });

    try {
      featureFlags.ensureEnabled(domain, requestId);
      const input = await parse(request);
      const context: DomainHandlerContext = { requestId, repositories };
      const data = await measure(`${domain}.${method.toLowerCase()}`, () => execute(context, input));
      const response = NextResponse.json({ data, requestId });
      logger.info("request.completed", {
        requestId,
        domain,
        method,
        status: response.status,
      });
      return response;
    } catch (error) {
      const apiError = normalizeError(error, requestId);
      logger.error("request.failed", {
        requestId,
        domain,
        method,
        code: apiError.code,
        status: apiError.status,
      });
      return NextResponse.json(apiError.toJSON(), { status: apiError.status });
    }
  };
};
