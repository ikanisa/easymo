export type CopyKey = keyof typeof STRINGS;

const STRINGS = {
  "home.resume.prompt": "Pick up where you left off?",
  "home.resume.body": "Resume at {{bar}} or choose another bar.",
  "home.buttons.resume": "Resume {{bar}}",
  "home.buttons.change": "Choose another bar",
  "home.fallback.resume": "1. Resume {{bar}}",
  "home.fallback.change": "2. Choose another bar",

  "bars.list.title": "Choose a bar",
  "bars.list.body": "Pick a bar to browse the menu",
  "bars.none": "No bars are available right now.",
  "bars.unavailable": "That bar is unavailable. Showing other bars.",
  "bars.summary": "{{name}}\n{{location}}",
  "bars.menuPrompt": "{{name}} — {{location}}\nTap View menu to order.",
  "bars.options": "Choose what to do next",
  "bars.fallback.header": "Choose a bar:",

  "buttons.prev": "◀ Previous",
  "buttons.next": "Next ▶",
  "buttons.viewMenu": "View menu",
  "buttons.menuQr": "Menu QR",
  "buttons.payNow": "💸 Pay now",
  "buttons.orderMore": "➕ Order more",

  "menu.categories.title": "Menu categories",
  "menu.categories.body": "Select a category",
  "menu.categories.none": "No categories yet. Check back soon.",
  "menu.items.title": "Menu — {{bar}}",
  "menu.items.body": "Pick an item to order instantly.",
  "menu.items.none": "No items in this category yet.",
  "menu.unavailable": "This bar’s menu isn’t available right now.",
  "menu.category.unavailable": "That category is unavailable.",
  "menu.category.missing": "Category not available anymore.",
  "menu.changed": "That menu changed. Pick a category again.",
  "menu.more.tip": "Use *More dishes ▶️* to see additional items.",

  "items.unavailable": "That item isn’t available.",
  "items.add.unavailable": "That item isn’t available anymore.",
  "items.ordered": "✅ Order {{code}} at {{bar}} — {{total}}.",

  "fallback.prompt": "Reply with a number.",
  "fallback.mainMenu": "0. Main menu",
  "fallback.prev": "{{num}}. ◀ Previous",
  "fallback.next": "{{num}}. Next ▶",
  "fallback.viewMenu": "{{num}}. View menu",
  "fallback.orderMore": "{{num}}. Order more",
  "fallback.pay": "{{num}}. Pay now",
  "fallback.invalid": "Choose a valid number from the list.",
  "fallback.category": "Pick a valid category number.",
  "fallback.item": "Pick a valid item number.",
  "cart.chooseBar": "Let’s choose a bar first.",
  "cart.clearedOther": "Cleared your cart at {{bar}} so you can start fresh.",

  "order.simple.confirmed":
    "✅ Order {{code}} at {{bar}} is being prepared. Total {{total}}.",
  "order.simple.pay": "Dial {{ussd}} to pay {{total}} with MoMo.",
  "order.simple.payLink": "tel:{{uri}}",
  "order.simple.payUnavailable":
    "Payment instructions aren’t available yet. Please check with {{bar}}.",

  "manager.access.granted":
    "🛠️ Opening manager tools for {{bar}}. Check the Flow card we just sent.",
  "manager.access.denied":
    "🔒 Manager tools for {{bar}} are limited to verified staff.",
  "manager.fallback.manage": "{{num}}. Manager tools",

  "error.retry": "We hit a snag. Try again.",
  "error.expired": "Oops, that option expired. Let’s start again.",
} as const;

export function copy(
  key: CopyKey,
  params: Record<string, string> = {},
): string {
  const template = STRINGS[key];
  if (!template) return key;
  return template.replace(/{{(.*?)}}/g, (_, name) => params[name] ?? "");
}
