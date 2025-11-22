export interface QueryCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  delete(key: string): void
}

export class NoopCache implements QueryCache {
   
  get<T>(): T | undefined {
    return undefined
  }

   
  set(): void {}

   
  delete(): void {}
}
