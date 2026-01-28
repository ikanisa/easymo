/**
 * Reusable UI Components
 * Pre-built message components for common patterns
 */

import type { Language } from "../../config/constants.ts";
import { WA_IDS } from "../../config/constants.ts";
import { t } from "../../i18n/index.ts";
import type { ButtonSpec,ListMessageOptions } from "../../types/messages.ts";
import { buttons, list,text } from "../builder.ts";

// ============================================================================
// CONFIRMATION COMPONENTS
// ============================================================================

/**
 * Success confirmation message
 */
export function successMessage(
  title: string,
  details: string[],
  locale: Language = "en"
): string {
  const builder = text()
    .withEmoji("✅")
    .bold(title)
    .paragraph();

  for (const detail of details) {
    builder.text(detail).break();
  }

  return builder.build();
}

/**
 * Error message
 */
export function errorMessage(
  message: string,
  suggestion?: string,
  locale: Language = "en"
): string {
  const builder = text()
    .withEmoji("❌")
    .text(message);

  if (suggestion) {
    builder.paragraph().text(suggestion);
  }

  return builder.build();
}

/**
 * Warning message
 */
export function warningMessage(
  message: string,
  locale: Language = "en"
): string {
  return text()
    .withEmoji("⚠️")
    .text(message)
    .build();
}

/**
 * Info message
 */
export function infoMessage(
  message: string,
  locale: Language = "en"
): string {
  return text()
    .withEmoji("ℹ️")
    .text(message)
    .build();
}

// ============================================================================
// CONFIRMATION DIALOGS
// ============================================================================

/**
 * Confirmation dialog with yes/no buttons
 */
export function confirmationDialog(
  message: string,
  confirmId: string,
  cancelId: string = "cancel",
  locale: Language = "en"
): { body: string; buttons: ButtonSpec[] } {
  return buttons()
    .body(message)
    .addButton(confirmId, t(locale, "common.confirm"))
    .addButton(cancelId, t(locale, "common.cancel"))
    .build();
}

/**
 * Action confirmation with custom buttons
 */
export function actionConfirmation(
  message: string,
  actions: Array<{ id: string; title: string }>,
  locale: Language = "en"
): { body: string; buttons: ButtonSpec[] } {
  const builder = buttons().body(message);
  
  for (const action of actions.slice(0, 3)) {
    builder.addButton(action.id, action.title);
  }
  
  return builder.build();
}

// ============================================================================
// MENU COMPONENTS
// ============================================================================

/**
 * Home menu list
 */
export function homeMenuList(locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "home.title"))
    .body(t(locale, "home.body"))
    .button(t(locale, "common.open"))
    .section(t(locale, "home.section"))
    .addRow("rides", t(locale, "home.rides.title"), t(locale, "home.rides.description"))
    .addRow("insurance", t(locale, "home.insurance.title"), t(locale, "home.insurance.description"))
    .addRow("jobs", t(locale, "home.jobs.title"), t(locale, "home.jobs.description"))
    .addRow("property", t(locale, "home.property.title"), t(locale, "home.property.description"))
    .addRow("wallet", t(locale, "home.wallet.title"), t(locale, "home.wallet.description"))
    .addRow("marketplace", t(locale, "home.marketplace.title"), t(locale, "home.marketplace.description"))
    .build();
}

/**
 * Back to home button only
 */
export function homeOnlyButton(locale: Language = "en"): ButtonSpec[] {
  return [{ id: WA_IDS.BACK_HOME, title: t(locale, "common.home") }];
}

/**
 * Back and home buttons
 */
export function backHomeButtons(locale: Language = "en"): ButtonSpec[] {
  return [
    { id: WA_IDS.BACK_MENU, title: t(locale, "common.back") },
    { id: WA_IDS.BACK_HOME, title: t(locale, "common.home") },
  ];
}

// ============================================================================
// MOBILITY COMPONENTS
// ============================================================================

/**
 * Mobility menu list
 */
