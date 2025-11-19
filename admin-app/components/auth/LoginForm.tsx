"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import { useSupabaseAuth } from "@/components/providers/SupabaseAuthProvider";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const { signInWithPassword } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = submitting || isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isLoading) return;
    
    setError(null);
    setSubmitting(true);
    
    console.log('[LOGIN] Starting login attempt', { email, timestamp: new Date().toISOString() });
    
    try {
      const user = await signInWithPassword(email, password);
      console.log('[LOGIN] Login successful, redirecting to dashboard');
      setEmail("");
      setPassword("");

      // Use Next.js router for client-side navigation with transition
      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
    } catch (cause) {
      console.error("auth.login.failed", cause);
      const message = cause instanceof Error ? cause.message : null;
      setError(message || "Unexpected error during sign-in.");
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Admin sign-in</h1>
        <p className={styles.subheading}>Access operations tools with your admin account.</p>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <label className={styles.field} htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            required
            aria-required="true"
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
            disabled={isLoading}
            required
            aria-required="true"
          />
        </label>
        <button 
          className={classNames(styles.submit, isLoading && styles.loading)} 
          type="submit" 
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
