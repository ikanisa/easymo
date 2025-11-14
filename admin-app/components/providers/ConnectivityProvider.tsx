"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface ConnectivityContextValue {
  isOnline: boolean;
  isOffline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  isOffline: false,
});

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") return;
    document.documentElement.dataset.networkStatus = isOnline
      ? "online"
      : "offline";
    document.body.dataset.offline = (!isOnline).toString();
  }, [isOnline, mounted]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    isOnline,
    isOffline: !isOnline,
  }), [isOnline]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
