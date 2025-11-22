"use client";

import classNames from "classnames";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || isPending) return;

    setError(null);
    setSubmitting(true);
    
    console.log('[LOGIN] Starting login attempt', { email, timestamp: new Date().toISOString() });
    
    try {
      await signInWithPassword(email, password);
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

  const isLoading = submitting || isPending;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
          autoComplete="email"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={classNames(styles.submit, isLoading && styles.loading)}
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
