#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.resolve("locales");

function load(file) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
}

const en = load("en/common.json");
const rw = load("rw/common.json");
const fr = load("fr/common.json");

const expectations = [
  { key: "common.scope", en: "Scope", rw: "Urwego", fr: "Portée" },
  { key: "reports.cards.transactions", en: "Transactions", rw: "Transakisi", fr: "Transactions" },
  { key: "table.status", en: "Status", rw: "Imiterere", fr: "Statut" },
  { key: "reports.table.month", en: "Month", rw: "Ukwezi", fr: "Mois" },
  { key: "common.cancel", en: "Cancel", rw: "Kureka", fr: "Annuler" },
  { key: "common.retry", en: "Retry", rw: "Ongera", fr: "Réessayer" },
  { key: "common.delete", en: "Delete", rw: "Siba", fr: "Supprimer" },
  { key: "common.save", en: "Save", rw: "Bika", fr: "Enregistrer" },
  { key: "common.downloadPdf", en: "Download PDF", rw: "Kuramo PDF", fr: "Télécharger PDF" },
  { key: "common.downloadCsv", en: "Download CSV", rw: "Kuramo CSV", fr: "Télécharger CSV" },
  {
    key: "admin.queue.title",
    en: "Notification queue",
    rw: "Urutonde rw'ubutumwa",
    fr: "File de notifications",
  },
  { key: "admin.templates.title", en: "SMS templates", rw: "Inyandiko za SMS", fr: "Modèles SMS" },
  { key: "reports.title", en: "Reports", rw: "Raporo", fr: "Rapports" },
  { key: "reports.filters.title", en: "Filters", rw: "Muyunguruzi", fr: "Filtres" },
  { key: "table.members", en: "Members", rw: "Abanyamuryango", fr: "Membres" },
  { key: "table.amount", en: "Amount", rw: "Amafaranga", fr: "Montant" },
  { key: "table.name", en: "Name", rw: "Izina", fr: "Nom" },
  { key: "table.type", en: "Type", rw: "Ubwoko", fr: "Type" },
  // Offline queue & status
  {
    key: "system.offlineQueue.title",
    en: "Offline queue",
    rw: "Urutonde rwo gufata",
    fr: "File hors ligne",
  },
  { key: "system.offlineQueue.status.pending", en: "Queued", rw: "Birategereje", fr: "En file" },
  {
    key: "system.offlineQueue.status.syncing",
    en: "Syncing",
    rw: "Birimo bihuzwa",
    fr: "Synchronisation",
  },
  {
    key: "system.offlineQueue.banner.offline",
    en: "Offline",
    rw: "Bitari ku murongo",
    fr: "Hors ligne",
  },
  { key: "system.offlineQueue.banner.queued", en: "Queued", rw: "Birategereje", fr: "En file" },
  {
    key: "system.offlineQueue.banner.needsRetry",
    en: "Needs retry",
    rw: "Bikeneye kongera kugeragezwa",
    fr: "Relance nécessaire",
  },
  // Connectivity
  { key: "common.online", en: "Online", rw: "Ku murongo", fr: "En ligne" },
  { key: "common.offline", en: "Offline", rw: "Bitari ku murongo", fr: "Hors ligne" },
  // Recon filters
  {
    key: "recon.filters.duplicatesOnly",
    en: "Duplicates only",
    rw: "Byisubiyemo gusa",
    fr: "Doublons seulement",
  },
  {
    key: "recon.filters.lowConfidence",
    en: "Low confidence",
    rw: "Icyizere gito",
    fr: "Faible confiance",
  },
  // MFA / Auth
  {
    key: "profile.mfa.title",
    en: "Two-factor authentication",
    rw: "Umutekano wa 2FA",
    fr: "Authentification à deux facteurs",
  },
  {
    key: "auth.challenge.backupCode",
    en: "Backup code",
    rw: "Kode y’inyunganizi",
    fr: "Code de secours",
  },
  {
    key: "auth.challenge.authCode",
    en: "Authenticator code",
    rw: "Kode ya Authenticator",
    fr: "Code d’authentification",
  },
  // Recon
  { key: "recon.exceptions.title", en: "Exceptions", rw: "Ibibazo byabonetse", fr: "Exceptions" },
  {
    key: "recon.bulk.queuedOffline",
    en: "Queued for sync when you're back online.",
    rw: "Bizahuzwa umaze gusubira kuri murandasi.",
    fr: "Mis en file pour synchronisation dès votre retour en ligne.",
  },
  {
    key: "recon.bulk.queuedOnline",
    en: "Queued for sync when you're online.",
    rw: "Bizahuzwa umaze kuboneka ku murandasi.",
    fr: "Mis en file pour synchronisation lorsque vous êtes en ligne.",
  },
  {
    key: "recon.action.queuedOffline",
    en: "Queued for sync when you're back online.",
    rw: "Byateguwe kuzahuzwa umaze gusubira kuri murandasi.",
    fr: "Mis en file pour synchronisation dès votre retour en ligne.",
  },
  // Auth buttons
  {
    key: "auth.buttons.processing",
    en: "Processing…",
    rw: "Birimo gutunganywa…",
    fr: "Traitement…",
  },
  { key: "auth.buttons.signIn", en: "Sign in", rw: "Injira", fr: "Se connecter" },
  // Common UI
  { key: "common.edit", en: "Edit", rw: "Hindura", fr: "Modifier" },
  { key: "common.apply", en: "Apply", rw: "Shyiraho", fr: "Appliquer" },
  { key: "common.open", en: "Open", rw: "Fungura", fr: "Ouvrir" },
  { key: "common.created", en: "Created", rw: "Byakozwe", fr: "Créé" },
  { key: "common.updated", en: "Updated", rw: "Byavuguruwe", fr: "Mis à jour" },
];

let bad = 0;
for (const rule of expectations) {
  const got = { en: en[rule.key], rw: rw[rule.key], fr: fr[rule.key] };
  for (const locale of ["en", "rw", "fr"]) {
    const expected = rule[locale];
    if (!expected) continue;
    if (got[locale] !== expected) {
      bad++;
      console.log(
        `Inconsistent (${rule.key}) for ${locale}: expected "${expected}", got "${got[locale]}"`
      );
    }
  }
}

if (bad === 0) {
  console.log("i18n glossary consistency: OK");
}
process.exit(bad ? 1 : 0);
