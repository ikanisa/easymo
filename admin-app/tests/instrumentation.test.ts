import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GLOBAL_STATE_KEY = Symbol.for('admin-app.instrumentation');

declare module 'vitest' {
  interface TestContext {
    restoreProcessListeners?: () => void;
  }
}

function clearInstrumentationState() {
  const globalScope = globalThis as Record<string | symbol, unknown>;
  delete globalScope[GLOBAL_STATE_KEY];
}

describe('instrumentation register', () => {
  beforeEach((context) => {
    vi.resetModules();
    vi.restoreAllMocks();
    clearInstrumentationState();

    const originalUnhandled = process.listeners('unhandledRejection');
    const originalUncaught = process.listeners('uncaughtException');

    context.restoreProcessListeners = () => {
      const currentUnhandled = process.listeners('unhandledRejection');
      currentUnhandled.forEach((listener) => {
        if (!originalUnhandled.includes(listener)) {
          process.removeListener('unhandledRejection', listener as () => void);
        }
      });

      const currentUncaught = process.listeners('uncaughtException');
      currentUncaught.forEach((listener) => {
        if (!originalUncaught.includes(listener)) {
          process.removeListener('uncaughtException', listener as () => void);
        }
      });
    };
  });

  afterEach((context) => {
    context.restoreProcessListeners?.();
    clearInstrumentationState();
    vi.unstubAllGlobals();
  });

  it('logs initialization and surfaces node runtime errors', async () => {
    const originalRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'nodejs';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { register } = await import('../instrumentation');

    await register();

    expect(logSpy).toHaveBeenCalledWith(
      '[instrumentation] Server initialization complete',
      expect.objectContaining({ nodeEnv: process.env.NODE_ENV }),
    );

    const rejectionReason = new Error('instrumentation test rejection');
    const fakePromise = Promise.resolve();
    process.emit('unhandledRejection', rejectionReason, fakePromise);

    expect(errorSpy).toHaveBeenCalledWith(
      '[instrumentation] Unhandled Rejection',
      expect.objectContaining({ reason: rejectionReason }),
    );

    const thrownError = new Error('instrumentation uncaught exception');
    process.emit('uncaughtException', thrownError);

    expect(errorSpy).toHaveBeenCalledWith(
      '[instrumentation] Uncaught Exception',
      expect.objectContaining({ error: thrownError.message }),
    );

    process.env.NEXT_RUNTIME = originalRuntime;
  });

  it('logs initialization in edge runtime when node globals are unavailable', async () => {
    const originalRuntime = process.env.NEXT_RUNTIME;
    const originalProcess = process;
    delete process.env.NEXT_RUNTIME;

    vi.stubGlobal('process', undefined);
    (globalThis as Record<string, unknown>).EdgeRuntime = 'edge-runtime';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { register } = await import('../instrumentation');

    await register();

    expect(logSpy).toHaveBeenCalledWith(
      '[instrumentation] Edge runtime initialization',
      expect.objectContaining({ timestamp: expect.any(String) }),
    );

    delete (globalThis as Record<string, unknown>).EdgeRuntime;
    vi.unstubAllGlobals();
    (globalThis as { process: typeof originalProcess }).process = originalProcess;
    process.env.NEXT_RUNTIME = originalRuntime;
  });
});
