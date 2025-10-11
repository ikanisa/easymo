import { Pill } from "@/components/ui/Pill";
import styles from "../AssistantPanel.module.css";

type LimitationsListProps = {
  limitations: readonly string[];
};

export function LimitationsList({ limitations }: LimitationsListProps) {
  return (
    <div className={styles.limitations} role="note">
      {limitations.map((item, index) => (
        <Pill key={index} tone="warning">
          {item}
        </Pill>
      ))}
    </div>
  );
}