export function mobilityMenuList(locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "mobility.title"))
    .body(t(locale, "mobility.body"))
    .button(t(locale, "common.open"))
    .section(t(locale, "mobility.section"))
    .addRow(WA_IDS.SEE_DRIVERS, t(locale, "mobility.drivers.title"), t(locale, "mobility.drivers.description"))
    .addRow(WA_IDS.SEE_PASSENGERS, t(locale, "mobility.passengers.title"), t(locale, "mobility.passengers.description"))
    .addRow(WA_IDS.SCHEDULE_TRIP, t(locale, "mobility.schedule.title"), t(locale, "mobility.schedule.description"))
    .addRow(WA_IDS.GO_ONLINE, t(locale, "mobility.online.title"), t(locale, "mobility.online.description"))
    .addBackRow()
    .build();
}

/**
 * Vehicle selection list
 */
export function vehicleSelectionList(locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "mobility.vehicle.title"))
    .body(t(locale, "mobility.vehicle.body"))
    .button(t(locale, "common.choose"))
    .section(t(locale, "mobility.vehicle.section"))
    .addRow(WA_IDS.VEH_MOTO, t(locale, "mobility.vehicle.moto.title"), t(locale, "mobility.vehicle.moto.description"))
    .addRow(WA_IDS.VEH_CAB, t(locale, "mobility.vehicle.cab.title"), t(locale, "mobility.vehicle.cab.description"))
    .addRow(WA_IDS.VEH_LIFAN, t(locale, "mobility.vehicle.lifan.title"), t(locale, "mobility.vehicle.lifan.description"))
    .addRow(WA_IDS.VEH_TRUCK, t(locale, "mobility.vehicle.truck.title"), t(locale, "mobility.vehicle.truck.description"))
    .addRow(WA_IDS.VEH_OTHERS, t(locale, "mobility.vehicle.others.title"), t(locale, "mobility.vehicle.others.description"))
    .addBackRow()
    .build();
}

/**
 * Share location prompt
 */
export function shareLocationPrompt(
  context: string,
  allowSaved: boolean = true,
  locale: Language = "en"
): { body: string; buttons: ButtonSpec[] } {
  const builder = buttons()
    .body(t(locale, "location.share.prompt", { context }));

  if (allowSaved) {
    builder.addButton(WA_IDS.LOCATION_SAVED_LIST, t(locale, "location.saved.button"));
  }
  builder.addBackButton();

  return builder.build();
}

// ============================================================================
// INSURANCE COMPONENTS
// ============================================================================

/**
 * Insurance menu list
 */
export function insuranceMenuList(locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "insurance.title"))
    .body(t(locale, "insurance.body"))
    .button(t(locale, "common.open"))
    .section(t(locale, "insurance.section"))
    .addRow(WA_IDS.INSURANCE_SUBMIT, t(locale, "insurance.submit.title"), t(locale, "insurance.submit.description"))
    .addRow(WA_IDS.INSURANCE_HELP, t(locale, "insurance.help.title"), t(locale, "insurance.help.description"))
    .addBackRow()
    .build();
}

/**
 * Claim type selection list
 */
export function claimTypeSelectionList(locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "claims.type.title"))
    .body(t(locale, "claims.type.body"))
    .button(t(locale, "common.select"))
    .section(t(locale, "claims.type.section"))
    .addRow("claim_accident", t(locale, "claims.type.accident.title"), t(locale, "claims.type.accident.description"))
    .addRow("claim_theft", t(locale, "claims.type.theft.title"), t(locale, "claims.type.theft.description"))
    .addRow("claim_damage", t(locale, "claims.type.damage.title"), t(locale, "claims.type.damage.description"))
    .addRow("claim_third_party", t(locale, "claims.type.third_party.title"), t(locale, "claims.type.third_party.description"))
    .addBackRow()
    .build();
}

// ============================================================================
// WALLET COMPONENTS
// ============================================================================

/**
 * Wallet menu list
 */
