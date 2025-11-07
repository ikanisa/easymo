"use client";

import { FormEvent, useState } from "react";
import classNames from "classnames";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getAdminApiPath, getAdminRoutePath } from "@/lib/routes";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
  environmentLabel: string;
}

export function LoginForm({ environmentLabel }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log form state
  if (typeof window !== 'undefined') {
    console.log('[LoginForm] Rendered', { email, password, isSubmitting });
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch(getAdminApiPath("auth", "login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : "Sign-in attempt was not accepted.";
        setError(message);
        return;
      }

      router.replace(getAdminRoutePath("panelDashboard"));
      router.refresh();
    } catch (submitError) {
      console.error("login.submit_failed", submitError);
      setError("Unexpected error while signing in. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.root} aria-label="Admin access login">
      <div className={styles.header}>
        <span className={styles.environmentTag}>{environmentLabel}</span>
        <h1 className={styles.title}>Welcome back, Admin</h1>
        <p className={styles.subtitle}>
          Sign in with your EasyMO admin email to continue to the console.
        </p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={styles.input}
          placeholder="info@ikanisa.com"
        />
        <label className={styles.label} htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={styles.input}
          placeholder="Enter secure password"
        />
        <div className={styles.actions}>
          {error ? (
            <div role="alert" className={styles.error}>
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            variant="default"
            className={classNames("w-full justify-center text-base font-semibold", {
              "opacity-75": isSubmitting,
            })}
            disabled={
              isSubmitting
              || email.trim().length === 0
              || password.trim().length < 8
            }
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className={styles.hint}>
            Forgot the password? Contact the on-call administrator to request a reset.
          </p>
        </div>
      </form>
      <p className={styles.footer}>
        Sessions expire automatically after inactivity. Keep your credentials secure and
        never share them in chat or email.
      </p>
    </section>
  );
}
