"use client";

import { useState } from "react";
import type { User } from "@/lib/schemas";
import styles from "./UserDrawer.module.css";
import { Drawer } from "@/components/ui/Drawer";

// Local utility to mask phone numbers
function maskMsisdn(input?: string | null): string {
  if (!input) return "••••••••";
  const clean = input.replace(/\D/g, "");
  if (clean.length < 4) return "••••••••";
  return `•••• ${clean.slice(-4)}`;
}

interface UserDrawerProps {
  user: User | null;
  onClose: () => void;
}

export function UserDrawer({ user, onClose }: UserDrawerProps) {
  const title = user?.displayName ?? maskMsisdn(user?.msisdn) ?? "User details";

  return (
    <Drawer title={title} onClose={onClose}>
      <p className={styles.subtitle}>{maskMsisdn(user?.msisdn)}</p>
      {user
        ? (
          <div className={styles.content}>
            <section>
              <h3>Profile</h3>
              <dl className={styles.definitionList}>
                <div>
                  <dt>Status</dt>
                  <dd>{user.status}</dd>
                </div>
                <div>
                  <dt>Locale</dt>
                  <dd>{user.locale}</dd>
                </div>
                <div>
                  <dt>Roles</dt>
                  <dd>{user.roles.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(user.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Last seen</dt>
                  <dd>
                    {user.lastSeenAt
                      ? new Date(user.lastSeenAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Upcoming sections</h3>
              <p>
                Voucher history, insurance quotes, and support notes will
                surface here in future tasks.
              </p>
            </section>
          </div>
        )
        : <div className={styles.content}>Select a user to see details.</div>}
    </Drawer>
  );
}

interface UserDrawerTriggerProps {
  children: React.ReactNode;
  user: User;
}

export function UserDrawerTrigger({ children, user }: UserDrawerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>
      {isOpen
        ? <UserDrawer user={user} onClose={() => setIsOpen(false)} />
        : null}
    </div>
  );
}
