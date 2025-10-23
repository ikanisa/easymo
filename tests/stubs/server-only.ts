// Vitest cannot resolve Next.js' `server-only` module when running in a plain
// Node environment. The production build relies on the module as a marker for
// bundlers rather than for runtime behaviour, so our test environment can use
// a no-op stub.
export {};
