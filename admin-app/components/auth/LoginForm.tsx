"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    
    console.log('[LOGIN] Starting login attempt', { email, timestamp: new Date().toISOString() });
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.error('[LOGIN] Login failed', { status: response.status, payload });
        setError(typeof payload?.message === "string" ? payload.message : "Unable to sign in.");
        return;
      }

      console.log('[LOGIN] Login successful, redirecting to dashboard');
      setEmail("");
      setPassword("");
      // Use full page reload to prevent redirect loops and ensure clean state
      window.location.href = "/dashboard";
    } catch (cause) {
      console.error("auth.login.failed", cause);
      setError("Unexpected error during sign-in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Admin sign-in</h1>
        <p className={styles.subheading}>Access operations tools with your admin account.</p>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.field} htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            required
          />
        </label>
        <label className={styles.field} htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            required
          />
        </label>
        <button className={classNames(styles.submit, submitting && styles.loading)} type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
