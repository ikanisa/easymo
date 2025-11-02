import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { appRoutes } from "./config";
import { RouteLoadingFallback } from "./RouteLoadingFallback";
import { RouteObserver } from "./RouteObserver";

export const AppRoutes = () => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <RouteObserver />
    <Routes>
      {appRoutes.map(({ key, path, Component }) => (
        <Route key={key} path={path} element={<Component />} />
      ))}
    </Routes>
  </Suspense>
);

export default AppRoutes;
