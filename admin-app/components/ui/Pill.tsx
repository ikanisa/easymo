"use client";

import classNames from "classnames";

import styles from "./Pill.module.css";

interface PillProps {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Pill({ tone = "info", children, icon }: PillProps) {
  return (
    <span className={classNames(styles.pill, styles[tone])}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