export function walletMenuList(balance: number, locale: Language = "en"): ListMessageOptions {
  return list()
    .title(t(locale, "wallet.title"))
    .body(t(locale, "wallet.balance", { balance: balance.toLocaleString() }))
    .button(t(locale, "common.open"))
    .section(t(locale, "wallet.section"))
    .addRow(WA_IDS.WALLET_TRANSFER, t(locale, "wallet.transfer.title"), t(locale, "wallet.transfer.description"))
    .addRow(WA_IDS.WALLET_HISTORY, t(locale, "wallet.history.title"), t(locale, "wallet.history.description"))
    .addRow(WA_IDS.WALLET_DEPOSIT, t(locale, "wallet.deposit.title"), t(locale, "wallet.deposit.description"))
    .addBackRow()
    .build();
}

/**
 * Transfer confirmation
 */
export function transferConfirmation(
  amount: number,
  recipientName: string,
  locale: Language = "en"
): { body: string; buttons: ButtonSpec[] } {
  return buttons()
    .body(t(locale, "wallet.transfer.confirm", { 
      amount: amount.toLocaleString(), 
      recipient: recipientName 
    }))
    .addButton("confirm_transfer", t(locale, "common.confirm"))
    .addButton("cancel_transfer", t(locale, "common.cancel"))
    .build();
}

// ============================================================================
// TRIP COMPONENTS
// ============================================================================

/**
 * Trip status message
 */
export function tripStatusMessage(
  status: string,
  details: Record<string, string>,
  locale: Language = "en"
): string {
  const statusEmoji: Record<string, string> = {
    matched: "🤝",
    started: "🚗",
    arrived: "📍",
    picked_up: "👋",
    in_progress: "🛣️",
    completed: "✅",
    cancelled: "❌",
  };

  const builder = text()
    .withEmoji(statusEmoji[status] || "📋")
    .bold(t(locale, `trip.status.${status}`))
    .paragraph();

  for (const [key, value] of Object.entries(details)) {
    builder.text(`${t(locale, `trip.${key}`)}: ${value}`).break();
  }

  return builder.build();
}

/**
 * Trip action buttons based on status
 */
export function tripActionButtons(
  status: string,
  tripId: string,
  isDriver: boolean,
  locale: Language = "en"
): ButtonSpec[] {
  const actions: ButtonSpec[] = [];

  if (isDriver) {
    switch (status) {
      case "matched":
        actions.push({ id: `TRIP_START::${tripId}`, title: t(locale, "trip.actions.start") });
        break;
      case "started":
        actions.push({ id: `TRIP_ARRIVED::${tripId}`, title: t(locale, "trip.actions.arrived") });
        break;
      case "arrived":
        actions.push({ id: `TRIP_PICKED_UP::${tripId}`, title: t(locale, "trip.actions.picked_up") });
        break;
      case "in_progress":
        actions.push({ id: `TRIP_COMPLETE::${tripId}`, title: t(locale, "trip.actions.complete") });
        break;
    }
  }

  // Both can cancel before pickup
  if (["matched", "started", "arrived"].includes(status)) {
    actions.push({ id: `TRIP_CANCEL::${tripId}`, title: t(locale, "trip.actions.cancel") });
  }

  return actions.slice(0, 3);
}

// ============================================================================
// LOADING/PROCESSING MESSAGES
// ============================================================================

/**
 * Processing message
 */
export function processingMessage(action: string, locale: Language = "en"): string {
  return text()
    .withEmoji("⏳")
    .text(t(locale, "common.processing", { action }))
    .build();
}

/**
 * Searching message
 */
export function searchingMessage(locale: Language = "en"): string {
  return text()
    .withEmoji("🔍")
    .text(t(locale, "common.searching"))
    .build();
}

// Re-export builders
export {
  ButtonMessageBuilder,
  buttons,
  list,
  ListMessageBuilder,
  text,
  TextMessageBuilder,
} from "../builder.ts";
