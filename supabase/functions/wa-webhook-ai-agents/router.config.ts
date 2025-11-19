export type LocaleTemplate = {
  intent: string;
  templateName: string;
  locale: string;
  description: string;
  sampleText: string;
  variables: string[];
};

export type WaRouterConfig = {
  proactiveTemplates: Record<string, LocaleTemplate[]>;
  featureToggles: {
    listingAlerts: boolean;
    buyerMatches: boolean;
    paymentReminders: boolean;
  };
};

const proactiveTemplates: WaRouterConfig["proactiveTemplates"] = {
  en: [
    {
      intent: "listing_live",
      templateName: "agri_listing_live_en",
      locale: "en",
      description: "Notify growers when their new listing is published.",
      sampleText: "Hi {{1}}, your {{2}} listing is now live for {{3}}.",
      variables: ["farmer_name", "produce_name", "quantity"],
    },
    {
      intent: "buyer_match",
      templateName: "agri_match_found_en",
      locale: "en",
      description: "Alert buyers when a matching listing is found.",
      sampleText: "We found a {{1}} offer from {{2}} at {{3}} per {{4}}.",
      variables: ["produce_name", "farm_name", "price", "unit"],
    },
    {
      intent: "payment_follow_up",
      templateName: "agri_payment_prompt_en",
      locale: "en",
      description: "Nudge buyers to confirm payments after delivery.",
      sampleText: "Please confirm the {{1}} payment of {{2}} for order {{3}}.",
      variables: ["produce_name", "amount", "order_code"],
    },
  ],
  fr: [
    {
      intent: "listing_live",
      templateName: "agri_listing_live_fr",
      locale: "fr",
      description: "Informer les agriculteurs que leur annonce est publiée.",
      sampleText: "Bonjour {{1}}, votre annonce {{2}} est en ligne avec {{3}}.",
      variables: ["nom_agriculteur", "produit", "quantite"],
    },
    {
      intent: "buyer_match",
      templateName: "agri_match_found_fr",
      locale: "fr",
      description: "Alerter les acheteurs lorsqu'une offre correspondante est trouvée.",
      sampleText: "Nous avons trouvé {{1}} chez {{2}} à {{3}} par {{4}}.",
      variables: ["produit", "ferme", "prix", "unite"],
    },
    {
      intent: "payment_follow_up",
      templateName: "agri_payment_prompt_fr",
      locale: "fr",
      description: "Relancer les paiements après confirmation de livraison.",
      sampleText: "Merci de confirmer le paiement {{1}} de {{2}} pour la commande {{3}}.",
      variables: ["produit", "montant", "commande"],
    },
  ],
  rw: [
    {
      intent: "listing_live",
      templateName: "agri_listing_live_rw",
      locale: "rw",
      description: "Ibwiriza abahinzi ko itangazo ryabo ryashyizwe ku isoko.",
      sampleText: "Muraho {{1}}, itangazo rya {{2}} rifunguye ku bwinshi bwa {{3}}.",
      variables: ["izina_ryumuhinzi", "igicuruzwa", "ingano"],
    },
    {
      intent: "buyer_match",
      templateName: "agri_match_found_rw",
      locale: "rw",
      description: "Kumenyesha abaguzi ko babonye icyifuzo kibahuje.",
      sampleText: "Habonetse {{1}} kuri {{2}} ku giciro cya {{3}} kuri {{4}}.",
      variables: ["igicuruzwa", "umurima", "igiciro", "igipimo"],
    },
    {
      intent: "payment_follow_up",
      templateName: "agri_payment_prompt_rw",
      locale: "rw",
      description: "Kwibutsa kwemeza ubwishyu nyuma yo gushyikiriza umusaruro.",
      sampleText: "Emeza ko wishyuye {{1}} ingana na {{2}} kuri commande {{3}}.",
      variables: ["igicuruzwa", "amafaranga", "kode_ya_commande"],
    },
  ],
};

export const waRouterConfig: WaRouterConfig = {
  proactiveTemplates,
  featureToggles: {
    listingAlerts: false,
    buyerMatches: false,
    paymentReminders: false,
  },
};
