import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { StationClient } from "@station/api/stationClient";
import type { StationLoginPayload, StationSession } from "@station/api/types";

const STORAGE_KEY = "station.session";

type StationSessionContextValue = {
  session: StationSession | null;
  client: StationClient;
  login: (payload: StationLoginPayload) => Promise<void>;
  logout: () => void;
};

const StationSessionContext = createContext<StationSessionContextValue | undefined>(undefined);

const loadStoredSession = (): StationSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StationSession;
    if (!parsed || !parsed.token) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("station.session.read_failed", error);
    return null;
  }
};

type ProviderProps = {
  children: ReactNode;
};

export const StationSessionProvider = ({ children }: ProviderProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<StationSession | null>(() => loadStoredSession());

  const client = useMemo(() => new StationClient({ token: session?.token ?? null }), [session?.token]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const login = useCallback(
    async (payload: StationLoginPayload) => {
      const nextSession = await client.login(payload);
      setSession(nextSession);
      navigate("/", { replace: true });
    },
    [client, navigate],
  );

  const logout = useCallback(() => {
    setSession(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      client,
      login,
      logout,
    }),
    [session, client, login, logout],
  );

  return <StationSessionContext.Provider value={value}>{children}</StationSessionContext.Provider>;
};

export const useStationSession = () => {
  const context = useContext(StationSessionContext);
  if (!context) {
    throw new Error("useStationSession must be used within StationSessionProvider");
  }
  return context;
};
