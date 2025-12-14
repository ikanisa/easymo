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

  // Nearby Flows
  {
    id: "SEE_DRIVERS",
    handler: "handleSeeDrivers",
    category: "nearby",
    description: "Find nearby drivers",
  },
  {
    id: "SEE_PASSENGERS",
    handler: "handleSeePassengers",
    category: "nearby",
    description: "Find nearby passengers",
  },
  {
    id: "REFRESH_DRIVERS",
    handler: "handleSeeDrivers",
    category: "nearby",
    description: "Refresh driver list",
  },

  // Schedule Flows
  {
    id: "SCHEDULE_TRIP",
    handler: "handleScheduleTrip",
    category: "schedule",
    description: "Schedule a future trip",
  },
  {
    id: "SCHEDULE_LIST",
    handler: "handleScheduleList",
    category: "schedule",
    description: "View scheduled trips",
  },
  {
    id: "SCHEDULE_CANCEL",
    handler: "handleScheduleCancel",
    category: "schedule",
    description: "Cancel scheduled trip",
  },

  // Driver Actions
  {
    id: "GO_ONLINE",
    handler: "handleGoOnline",
    category: "driver",
    description: "Driver goes online",
  },
  {
    id: "GO_OFFLINE",
    handler: "handleGoOffline",
    category: "driver",
    description: "Driver goes offline",
  },
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

  // Trip Management
  {
    id: "ACCEPT_TRIP",
    handler: "handleTripAccept",
    category: "trip",
    description: "Accept trip request",
  },
  {
    id: "DECLINE_TRIP",
    handler: "handleTripDecline",
    category: "trip",
    description: "Decline trip request",
  },
  {
    id: "START_TRIP",
    handler: "handleTripStart",
    category: "trip",
    description: "Start trip",
  },
  {
    id: "COMPLETE_TRIP",
    handler: "handleTripComplete",
    category: "trip",
    description: "Complete trip",
  },
  {
    id: "CANCEL_TRIP",
    handler: "handleTripCancel",
    category: "trip",
    description: "Cancel trip",
  },

  // Payment
  {
    id: "PAY_MOMO",
    handler: "handleMomoPayment",
    category: "payment",
    description: "Pay with mobile money",
  },
  {
    id: "PAY_USSD",
    handler: "handleUSSDPayment",
    category: "payment",
    description: "Pay with USSD",
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
