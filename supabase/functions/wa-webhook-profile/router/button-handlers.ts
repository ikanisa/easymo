/**
 * Profile Button Handler Mappings
 *
 * Documents all button IDs used in wa-webhook-profile
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
 * Complete list of button handlers in profile service
 */
export const BUTTON_HANDLERS: ButtonHandler[] = [
  // Main Menu
  {
    id: "profile",
    handler: "startProfile",
    category: "main_menu",
    description: "Show profile menu",
  },

  // Profile Edit
  {
    id: "EDIT_PROFILE",
    handler: "startEditProfile",
    category: "profile_edit",
    description: "Edit profile information",
  },
  {
    id: "edit_profile",
    handler: "startEditProfile",
    category: "profile_edit",
    description: "Alias for edit profile",
  },
  {
    id: "EDIT_PROFILE_NAME",
    handler: "promptEditName",
    category: "profile_edit",
    description: "Edit profile name",
  },
  {
    id: "EDIT_PROFILE_LANGUAGE",
    handler: "promptEditLanguage",
    category: "profile_edit",
    description: "Edit language preference",
  },

  // Saved Locations
  {
    id: "SAVED_LOCATIONS",
    handler: "handleSavedLocations",
    category: "locations",
    description: "View saved locations",
  },
  {
    id: "SAVE_LOCATION",
    handler: "handleSaveLocation",
    category: "locations",
    description: "Save current location",
  },
  {
    id: "DELETE_LOCATION",
    handler: "handleDeleteLocation",
    category: "locations",
    description: "Delete saved location",
  },
  {
    id: "VIEW_LOCATION",
    handler: "handleViewLocation",
    category: "locations",
    description: "View location details",
  },

  // Help & Support
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
  {
    id: "FAQ",
    handler: "handleFAQ",
    category: "support",
    description: "View frequently asked questions",
  },

  // Settings
  {
    id: "SETTINGS",
    handler: "handleSettings",
    category: "settings",
    description: "View settings menu",
  },
  {
    id: "NOTIFICATIONS",
    handler: "handleNotificationSettings",
    category: "settings",
    description: "Notification preferences",
  },
  {
    id: "PRIVACY",
    handler: "handlePrivacySettings",
    category: "settings",
    description: "Privacy settings",
  },

  // MoMo Integration
  {
    id: "MOMO_MENU",
    handler: "handleMomoMenu",
    category: "momo",
    description: "Mobile money menu",
  },
  {
    id: "MOMO_SCAN_QR",
    handler: "handleMomoQRScan",
    category: "momo",
    description: "Scan MoMo QR code",
  },

  // Navigation
  {
    id: "BACK_MENU",
    handler: "backToProfileMenu",
    category: "navigation",
    description: "Go back to profile menu",
  },
  {
    id: "BACK_HOME",
    handler: "backToHome",
    category: "navigation",
    description: "Go back to home",
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
