export interface QueryCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  delete(key: string): void
}

export class NoopCache implements QueryCache {
  // eslint-disable-next-line class-methods-use-this
  get<T>(): T | undefined {
    return undefined
  }

  // eslint-disable-next-line class-methods-use-this
  set(): void {}

  // eslint-disable-next-line class-methods-use-this
  delete(): void {}
}
