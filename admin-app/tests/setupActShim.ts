import Module from "node:module";
import * as React from "react";

type LoadFn = typeof Module._load;

const patched = Symbol.for("adminAppReactDomActPatched");

if (!(globalThis as Record<symbol, boolean>)[patched]) {
  const originalLoad: LoadFn = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
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
