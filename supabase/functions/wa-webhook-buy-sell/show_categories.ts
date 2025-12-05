/**
 * Show Buy & Sell categories as interactive list
 */

import { sendList } from "../_shared/wa-webhook-shared/wa/client.ts";

export async function showBuySellCategories(userPhone: string): Promise<void> {
  const categories = [
    { id: "pharmacies", icon: "💊", name: "Pharmacies" },
    { id: "salons", icon: "💇", name: "Salons & Barbers" },
    { id: "cosmetics", icon: "💄", name: "Cosmetics & Beauty" },
    { id: "notaries", icon: "⚖️", name: "Notaries & Legal" },
    { id: "electronics", icon: "📱", name: "Electronics" },
    { id: "hardware", icon: "🔨", name: "Hardware & Tools" },
    { id: "groceries", icon: "🛒", name: "Groceries & Supermarkets" },
    { id: "fashion", icon: "👔", name: "Fashion & Clothing" },
    { id: "auto", icon: "🚗", name: "Auto Services & Parts" },
  ];

  const rows = categories.map(cat => ({
    id: `category_${cat.id}`,
    title: `${cat.icon} ${cat.name}`,
    description: `Find nearby ${cat.name.toLowerCase()}`,
  }));

  // Add AI chat option
  rows.push({
    id: "chat_with_ai",
    title: "💬 Chat with AI Agent",
    description: "Ask me anything about products or services",
  });

  await sendList(userPhone, {
    body: "🛒 *Buy & Sell*\n\nChoose a category to find nearby businesses, or chat with our AI assistant:",
    button: "Select Category",
    sections: [
      {
        title: "Browse Categories",
        rows,
      },
    ],
  });
}
