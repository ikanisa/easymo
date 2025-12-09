/**
 * User-friendly error messages with recovery actions
 * Replaces technical error messages with plain language
 */

export interface FriendlyError {
  title: string;
  message: string;
  action?: {
    label: string;
    callback?: () => void;
    href?: string;
  };
}

/**
 * Converts technical error messages to user-friendly ones
 */
export function getFriendlyError(error: unknown): FriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();

  // Network errors
  if (errorLower.includes("fetch") || errorLower.includes("network")) {
    return {
      title: "Connection issue",
      message: "We couldn't reach the server. Please check your internet connection and try again.",
      action: {
        label: "Retry",
        callback: () => window.location.reload(),
      },
    };
  }

  // Authentication errors
  if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
    return {
      title: "Session expired",
      message: "Your session has expired. Please sign in again to continue.",
      action: {
        label: "Sign in",
        href: "/login",
      },
    };
  }

  // Permission errors
  if (errorLower.includes("forbidden") || errorLower.includes("403")) {
    return {
      title: "Access denied",
      message:
        "You don't have permission to perform this action. Contact your administrator if you need access.",
      action: {
        label: "Go back",
        callback: () => window.history.back(),
      },
    };
  }

  // Not found errors
  if (errorLower.includes("not found") || errorLower.includes("404")) {
    return {
      title: "Not found",
      message: "We couldn't find what you're looking for. It may have been moved or deleted.",
      action: {
        label: "Go home",
        href: "/",
      },
    };
  }

  // Payment/reference errors
  if (errorLower.includes("reference") || errorLower.includes("payment code")) {
    return {
      title: "Payment not found",
      message:
        "We couldn't find that payment code. Please check the code and try again, or contact support.",
      action: {
        label: "Try another code",
      },
    };
  }

  // Validation errors
  if (errorLower.includes("invalid") || errorLower.includes("validation")) {
    return {
      title: "Invalid information",
      message:
        "Please check your information and try again. Make sure all required fields are filled correctly.",
      action: {
        label: "Review form",
      },
    };
  }

  // Rate limit errors
  if (errorLower.includes("rate limit") || errorLower.includes("too many")) {
    return {
      title: "Too many attempts",
      message: "You've made too many requests. Please wait a moment and try again.",
      action: {
        label: "OK",
      },
    };
  }

  // Server errors
  if (errorLower.includes("500") || errorLower.includes("server error")) {
    return {
      title: "Something went wrong",
      message:
        "We're having trouble processing your request. Our team has been notified. Please try again later.",
      action: {
        label: "Try again",
        callback: () => window.location.reload(),
      },
    };
  }

  // Generic fallback
  return {
    title: "Unexpected error",
    message:
      "Something unexpected happened. Please try again or contact support if the problem continues.",
    action: {
      label: "Retry",
      callback: () => window.location.reload(),
    },
  };
}

/**
 * Common error scenarios with predefined messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: {
    title: "No internet connection",
    message: "Check your connection and try again.",
  },
  TIMEOUT: {
    title: "Request timed out",
    message: "The request took too long. Please try again.",
  },
  UNAUTHORIZED: {
    title: "Not signed in",
    message: "Please sign in to continue.",
  },
  PERMISSION_DENIED: {
    title: "Permission denied",
    message: "You don't have access to this resource.",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "The resource you're looking for doesn't exist.",
  },
  VALIDATION_ERROR: {
    title: "Invalid data",
    message: "Please check your input and try again.",
  },
  SERVER_ERROR: {
    title: "Server error",
    message: "We're experiencing technical difficulties.",
  },
} as const;
