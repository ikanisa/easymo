import type { SupabaseRepositories } from '@easymo/clients'
import { createSupabaseRepositories } from '@easymo/clients'

const globalKey = Symbol.for('app-apis.supabase')

type GlobalWithSupabase = typeof globalThis & {
  [globalKey]?: SupabaseRepositories
}

export function getSupabaseRepositories(): SupabaseRepositories {
  const globalScope = globalThis as GlobalWithSupabase
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = createSupabaseRepositories()
  }
  return globalScope[globalKey]!
}

export function setSupabaseRepositoriesForTests(repositories: SupabaseRepositories) {
  const globalScope = globalThis as GlobalWithSupabase
  globalScope[globalKey] = repositories
}
