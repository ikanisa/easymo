export type AdminAlertSeverity = "critical" | "high" | "medium" | "low";
export type AdminAlertChannel = "whatsapp" | "email" | "slack" | "pagerduty";

type AlertDefinition = {
  key: string;
  label: string;
  description: string;
  severity: AdminAlertSeverity;
  defaultChannels: string[];
};

export const DEFAULT_ALERT_CHANNELS: AdminAlertChannel[] = [
  "whatsapp",
  "email",
  "slack",
  "pagerduty",
] as const;

export const ALERT_DEFINITIONS: AlertDefinition[] = [
  {
    key: "INS_OCR_FAIL",
    label: "Insurance OCR failures",
    description:
      "Trigger when insurance OCR uploads cannot be processed or the worker times out.",
    severity: "critical",
    defaultChannels: ["whatsapp", "email"],
  },
  {
    key: "INS_ADMIN_NOTIFY_FAIL",
    label: "Insurance admin notify failures",
    description: "Raised when OCR follow-up messages to admins cannot be sent.",
    severity: "high",
    defaultChannels: ["whatsapp"],
  },
  {
    key: "MATCHES_ERROR",
    label: "Mobility matching errors",
    description:
      "Surface allocator failures affecting trip offers, nearby lookups, or schedule refreshes.",
    severity: "high",
    defaultChannels: ["slack", "whatsapp"],
  },
  {
    key: "NOTIFY_SEND_FAIL",
    label: "Notification send failures",
    description:
      "Notify when notification retries are exhausted or dispatchers degrade.",
    severity: "high",
    defaultChannels: ["slack", "email"],
  },
  {
    key: "NOTIFY_CRON_DISABLED",
    label: "Notification cron disabled",
    description: "Raised when the notification worker cron stops running.",
    severity: "medium",
    defaultChannels: ["slack"],
  },
];

export function definitionForAlert(key: string) {
  return ALERT_DEFINITIONS.find((definition) => definition.key === key);
}
