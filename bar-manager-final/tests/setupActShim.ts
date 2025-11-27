import Module from "module";
import * as React from "react";

type LoadFn = (request: string, parent: any, isMain: boolean) => any;

const patched = Symbol.for("adminAppReactDomActPatched");

if (!(globalThis as Record<symbol, boolean>)[patched]) {
  const originalLoad: LoadFn = (Module as any)._load;

  (Module as any)._load = function patchedLoad(request: string, parent: any, isMain: boolean) {
    const exports = originalLoad.call(this, request, parent, isMain);

    if (request === "react-dom/test-utils" && exports && typeof exports === "object") {
      const currentAct = Reflect.get(exports, "act");
      if (typeof currentAct === "function" && currentAct !== React.act) {
        Reflect.set(exports, "act", React.act);
      }
    }

    return exports;
  };

  (globalThis as Record<symbol, boolean>)[patched] = true;
}
