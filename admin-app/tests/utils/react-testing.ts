import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  fireEvent as domFireEvent,
  waitFor as domWaitFor,
  screen,
  getQueriesForElement,
  queries,
} from "@testing-library/dom";

type WaitFor = typeof domWaitFor;

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = true;
}

type MountedRoot = {
  root: Root;
  container: HTMLElement;
};

const mountedRoots = new Set<MountedRoot>();

function cleanupEntry(entry: MountedRoot) {
  const { root, container } = entry;
  act(() => {
    root.unmount();
  });
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

export function cleanup() {
  for (const entry of Array.from(mountedRoots)) {
    mountedRoots.delete(entry);
    cleanupEntry(entry);
  }
}

export const fireEvent = new Proxy(domFireEvent, {
  apply(target, thisArg, argArray) {
    let result: unknown;
    act(() => {
      result = Reflect.apply(target, thisArg, argArray);
    });
    return result;
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value === "function") {
      return (...args: unknown[]) => {
        let result: unknown;
        act(() => {
          result = (value as (...fnArgs: unknown[]) => unknown)(...args);
        });
        return result;
      };
    }
    return value;
  },
}) as typeof domFireEvent;

export const waitFor: WaitFor = (async (callback, options) => {
  let result: Awaited<ReturnType<typeof callback>>;
  await act(async () => {
    result = await domWaitFor(callback, options);
  });
  return result!;
}) as WaitFor;

export function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  const entry: MountedRoot = { root, container };
  mountedRoots.add(entry);

  act(() => {
    root.render(ui);
  });

  const boundQueries = getQueriesForElement(container, queries);

  return {
    container,
    ...boundQueries,
    rerender(next: React.ReactElement) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      if (!mountedRoots.has(entry)) return;
      mountedRoots.delete(entry);
      cleanupEntry(entry);
    },
  };
}

export { screen };
