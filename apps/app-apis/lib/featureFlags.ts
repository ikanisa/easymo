import { z } from 'zod'
import { ApiError } from './errors'

export const featureFlagSchema = z.record(z.boolean())

export type FeatureFlag =
  | 'favorites'
  | 'driver'
  | 'match'
  | 'deeplink'
  | 'broker'
  | 'admin'

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  favorites: true,
  driver: true,
  match: true,
  deeplink: true,
  broker: true,
  admin: true
}

function loadRuntimeFlags(): Partial<Record<FeatureFlag, boolean>> {
  const raw = process.env.APP_APIS_FLAGS
  if (!raw) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error('Failed to parse feature flag payload', error)
    return {}
  }

  const result = featureFlagSchema.safeParse(parsed)
  if (!result.success) {
    console.error('Failed to parse feature flag payload', result.error.flatten())
    return {}
  }

  return result.data as Partial<Record<FeatureFlag, boolean>>
}

const runtimeFlags = loadRuntimeFlags()

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return runtimeFlags[flag] ?? DEFAULT_FLAGS[flag]
}

export function ensureFeatureEnabled(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: `The ${flag} feature is currently disabled`,
      status: 403,
      details: { flag }
    })
  }
}
