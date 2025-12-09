import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createQuickActionGroups } from "@/components/layout/quick-actions";
import enCommon from "@/locales/en/common.json";
import enStaff from "@/locales/en/staff.json";
import rwCommon from "@/locales/rw/common.json";
import rwStaff from "@/locales/rw/staff.json";
import type { SupportedLocale } from "@/lib/i18n/locales";

const TEST_DICTIONARIES: Record<SupportedLocale, Record<string, string>> = {
  en: { ...enCommon, ...enStaff } as Record<string, string>,
  rw: { ...rwCommon, ...rwStaff } as Record<string, string>,
  fr: { ...enCommon, ...enStaff } as Record<string, string>,
};

function translateFor(locale: SupportedLocale) {
  const dictionary = TEST_DICTIONARIES[locale];
  return (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
}

function QuickActionsSnapshot({
  locale,
}: {
  locale: SupportedLocale;
}) {
  const t = translateFor(locale);
  const groups = createQuickActionGroups(t);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.id}>
          <h2>{group.title}</h2>
          <p>{group.subtitle}</p>
          <ul>
            {group.actions.map((action) => (
              <li key={`${group.id}-${action.primary}`}>
                <span>{action.primary}</span>
                <span>{action.description}</span>
                <span>{action.secondary}</span>
                <span>{action.secondaryDescription}</span>
                {action.badge ? <span>{`${action.badge.tone}:${action.badge.label}`}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

describe("AppShell quick action localisation", () => {
  function renderSnapshot(locale: SupportedLocale) {
    const { container } = render(<QuickActionsSnapshot locale={locale} />);
    return container.innerHTML;
  }

  it("matches the English snapshot", () => {
    const html = renderSnapshot("en");
    expect(html).toMatchInlineSnapshot(
      `"<div><section><h2>Tasks</h2><p>Core workflows</p><ul><li><span>Create Ikimina</span><span>Launch a new saving group.</span><span>Tangira ikimina</span><span>Fungura itsinda rishya ry'ubwizigame.</span></li><li><span>Import Members</span><span>Bulk-upload roster to an ikimina.</span><span>Injiza abanyamuryango</span><span>Kuramo urutonde rw'abanyamuryango mu ikimina.</span></li><li><span>Import Statement</span><span>Drop MoMo statements for parsing.</span><span>Shyiramo raporo ya MoMo</span><span>Ohereza raporo za MoMo zisobanurwa.</span></li><li><span>Review Recon</span><span>Clear unassigned deposits.</span><span>Suzuma guhuzwa</span><span>Huza amafaranga ataritangirwa ibisobanuro.</span></li></ul></section><section><h2>Insights</h2><p>Data-driven decisions</p><ul><li><span>View Analytics</span><span>Track contribution trends and risk signals.</span><span>Reba isesengura</span><span>Kurikirana uko imisanzu ihagaze n'ibimenyetso byo kuburira.</span></li><li><span>Generate Report</span><span>Export SACCO or ikimina statements.</span><span>Kora raporo</span><span>Sohora raporo za SACCO cyangwa ikimina.</span></li></ul></section><section><h2>Operations</h2><p>Stability &amp; security</p><ul><li><span>Operations Center</span><span>Review incidents, notifications, and MFA health.</span><span>Ikigo cy'imikorere</span><span>Reba ibibazo, ubutumwa bwateguwe, n'imiterere ya MFA.</span></li><li><span>Account Security</span><span>Update password and authenticator settings.</span><span>Umutekano w'uburenganzira</span><span>Hindura ijambobanga n'uburyo bwa 2FA.</span></li></ul></section></div>"`
    );
  });

  it("matches the Kinyarwanda snapshot", () => {
    const html = renderSnapshot("rw");
    expect(html).toMatchInlineSnapshot(
      `"<div><section><h2>Tasks</h2><p>Core workflows</p><ul><li><span>Tangira ikimina</span><span>Fungura itsinda rishya ry'ubwizigame.</span><span>Create Ikimina</span><span>Launch a new saving group.</span></li><li><span>Injiza abanyamuryango</span><span>Kuramo urutonde rw'abanyamuryango mu ikimina.</span><span>Import Members</span><span>Bulk-upload roster to an ikimina.</span></li><li><span>Shyiramo raporo ya MoMo</span><span>Ohereza raporo za MoMo zisobanurwa.</span><span>Import Statement</span><span>Drop MoMo statements for parsing.</span></li><li><span>Suzuma guhuzwa</span><span>Huza amafaranga ataritangirwa ibisobanuro.</span><span>Review Recon</span><span>Clear unassigned deposits.</span></li></ul></section><section><h2>Insights</h2><p>Data-driven decisions</p><ul><li><span>Reba isesengura</span><span>Kurikirana uko imisanzu ihagaze n'ibimenyetso byo kuburira.</span><span>View Analytics</span><span>Track contribution trends and risk signals.</span></li><li><span>Kora raporo</span><span>Sohora raporo za SACCO cyangwa ikimina.</span><span>Generate Report</span><span>Export SACCO or ikimina statements.</span></li></ul></section><section><h2>Operations</h2><p>Stability &amp; security</p><ul><li><span>Ikigo cy'imikorere</span><span>Reba ibibazo, ubutumwa bwateguwe, n'imiterere ya MFA.</span><span>Operations Center</span><span>Review incidents, notifications, and MFA health.</span></li><li><span>Umutekano w'uburenganzira</span><span>Hindura ijambobanga n'uburyo bwa 2FA.</span><span>Account Security</span><span>Update password and authenticator settings.</span></li></ul></section></div>"`
    );
  });
});
