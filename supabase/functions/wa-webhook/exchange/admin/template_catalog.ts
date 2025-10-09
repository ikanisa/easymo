import {
  TEMPLATE_CART_REMINDER,
  TEMPLATE_ORDER_CANCELLED_CUSTOMER,
  TEMPLATE_ORDER_CREATED_VENDOR,
  TEMPLATE_ORDER_PAID_CUSTOMER,
  TEMPLATE_ORDER_SERVED_CUSTOMER,
} from "../../notify/sender.ts";

const TEMPLATE_ORDER_PENDING_VENDOR =
  Deno.env.get("TEMPLATE_ORDER_PENDING_VENDOR") ?? "order_pending_vendor";

export type TemplateDefinition = {
  name: string;
  label: string;
  category: "vendor" | "customer" | "broadcast" | "system" | "unknown";
  description: string;
  language: string;
  variables: string[];
  sampleComponents: unknown[];
};

const BASE_TEMPLATES: TemplateDefinition[] = [
  {
    name: TEMPLATE_ORDER_CREATED_VENDOR,
    label: "Vendor · Order created",
    category: "vendor",
    description: "Notify vendors when a new order is created.",
    language: "en",
    variables: ["order_code", "table_label", "total_formatted"],
    sampleComponents: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "#C123" },
          { type: "text", text: "Table 5" },
          { type: "text", text: "12,000 RWF" },
        ],
      },
    ],
  },
  {
    name: TEMPLATE_ORDER_PENDING_VENDOR,
    label: "Vendor · Order pending",
    category: "vendor",
    description: "Reminder for vendors when an order is pending action.",
    language: "en",
    variables: ["order_code", "table_label", "age_minutes"],
    sampleComponents: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "#C123" },
          { type: "text", text: "Table 5" },
          { type: "text", text: "15" },
        ],
      },
    ],
  },
  {
    name: TEMPLATE_ORDER_PAID_CUSTOMER,
    label: "Customer · Order paid",
    category: "customer",
    description: "Confirmation to customers when payment is recorded.",
    language: "en",
    variables: ["order_code"],
    sampleComponents: [
      {
        type: "body",
        parameters: [{ type: "text", text: "#C123" }],
      },
    ],
  },
  {
    name: TEMPLATE_ORDER_SERVED_CUSTOMER,
    label: "Customer · Order served",
    category: "customer",
    description: "Notify customers when their order is ready or served.",
    language: "en",
    variables: ["order_code"],
    sampleComponents: [
      {
        type: "body",
        parameters: [{ type: "text", text: "#C123" }],
      },
    ],
  },
  {
    name: TEMPLATE_ORDER_CANCELLED_CUSTOMER,
    label: "Customer · Order cancelled",
    category: "customer",
    description: "Alert customers when an order is cancelled with a reason.",
    language: "en",
    variables: ["order_code", "reason"],
    sampleComponents: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "#C123" },
          { type: "text", text: "Out of stock" },
        ],
      },
    ],
  },
  {
    name: TEMPLATE_CART_REMINDER,
    label: "Customer · Cart reminder",
    category: "customer",
    description: "Prompt customers to complete their cart checkout.",
    language: "en",
    variables: ["bar_name"],
    sampleComponents: [
      {
        type: "body",
        parameters: [{ type: "text", text: "Sunset Bar" }],
      },
    ],
  },
];

export function getTemplateCatalog(): TemplateDefinition[] {
  return BASE_TEMPLATES;
}

export function findTemplateDefinition(
  name: string,
): TemplateDefinition | undefined {
  return BASE_TEMPLATES.find((template) => template.name === name);
}

export function buildSampleComponents(name: string): unknown[] {
  const def = findTemplateDefinition(name);
  return def?.sampleComponents ?? [];
}

export function describeVariables(name: string): string {
  const def = findTemplateDefinition(name);
  if (!def) return "Unknown template variables.";
  if (def.variables.length === 0) return "No variables.";
  return `Variables: ${def.variables.join(", ")}`;
}
