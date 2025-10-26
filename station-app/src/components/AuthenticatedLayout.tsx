import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { useStationSession } from "@station/contexts/StationSessionContext";

import "@station/styles/layout.css";

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { path: "/", label: "Home" },
  { path: "/redeem/qr", label: "Scan QR" },
  { path: "/redeem/code", label: "Enter Code" },
  { path: "/balance", label: "Balance" },
  { path: "/history", label: "History" },
];

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const { session, logout } = useStationSession();
  const location = useLocation();

  return (
    <div className="layout">
      <header className="layout__header" aria-label="Station context">
        <div>
          <p className="layout__station">{session?.stationName ?? "Station"}</p>
          <p className="layout__operator" aria-live="polite">
            Operator: {session?.operatorName ?? ""}
          </p>
        </div>
        <button className="layout__logout" onClick={logout} type="button">
          Sign out
        </button>
      </header>
      <nav className="layout__nav" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={isActive ? "layout__nav-item layout__nav-item--active" : "layout__nav-item"}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main className="layout__content" id="main-content">
        {children}
      </main>
    </div>
  );
};
