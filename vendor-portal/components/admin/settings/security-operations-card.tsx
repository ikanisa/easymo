"use client";

import { useTranslation } from "@/providers/i18n-provider";

export function SecurityOperationsCard() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-2">
        {t(
          "admin.settings.securityDescription",
          "Security operations are managed through Supabase authentication."
        )}
      </p>
      <ul className="list-disc space-y-2 pl-6 text-xs text-neutral-3">
        <li>
          {t(
            "admin.settings.securityHint.logs",
            "All authentication events are logged in the audit trail."
          )}
        </li>
        <li>
          {t(
            "admin.settings.securityHint.password",
            "Users can reset their passwords through the standard password reset flow."
          )}
        </li>
      </ul>
    </div>
  );
}
