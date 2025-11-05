import { cached } from "@app-apis/lib/cache";
import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { DriverRequest, DriverResponse } from "@app-apis/domains/driver/schemas";
import { ApiError } from "@app-apis/lib/errors";

export const getDriverProfile = async (
  context: DomainHandlerContext,
  input: DriverRequest
): Promise<DriverResponse> => {
  const cacheKey = `driver:${input.driverId}`;
  return cached(cacheKey, async () => {
    const repositories = getSupabaseRepositories();
    const driver = await measure("driver.repository", () =>
      repositories.driver.get(context, input.driverId)
    );

    if (!driver) {
      throw new ApiError({
        status: 404,
        code: "DRIVER_NOT_FOUND",
        message: `Driver ${input.driverId} was not found`,
        requestId: context.requestId,
      });
    }

    return {
      id: driver.id,
      name: driver.name,
      rating: driver.rating,
      vehicle: driver.vehicle,
      updatedAt: driver.updated_at,
    };
  });
};
