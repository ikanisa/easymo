import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  BarChart3,
  CreditCard,
  Settings,
  Users,
  Route,
  Menu,
  X,
  Terminal,
  Smartphone,
  Wallet,
  Coins,
  Heart,
  CalendarClock,
  Bolt,
  MapPin,
  Clock4,
  Radar,
} from "lucide-react";
import { showDevTools, shouldUseMock } from "@/lib/env";

const isMockMode = shouldUseMock();
const baseNavigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Trips", href: "/trips", icon: Route },
  { name: "Favorites", href: "/favorites", icon: Heart },
  { name: "Schedule Trip", href: "/schedule-trip", icon: CalendarClock },
  { name: "Quick Actions", href: "/quick-actions", icon: Bolt },
  { name: "Driver Parking", href: "/driver-parking", icon: MapPin },
  { name: "Driver Availability", href: "/driver-availability", icon: Clock4 },
  { name: "Matches", href: "/matches", icon: Radar },
  ...(isMockMode ? [{ name: "Tokens", href: "/tokens", icon: Wallet }] : []),
  { name: "Campaigns", href: "/campaigns", icon: MessageCircle },
  { name: "Baskets", href: "/baskets", icon: Coins },
  { name: "Marketplace", href: "/marketplace", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Operations", href: "/operations", icon: Terminal },
  { name: "Developer", href: "/developer", icon: Smartphone },
];

const devNavigation = [
  { name: "WA Console", href: "/admin/wa-console", icon: Terminal, devOnly: true },
  { name: "Flow Simulator", href: "/admin/simulator", icon: Smartphone, devOnly: true },
];

const navigation = showDevTools() ? [...baseNavigation, ...devNavigation] : baseNavigation;

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Reusable navigation component to avoid duplication
  const NavigationMenu = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="space-y-2">
      {navigation.map((item) => (
        <Link
          key={item.name}
          to={item.href}
          className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            location.pathname === item.href
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
          onClick={onItemClick}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.name}</span>
        </Link>
      ))}
    </nav>
  );


  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 block lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <nav className="fixed top-0 left-0 bottom-0 flex w-5/6 max-w-sm flex-col bg-card border-r">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-6 w-6 text-whatsapp" />
                <span className="font-bold text-lg">Mobility Admin</span>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 px-4 py-6">
              <NavigationMenu onItemClick={() => setSidebarOpen(false)} />
            </div>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <Card className="flex flex-col flex-grow border-0 rounded-none shadow-lg">
          <div className="flex items-center space-x-2 p-6 border-b">
            <MessageCircle className="h-8 w-8 text-whatsapp" />
            <div>
              <h1 className="font-bold text-lg">Mobility Admin</h1>
              <p className="text-xs text-muted-foreground">WhatsApp Platform</p>
            </div>
          </div>
          <div className="flex-1 px-6 py-6">
            <NavigationMenu />
          </div>
          <div className="p-6 border-t">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 bg-success rounded-full"></div>
              <span>System Online</span>
            </div>
          </div>
        </Card>
      </nav>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4 shadow-sm lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6 text-whatsapp" />
            <span className="font-semibold">Mobility Admin</span>
          </div>
        </div>

        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
