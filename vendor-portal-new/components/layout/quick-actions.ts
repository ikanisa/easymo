export const BADGE_TONE_STYLES = {
  critical: "border-red-500/40 bg-red-500/15 text-red-200",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
} as const;

export type QuickActionBadge = { label: string; tone: keyof typeof BADGE_TONE_STYLES };

export type QuickActionDefinition = {
  href: string;
  primary: string;
  secondary: string;
  description: string;
  secondaryDescription: string;
  badge?: QuickActionBadge;
};

export type QuickActionGroupDefinition = {
  id: string;
  title: string;
  subtitle: string;
  actions: QuickActionDefinition[];
};

type Translator = (
  key: string,
  fallback?: string,
  replacements?: Record<string, string | number>
) => string;

const QUICK_ACTION_TRANSLATION_PREFIX = "dashboard.quick.actions" as const;

interface QuickActionFallback {
  primary: string;
  secondary: string;
  description: string;
  secondaryDescription: string;
}

const QUICK_ACTION_FALLBACKS: Record<
  string,
  QuickActionFallback & { href: QuickActionDefinition["href"] }
> = {
  createIkimina: {
    href: "/ikimina",
    primary: "Create Ikimina",
    secondary: "Tangira ikimina",
    description: "Launch a new saving group.",
    secondaryDescription: "Fungura itsinda rishya ry'ubwizigame.",
  },
  importMembers: {
    href: "/ikimina",
    primary: "Import Members",
    secondary: "Injiza abanyamuryango",
    description: "Bulk-upload roster to an ikimina.",
    secondaryDescription: "Kuramo urutonde rw'abanyamuryango mu ikimina.",
  },
  importStatement: {
    href: "/recon",
    primary: "Import Statement",
    secondary: "Shyiramo raporo ya MoMo",
    description: "Drop MoMo statements for parsing.",
    secondaryDescription: "Ohereza raporo za MoMo zisobanurwa.",
  },
  reviewRecon: {
    href: "/recon",
    primary: "Review Recon",
    secondary: "Suzuma guhuzwa",
    description: "Clear unassigned deposits.",
    secondaryDescription: "Huza amafaranga ataritangirwa ibisobanuro.",
  },
  viewAnalytics: {
    href: "/analytics",
    primary: "View Analytics",
    secondary: "Reba isesengura",
    description: "Track contribution trends and risk signals.",
    secondaryDescription: "Kurikirana uko imisanzu ihagaze n'ibimenyetso byo kuburira.",
  },
  generateReport: {
    href: "/reports",
    primary: "Generate Report",
    secondary: "Kora raporo",
    description: "Export SACCO or ikimina statements.",
    secondaryDescription: "Sohora raporo za SACCO cyangwa ikimina.",
  },
  operationsCenter: {
    href: "/ops",
    primary: "Operations Center",
    secondary: "Ikigo cy'imikorere",
    description: "Review incidents, notifications, and MFA health.",
    secondaryDescription: "Reba ibibazo, ubutumwa bwateguwe, n'imiterere ya MFA.",
  },
  accountSecurity: {
    href: "/profile",
    primary: "Account Security",
    secondary: "Umutekano w'uburenganzira",
    description: "Update password and authenticator settings.",
    secondaryDescription: "Hindura ijambobanga n'uburyo bwa 2FA.",
  },
};

const QUICK_ACTION_GROUP_META: Record<
  QuickActionGroupDefinition["id"],
  {
    titleKey: string;
    titleFallback: string;
    subtitleKey: string;
    subtitleFallback: string;
    actions: Array<keyof typeof QUICK_ACTION_FALLBACKS>;
  }
> = {
  tasks: {
    titleKey: "dashboard.quick.group.tasks",
    titleFallback: "Tasks",
    subtitleKey: "dashboard.quick.group.tasksSubtitle",
    subtitleFallback: "Core workflows",
    actions: ["createIkimina", "importMembers", "importStatement", "reviewRecon"],
  },
  insights: {
    titleKey: "dashboard.quick.group.insights",
    titleFallback: "Insights",
    subtitleKey: "dashboard.quick.group.insightsSubtitle",
    subtitleFallback: "Data-driven decisions",
    actions: ["viewAnalytics", "generateReport"],
  },
  operations: {
    titleKey: "dashboard.quick.group.operations",
    titleFallback: "Operations",
    subtitleKey: "dashboard.quick.group.operationsSubtitle",
    subtitleFallback: "Stability & security",
    actions: ["operationsCenter", "accountSecurity"],
  },
};

const QUICK_ACTION_GROUP_ORDER: Array<keyof typeof QUICK_ACTION_GROUP_META> = [
  "tasks",
  "insights",
  "operations",
];

function translateQuickAction(
  t: Translator,
  actionKey: keyof typeof QUICK_ACTION_FALLBACKS,
  badge?: QuickActionBadge
): QuickActionDefinition {
  const fallback = QUICK_ACTION_FALLBACKS[actionKey];
  const prefix = `${QUICK_ACTION_TRANSLATION_PREFIX}.${actionKey}`;
  return {
    href: fallback.href,
    primary: t(`${prefix}.primary`, fallback.primary),
    secondary: t(`${prefix}.secondary`, fallback.secondary),
    description: t(`${prefix}.description`, fallback.description),
    secondaryDescription: t(`${prefix}.secondaryDescription`, fallback.secondaryDescription),
    badge,
  };
}

export function createQuickActionGroups(
  t: Translator
): QuickActionGroupDefinition[] {
  return QUICK_ACTION_GROUP_ORDER.map((groupId) => {
    const meta = QUICK_ACTION_GROUP_META[groupId];
    const actions = meta.actions.map((actionKey) => {
      return translateQuickAction(t, actionKey, undefined);
    });

    return {
      id: groupId,
      title: t(meta.titleKey, meta.titleFallback),
      subtitle: t(meta.subtitleKey, meta.subtitleFallback),
      actions,
    };
  });
}
