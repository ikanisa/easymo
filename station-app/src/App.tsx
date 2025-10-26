import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { StationSessionProvider, useStationSession } from "@station/contexts/StationSessionContext";
import { AuthenticatedLayout } from "@station/components/AuthenticatedLayout";
import { LoginScreen } from "@station/screens/LoginScreen";
import { HomeScreen } from "@station/screens/HomeScreen";
import { RedeemCodeScreen } from "@station/screens/RedeemCodeScreen";
import { RedeemQrScreen } from "@station/screens/RedeemQrScreen";
import { RedeemResultScreen } from "@station/screens/RedeemResultScreen";
import { BalanceScreen } from "@station/screens/BalanceScreen";
import { HistoryScreen } from "@station/screens/HistoryScreen";

const ProtectedRoutes = () => {
  const { session } = useStationSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/redeem/qr" element={<RedeemQrScreen />} />
        <Route path="/redeem/code" element={<RedeemCodeScreen />} />
        <Route path="/redeem/result" element={<RedeemResultScreen />} />
        <Route path="/balance" element={<BalanceScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
};

const AppRoutes = () => {
  const { session } = useStationSession();
  const initialPath = useMemo(() => (session ? "/" : "/login"), [session]);

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/*" element={<ProtectedRoutes />} />
      <Route path="*" element={<Navigate to={initialPath} replace />} />
    </Routes>
  );
};

const App = () => (
  <StationSessionProvider>
    <AppRoutes />
  </StationSessionProvider>
);

export default App;
