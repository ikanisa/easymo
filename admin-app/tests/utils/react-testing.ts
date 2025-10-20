import { act } from "react";
import {
  render as rtlRender,
  fireEvent as rtlFireEvent,
  waitFor as rtlWaitFor,
  cleanup as rtlCleanup,
  screen,
} from "@testing-library/react";

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = true;
}

export function render(ui: React.ReactElement) {
  let result: ReturnType<typeof rtlRender>;
  act(() => {
    result = rtlRender(ui);
  });
  const { rerender, unmount, ...rest } = result!;
  return {
    ...rest,
    rerender(next: React.ReactElement) {
      act(() => {
        rerender(next);
      });
    },
    unmount() {
      act(() => {
        unmount();
      });
    },
  };
}

export const fireEvent = new Proxy(rtlFireEvent, {
  apply(target, thisArg, argArray: Parameters<typeof rtlFireEvent>) {
    let value: unknown;
    act(() => {
      value = Reflect.apply(target, thisArg, argArray);
    });
    return value;
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value === "function") {
      return (...args: unknown[]) => {
        let result: unknown;
        act(() => {
          result = (value as (...methodArgs: unknown[]) => unknown)(...args);
        });
        return result;
      };
    }
    return value;
  },
}) as typeof rtlFireEvent;

export const waitFor: typeof rtlWaitFor = (async (callback, options) => {
  let result: Awaited<ReturnType<typeof callback>>;
  await act(async () => {
    result = await rtlWaitFor(callback, options);
  });
  return result!;
}) as typeof rtlWaitFor;

export function cleanup() {
  rtlCleanup();
}

export { screen };
