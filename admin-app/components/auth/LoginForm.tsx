"use client";

import { FormEvent, useState } from "react";
import classNames from "classnames";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
  environmentLabel: string;
}

export function LoginForm({ environmentLabel }: LoginFormProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : "Access token was not accepted.";
        setError(message);
        return;
      }

      router.replace("/dashboard");
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
        <h1 className={styles.title}>Admin access required</h1>
        <p className={styles.subtitle}>
          Enter the one-time operations token issued by the platform team to
          continue to the console.
        </p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="admin-access-token">
          Access token
        </label>
        <input
          id="admin-access-token"
          name="token"
          type="password"
          autoComplete="off"
          required
          minLength={8}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className={styles.input}
          placeholder="Enter secure token"
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
            disabled={isSubmitting || token.trim().length < 8}
          >
            {isSubmitting ? "Verifying…" : "Sign in"}
          </Button>
          <p className={styles.hint}>
            Tokens rotate frequently. Contact the on-call administrator if you
            need access or your token has expired.
          </p>
        </div>
      </form>
      <p className={styles.footer}>
        Sessions expire automatically after a period of inactivity. Keep your
        token secure and never share it in chat or email.
      </p>
    </section>
  );
}
