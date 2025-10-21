import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminGuard } from "@/components/AdminGuard";
import Index from "./pages/Index";
import Subscriptions from "./pages/Subscriptions";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Trips from "./pages/Trips";
import WAConsole from "./pages/WAConsole";
import Simulator from "./pages/Simulator";
import Operations from "./pages/Operations";
import Developer from "./pages/Developer";
import TokensIssue from "./pages/tokens/Issue";
import TokensWallets from "./pages/tokens/Wallets";
import TokensWalletDetail from "./pages/tokens/WalletDetail";
import TokensShops from "./pages/tokens/Shops";
import TokensReports from "./pages/tokens/Reports";
import CampaignsPage from "./marketing/CampaignsPage";
import Baskets from "./pages/Baskets";
import Marketplace from "./pages/Marketplace";
import NotFound from "./pages/NotFound";
import FavoritesPage from "./pages/Favorites";
import ScheduleTripPage from "./pages/ScheduleTrip";
import QuickActionsPage from "./pages/QuickActions";
import DriverParkingPage from "./pages/DriverParking";
import DriverAvailabilityPage from "./pages/DriverAvailability";
import MatchesPage from "./pages/Matches";
import AgentPatternsPage from "./pages/AgentPatterns";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AdminGuard>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/users" element={<Users />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/schedule-trip" element={<ScheduleTripPage />} />
            <Route path="/quick-actions" element={<QuickActionsPage />} />
            <Route path="/driver-parking" element={<DriverParkingPage />} />
            <Route path="/driver-availability" element={<DriverAvailabilityPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/agent-tooling" element={<AgentTooling />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tokens" element={<TokensWallets />} />
            <Route path="/tokens/issue" element={<TokensIssue />} />
            <Route path="/tokens/wallets" element={<TokensWallets />} />
            <Route path="/tokens/wallets/:id" element={<TokensWalletDetail />} />
            <Route path="/tokens/shops" element={<TokensShops />} />
            <Route path="/tokens/reports" element={<TokensReports />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/baskets" element={<Baskets />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/realtime" element={<Realtime />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="/agent-patterns" element={<AgentPatternsPage />} />
            <Route path="/admin/wa-console" element={<WAConsole />} />
            <Route path="/admin/simulator" element={<Simulator />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
