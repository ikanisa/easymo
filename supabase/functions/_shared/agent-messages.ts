/**
 * Centralized Message Library for AI Agents
 * 
 * All user-facing messages should be defined here for consistency.
 * This ensures uniform tone, voice, and easier i18n integration.
 * 
 * @module messages
 */

// Type definitions for message templates
export interface TripDetails {
  pickup: string;
  dropoff: string;
  driverName: string;
  estimatedTime: string;
  price?: string;
}

/**
 * Centralized message constants for AI agent interactions
 */
export const AGENT_MESSAGES = {
  /**
   * Loading/Progress Messages
   * Used while system is processing requests
   */
  LOADING: {
    DRIVERS: "🚖 Searching for drivers in our database...",
    PHARMACY: "💊 Searching for pharmacies...",
    PROPERTY: "🏠 Searching for properties...",
    HARDWARE: "🔧 Searching for hardware stores...",
    SHOPS: "🛍️ Searching for shops...",
    PROCESSING: "⏳ Processing your request...",
  },

  /**
   * Success Messages
   * Confirming successful actions
   */
  SUCCESS: {
    SELECTION: "✅ Great choice!\n\nWe're processing your selection...",
    
    TRIP_SCHEDULED: (details: TripDetails): string =>
      `✅ Trip scheduled successfully!\n\n` +
      `📍 Pickup: ${details.pickup}\n` +
      `🎯 Dropoff: ${details.dropoff}\n` +
      `🚗 Driver: ${details.driverName}\n` +
      `⏰ Estimated: ${details.estimatedTime}` +
      (details.price ? `\n💰 Price: ${details.price}` : ''),
  },

  /**
   * No Results Messages
   * When searches return empty results
   */
  NO_RESULTS: {
    DRIVERS:
      "🚖 No drivers found at this moment.\n\n" +
      "This could be because:\n" +
      "• No drivers are available in your area\n" +
      "• Try the traditional 'See Drivers' option\n" +
      "• Check back in a few minutes",
    
    GENERIC: (itemType: string): string =>
      `😔 No ${itemType} found at this moment.\n\n` +
      "This could be because:\n" +
      "• None available in your area right now\n" +
      "• Try browsing manually\n" +
      "• Check back in a few minutes",
    
    WITH_FALLBACK: (itemType: string, fallbackAction: string): string =>
      `😔 No ${itemType} found at this moment.\n\n` +
      "This could be because:\n" +
      "• None available right now\n" +
      `• Try ${fallbackAction}\n` +
      "• Check back in a few minutes",
  },

  /**
   * Error Messages
   * When things go wrong, with recovery steps
   */
  ERRORS: {
    SEARCH_FAILED: (itemType: string): string =>
      `😔 Sorry, we encountered an error while searching for ${itemType}.\n\n` +
      "Please try:\n" +
      "• Using the traditional search\n" +
      "• Checking your connection\n" +
      "• Trying again in a few minutes\n" +
      "• Contact support if this persists",
    
    SESSION_EXPIRED:
      "😔 Sorry, your selection session has expired.\n\n" +
      "Sessions last 10 minutes for your security. " +
      "Please start a new search when you're ready! 🔍",
    
    SESSION_NOT_FOUND:
      "😔 Sorry, your selection session has expired or couldn't be found.\n\n" +
      "This can happen if:\n" +
      "• You waited too long to select (sessions expire after 10 minutes)\n" +
      "• Network issues interrupted the connection\n\n" +
      "Please start a new search. 🔍",
    
    PROCESSING_FAILED:
      "😔 Sorry, something went wrong while processing your selection.\n\n" +
      "Please try again or start a new search.\n" +
      "Contact support if the problem persists.",
    
    AGENT_UNAVAILABLE: (agentType: string): string =>
      `🚖 Sorry, we couldn't reach the ${agentType} at this moment. This might be because:\n\n` +
      "• The system is temporarily busy\n" +
      "• Network connectivity issues\n\n" +
      "Please try again in a few minutes or use the traditional method.",
    
    TRIP_SCHEDULE_FAILED:
      "🛵 Sorry, we couldn't schedule your trip at this moment. This might be because:\n\n" +
      "• The system is temporarily unavailable\n" +
      "• Please try the traditional booking method\n" +
      "• Or contact support for assistance",
    
    OPTIONS_DISPLAY_FAILED: (count: number): string =>
      `We found ${count} option(s) for you! 🎉\n\n` +
      "However, we're having trouble displaying them right now. This is usually temporary.\n\n" +
      "Please:\n" +
      "• Try again in a moment\n" +
      "• Use the traditional search\n" +
      "• Contact support if needed",
  },

  /**
   * Instructions
   * Guiding users on what to do
   */
  INSTRUCTIONS: {
    PROVIDE_LOCATIONS: "📍 Please share your pickup and dropoff locations.",
    SELECT_OPTION: "Please select an option from the list above by clicking a button.",
    TRY_TRADITIONAL: "You can also try the traditional search method from the main menu.",
    START_NEW_SEARCH: "Ready to search again? Use the buttons below to get started! 🔍",
  },

  /**
   * Headers
   * Section headers in messages
   */
  HEADERS: {
    AVAILABLE_DRIVERS: "🚖 Available Drivers",
    AVAILABLE_PHARMACIES: "💊 Available Pharmacies",
    AVAILABLE_PROPERTIES: "🏠 Available Properties",
    AVAILABLE_HARDWARE: "🔧 Available Hardware Stores",
    AVAILABLE_SHOPS: "🛍️ Available Shops",
  },
} as const;

/**
 * Helper function to format fallback messages consistently
 * @param agentType - Type of agent (drivers, pharmacies, etc.)
 * @param reason - Specific reason for fallback
 * @param fallbackAction - Action user can take
 */
export function buildFallbackMessage(
  agentType: string,
  reason: string,
  fallbackAction: string,
): string {
  const emoji = getAgentEmoji(agentType);
  return (
    `${emoji} Sorry, we couldn't find ${agentType} at this moment. This might be because:\n\n` +
    `• ${reason}\n` +
    "• Network connectivity issues\n\n" +
    `${fallbackAction}`
  );
}

/**
 * Get appropriate emoji for agent type
 */
function getAgentEmoji(agentType: string): string {
  const emojiMap: Record<string, string> = {
    drivers: "🚖",
    pharmacy: "💊",
    pharmacies: "💊",
    properties: "🏠",
    property: "🏠",
    hardware: "🔧",
    shops: "🛍️",
    marketplace: "🛍️",
    trip: "🛵",
    delivery: "🛵",
  };
  
  return emojiMap[agentType.toLowerCase()] || "🤖";
}

/**
 * Build a consistent error message with recovery options
 * @param issue - What went wrong
 * @param recoverySteps - Array of steps user can take
 */
export function buildErrorMessage(
  issue: string,
  recoverySteps: string[],
): string {
  return (
    `😔 ${issue}\n\n` +
    "Please try:\n" +
    recoverySteps.map(step => `• ${step}`).join("\n")
  );
}

// Export for backward compatibility
export default AGENT_MESSAGES;
