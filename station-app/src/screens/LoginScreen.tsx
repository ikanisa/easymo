import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { useStationSession } from "@station/contexts/StationSessionContext";

import "@station/styles/forms.css";
import "@station/styles/login.css";

export const LoginScreen = () => {
  const { session, login } = useStationSession();
  const [stationCode, setStationCode] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login({ stationCode, passcode });
    } catch (loginError) {
      setError("Incorrect station code or PIN. Try again or contact support.");
      console.error("station.login.error", loginError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <form className="form-card" onSubmit={handleSubmit} aria-labelledby="login-title">
        <h1 id="login-title" className="form-card__title">
          Station access
        </h1>
        <p className="form-card__subtitle">Enter your station code and PIN to continue.</p>
        <div className="form-field">
          <label className="form-label" htmlFor="stationCode">
            Station code
          </label>
          <input
            id="stationCode"
            className="form-input"
            value={stationCode}
            onChange={(event) => setStationCode(event.target.value.toUpperCase())}
            autoComplete="off"
            placeholder="EX-123"
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="passcode">
            PIN
          </label>
          <input
            id="passcode"
            className="form-input"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="off"
            placeholder="••••"
            type="password"
            required
            inputMode="numeric"
            pattern="[0-9]{4,6}"
          />
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="form-button" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="form-helper">Trouble logging in? Call the ops hotline.</p>
      </form>
    </div>
  );
};
