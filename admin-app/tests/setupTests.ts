import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  window.matchMedia = window.matchMedia ||
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // @ts-expect-error jsdom mock
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;

  // @ts-expect-error jsdom mock
  window.IntersectionObserver = window.IntersectionObserver || class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
