/**
 * Mobility Button Handler Mappings
 *
 * Documents all button IDs used in wa-webhook-mobility
 * Maps button IDs to their handler functions
 *
 * Phase 4: Documentation for future router extraction
 */

export interface ButtonHandler {
  id: string;
  handler: string;
  category: string;
  description: string;
}

/**
 * Complete list of button handlers in mobility service
 */
export const BUTTON_HANDLERS: ButtonHandler[] = [
  // Main Menu
  {
    id: "RIDES_MENU",
    handler: "showMobilityMenu",
    category: "main_menu",
    description: "Show main mobility menu",
  },
  {
    id: "rides_agent",
    handler: "showMobilityMenu",
    category: "main_menu",
    description: "Alias for rides menu",
  },
  {
    id: "rides",
    handler: "showMobilityMenu",
    category: "main_menu",
    description: "Alias for rides menu",
  },
  {
    id: "BACK_MENU",
    handler: "showMobilityMenu",
    category: "navigation",
    description: "Go back to mobility menu",
  },
  {
    id: "BACK_HOME",
    handler: "showMobilityMenu",
    category: "navigation",
    description: "Go back to home",
  },

  // Note: Nearby, Schedule, and Go Online/Offline handlers have been removed
  // The simplified flow only handles "ride" button and location sharing
  {
    id: "DRIVER_VERIFICATION",
    handler: "handleDriverVerification",
    category: "driver",
    description: "Start driver verification",
  },

  // Vehicle Management
  {
    id: "MY_VEHICLES",
    handler: "handleMyVehicles",
    category: "vehicle",
    description: "View my vehicles",
  },
  {
    id: "ADD_VEHICLE",
    handler: "handleAddVehicle",
    category: "vehicle",
    description: "Add new vehicle",
  },
  {
    id: "CHANGE_VEHICLE",
    handler: "handleChangeVehicle",
    category: "vehicle",
    description: "Change active vehicle",
  },

  // Support
  {
    id: "HELP_MENU",
    handler: "handleHelpMenu",
    category: "support",
    description: "Show help menu",
  },
  {
    id: "CONTACT_SUPPORT",
    handler: "handleContactSupport",
    category: "support",
    description: "Contact customer support",
  },
];

/**
 * Get handler by button ID
 */
export function getHandler(buttonId: string): ButtonHandler | undefined {
  return BUTTON_HANDLERS.find((h) => h.id === buttonId);
}

/**
 * Get handlers by category
 */
export function getHandlersByCategory(category: string): ButtonHandler[] {
  return BUTTON_HANDLERS.filter((h) => h.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  return [...new Set(BUTTON_HANDLERS.map((h) => h.category))];
}
