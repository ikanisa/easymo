import type { LocaleCode } from "./types/index.js";

type CopyVariant = {
  short: string;
  long: string;
};

type ClientSurfaceCopy = {
  home: {
    metadata: {
      title: CopyVariant;
      description: CopyVariant;
    };
    activity: {
      fallbackLabel: CopyVariant;
    };
    groups: {
      totalSaved: CopyVariant;
      pending: CopyVariant;
    };
  };
};

type AdminSurfaceCopy = {
  dashboard: {
    title: CopyVariant;
    description: CopyVariant;
  };
};

type MobileSurfaceCopy = {
  offline: {
    title: CopyVariant;
    description: CopyVariant;
  };
};

type SurfaceCopy = {
  client: ClientSurfaceCopy;
  admin: AdminSurfaceCopy;
  mobile: MobileSurfaceCopy;
};

const FALLBACK: LocaleCode = "en-RW";

const SURFACE_COPY: Record<LocaleCode, SurfaceCopy> = {
  "en-RW": {
    client: {
      home: {
        metadata: {
          title: {
            short: "Home",
            long: "SACCO+ client dashboard",
          },
          description: {
            short: "Track balances and actions",
            long: "Track your balance, quick actions, and upcoming SACCO deadlines.",
          },
        },
        activity: {
          fallbackLabel: {
            short: "Transaction",
            long: "Recent transaction",
          },
        },
        groups: {
          totalSaved: {
            short: "Total saved",
            long: "Total saved",
          },
          pending: {
            short: "Pending",
            long: "Pending contributions",
          },
        },
      },
    },
    admin: {
      dashboard: {
        title: {
          short: "Admin",
          long: "Operations dashboard",
        },
        description: {
          short: "Monitor member activity",
          long: "Monitor member activity, reconcile payments, and track outstanding tasks.",
        },
      },
    },
    mobile: {
      offline: {
        title: {
          short: "Offline mode",
          long: "Limited connectivity mode",
        },
        description: {
          short: "Sync when you reconnect",
          long: "You can keep drafting entries offline. We will sync once you reconnect.",
        },
      },
    },
  },
  "rw-RW": {
    client: {
      home: {
        metadata: {
          title: {
            short: "Ahabanza",
            long: "Ibimina - ikibaho cyawe",
          },
          description: {
            short: "Reba konti n'ibikorwa",
            long: "Kurikira amakuru ya konti yawe, imirimo yihuse n'amatariki yo kwishyura.",
          },
        },
        activity: {
          fallbackLabel: {
            short: "Ibikorwa",
            long: "Igikorwa giheruka",
          },
        },
        groups: {
          totalSaved: {
            short: "Byizigamiwe",
            long: "Umubare wose wizigamiwe",
          },
          pending: {
            short: "Biracyategereje",
            long: "Ibiri mu nzira yo kwemezwa",
          },
        },
      },
    },
    admin: {
      dashboard: {
        title: {
          short: "Ubuyobozi",
          long: "Ikibaho cy'abakora isuzuma",
        },
        description: {
          short: "Kurikirana ibikorwa",
          long: "Kurikirana ibikorwa by'abanyamuryango, kwemeza ubwishyu no kugenzura ibisabwa.",
        },
      },
    },
    mobile: {
      offline: {
        title: {
          short: "Ntuhari ku murongo",
          long: "Ukoresha nta internet",
        },
        description: {
          short: "Byoherezwa ugarutse ku murongo",
          long: "Ushobora gukomeza kubika amakuru. Tuzohereza byose igihe ubonye internet.",
        },
      },
    },
  },
  "fr-RW": {
    client: {
      home: {
        metadata: {
          title: {
            short: "Accueil",
            long: "Tableau de bord SACCO+",
          },
          description: {
            short: "Suivez vos comptes",
            long: "Suivez votre solde, vos actions rapides et les échéances à venir.",
          },
        },
        activity: {
          fallbackLabel: {
            short: "Transaction",
            long: "Transaction récente",
          },
        },
        groups: {
          totalSaved: {
            short: "Épargné",
            long: "Total épargné",
          },
          pending: {
            short: "En attente",
            long: "Contributions en attente",
          },
        },
      },
    },
    admin: {
      dashboard: {
        title: {
          short: "Admin",
          long: "Tableau des opérations",
        },
        description: {
          short: "Suivez les membres",
          long: "Suivez l'activité des membres, validez les paiements et contrôlez les tâches.",
        },
      },
    },
    mobile: {
      offline: {
        title: {
          short: "Mode hors ligne",
          long: "Mode connectivité limitée",
        },
        description: {
          short: "Synchronisation au retour",
          long: "Continuez à rédiger hors ligne. Nous synchroniserons dès le retour du réseau.",
        },
      },
    },
  },
};

function getCopyForLocale(locale: LocaleCode): SurfaceCopy {
  if (SURFACE_COPY[locale]) {
    return SURFACE_COPY[locale];
  }
  return SURFACE_COPY[FALLBACK];
}

export function getSurfaceCopy(locale: LocaleCode, surface: keyof SurfaceCopy = "client") {
  const localized = getCopyForLocale(locale);
  return localized[surface];
}

export function getSurfaceCopyVariant(
  locale: LocaleCode,
  surface: keyof SurfaceCopy,
  selector: (copy: SurfaceCopy[keyof SurfaceCopy]) => CopyVariant,
  variant: keyof CopyVariant = "long"
): string {
  const surfaceCopy = getSurfaceCopy(locale, surface);
  const target = selector(surfaceCopy);
  return target[variant];
}

export type { CopyVariant, SurfaceCopy };
