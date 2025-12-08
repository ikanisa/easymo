/**
 * Menu Extraction Schema
 * JSON Schema for structured menu extraction
 */

export const MENU_SCHEMA = {
  type: "object",
  properties: {
    currency: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "number" },
                currency: { type: "string" },
                flags: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["name", "description", "price", "currency"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["categories"],
  additionalProperties: false,
};
