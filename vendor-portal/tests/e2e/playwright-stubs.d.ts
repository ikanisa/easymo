interface PlaywrightLocator {
  toBeVisible: () => Promise<void>;
  toBeEnabled: () => Promise<void>;
  toContainText: (text: string) => Promise<void>;
  toHaveCount: (count: number) => Promise<void>;
  click: () => Promise<void>;
  fill: (value: string) => Promise<void>;
}

interface PlaywrightPage {
  goto: (url: string) => Promise<void>;
  getByRole: (...args: unknown[]) => PlaywrightLocator;
  getByLabel: (...args: unknown[]) => PlaywrightLocator;
  getByText: (...args: unknown[]) => PlaywrightLocator;
  getByTestId: (testId: string) => PlaywrightLocator;
  locator: (selector: string) => PlaywrightLocator;
  waitForSelector: (...args: unknown[]) => Promise<void>;
  evaluate: <T>(callback: () => T) => Promise<T>;
}

declare module "@playwright/test" {
  export interface APIRequestContext {
    delete: (url: string, options?: unknown) => Promise<unknown>;
    post: (url: string, options?: unknown) => Promise<unknown>;
  }

  export interface TestFixtures {
    page: PlaywrightPage;
    request: APIRequestContext;
  }

  export interface TestHooks {
    beforeEach: (
      callback: (fixtures: { request: APIRequestContext }) => Promise<unknown> | unknown
    ) => void;
    afterEach: (
      callback: (fixtures: { request: APIRequestContext }) => Promise<unknown> | unknown
    ) => void;
    describe: (title: string, callback: () => void) => void;
  }

  export type TestFn = (
    title: string,
    callback: (fixtures: TestFixtures) => Promise<unknown> | unknown
  ) => void;

  export type Page = PlaywrightPage;

  export const test: TestFn & TestHooks;
  export const expect: (locator: PlaywrightLocator | unknown) => PlaywrightLocator;
}
