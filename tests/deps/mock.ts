export type StubCall = {
  args: unknown[];
};

export type Stub<T> = {
  calls: StubCall[];
  restore(): void;
};

export function stub<T extends Record<string, unknown>, K extends keyof T>(
  target: T,
  key: K,
  implementation: T[K] extends (...args: any[]) => any ? T[K]
    : (...args: any[]) => any,
): Stub<T> {
  const original = target[key];
  const calls: StubCall[] = [];
  (target as any)[key] = function (...args: unknown[]) {
    calls.push({ args });
    return (implementation as (...args: unknown[]) => unknown).apply(
      this,
      args,
    );
  };
  return {
    calls,
    restore() {
      (target as any)[key] = original;
    },
  };
}
