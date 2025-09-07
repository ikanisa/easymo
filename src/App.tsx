import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Subscriptions from "./pages/Subscriptions";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Trips from "./pages/Trips";
import WAConsole from "./pages/WAConsole";
import Simulator from "./pages/Simulator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/users" element={<Users />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/wa-console" element={<WAConsole />} />
          <Route path="/admin/simulator" element={<Simulator />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
