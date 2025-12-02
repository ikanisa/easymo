/**
 * Enhanced Error Handler with i18n Support
 * Provides user-friendly error messages with multi-language support
 */

import { logStructuredEvent } from "../observability.ts";

export type ErrorCode = 
  | "AUTH_INVALID_SIGNATURE" | "AUTH_MISSING_SIGNATURE" | "AUTH_EXPIRED_TOKEN" | "AUTH_UNAUTHORIZED"
  | "RATE_LIMIT_EXCEEDED"
  | "VALIDATION_FAILED" | "INVALID_INPUT" | "MISSING_REQUIRED_FIELD" | "INVALID_FORMAT"
  | "RESOURCE_NOT_FOUND" | "RESOURCE_ALREADY_EXISTS" | "RESOURCE_EXPIRED"
  | "OPERATION_FAILED" | "INSUFFICIENT_FUNDS" | "LIMIT_EXCEEDED" | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE" | "TIMEOUT" | "DATABASE_ERROR"
  | "PAYLOAD_TOO_LARGE" | "INVALID_CONTENT_TYPE" | "INVALID_PAYLOAD";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export type ServiceError = {
  code: ErrorCode;
  message: string;
  userMessage: string;
  httpStatus: number;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfterSeconds?: number;
};

type ErrorMessages = {
  en: Record<ErrorCode, string>;
  fr: Record<ErrorCode, string>;
  rw: Record<ErrorCode, string>;
};

const ERROR_MESSAGES: ErrorMessages = {
  en: {
    AUTH_INVALID_SIGNATURE: "Authentication failed. Please try again.",
    AUTH_MISSING_SIGNATURE: "Authentication required.",
    AUTH_EXPIRED_TOKEN: "Your session has expired. Please start again.",
    AUTH_UNAUTHORIZED: "You are not authorized to perform this action.",
    RATE_LIMIT_EXCEEDED: "Too many requests. Please wait and try again.",
    VALIDATION_FAILED: "The information provided is invalid.",
    INVALID_INPUT: "Invalid input. Please check your information.",
    MISSING_REQUIRED_FIELD: "Some required information is missing.",
    INVALID_FORMAT: "The format is incorrect.",
    RESOURCE_NOT_FOUND: "The requested item was not found.",
    RESOURCE_ALREADY_EXISTS: "This item already exists.",
    RESOURCE_EXPIRED: "This item has expired.",
    OPERATION_FAILED: "The operation could not be completed.",
    INSUFFICIENT_FUNDS: "Insufficient balance for this transaction.",
    LIMIT_EXCEEDED: "Limit exceeded. Please try a smaller amount.",
    QUOTA_EXCEEDED: "You have reached your limit.",
    INTERNAL_ERROR: "Something went wrong. Please try again later.",
    SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
    TIMEOUT: "Request timed out. Please try again.",
    DATABASE_ERROR: "Data error. Please try again later.",
    PAYLOAD_TOO_LARGE: "The file or message is too large.",
    INVALID_CONTENT_TYPE: "Invalid file type.",
    INVALID_PAYLOAD: "Invalid request format.",
  },
  fr: {
    AUTH_INVALID_SIGNATURE: "L'authentification a échoué.",
    AUTH_MISSING_SIGNATURE: "Authentification requise.",
    AUTH_EXPIRED_TOKEN: "Votre session a expiré.",
    AUTH_UNAUTHORIZED: "Vous n'êtes pas autorisé.",
    RATE_LIMIT_EXCEEDED: "Trop de demandes. Veuillez patienter.",
    VALIDATION_FAILED: "Les informations sont invalides.",
    INVALID_INPUT: "Entrée invalide.",
    MISSING_REQUIRED_FIELD: "Informations manquantes.",
    INVALID_FORMAT: "Le format est incorrect.",
    RESOURCE_NOT_FOUND: "Élément non trouvé.",
    RESOURCE_ALREADY_EXISTS: "Cet élément existe déjà.",
    RESOURCE_EXPIRED: "Cet élément a expiré.",
    OPERATION_FAILED: "L'opération a échoué.",
    INSUFFICIENT_FUNDS: "Solde insuffisant.",
    LIMIT_EXCEEDED: "Limite dépassée.",
    QUOTA_EXCEEDED: "Limite atteinte.",
    INTERNAL_ERROR: "Une erreur s'est produite.",
    SERVICE_UNAVAILABLE: "Service indisponible.",
    TIMEOUT: "Délai expiré.",
    DATABASE_ERROR: "Erreur de données.",
    PAYLOAD_TOO_LARGE: "Fichier trop volumineux.",
    INVALID_CONTENT_TYPE: "Type de fichier invalide.",
    INVALID_PAYLOAD: "Format de demande invalide.",
  },
  rw: {
    AUTH_INVALID_SIGNATURE: "Kwemeza byanze.",
    AUTH_MISSING_SIGNATURE: "Kwemeza birakenewe.",
    AUTH_EXPIRED_TOKEN: "Igihe cyawe cyarangiye.",
    AUTH_UNAUTHORIZED: "Ntabwo wemerewe gukora ibi.",
    RATE_LIMIT_EXCEEDED: "Ibisabwa byinshi cyane.",
    VALIDATION_FAILED: "Amakuru ntabwo ari yo.",
    INVALID_INPUT: "Ibyo wanditse ntabwo ari byo.",
    MISSING_REQUIRED_FIELD: "Amakuru akenewe arabuze.",
    INVALID_FORMAT: "Imiterere ntabwo ari yo.",
    RESOURCE_NOT_FOUND: "Ibyo usaba ntibyabonetse.",
    RESOURCE_ALREADY_EXISTS: "Ibi bisanzwe bihari.",
    RESOURCE_EXPIRED: "Ibi byarangiye.",
    OPERATION_FAILED: "Ibikorwa ntibyashobotse.",
    INSUFFICIENT_FUNDS: "Amafaranga ntahagije.",
    LIMIT_EXCEEDED: "Urenze limite.",
    QUOTA_EXCEEDED: "Wageze ku mupaka.",
    INTERNAL_ERROR: "Hari ikibazo cyabaye.",
    SERVICE_UNAVAILABLE: "Serivisi ntiboneka.",
    TIMEOUT: "Icyifuzo cyarangiye.",
    DATABASE_ERROR: "Ikosa rya data.",
    PAYLOAD_TOO_LARGE: "Dosiye ni binini cyane.",
    INVALID_CONTENT_TYPE: "Ubwoko bwa dosiye ntabwo bwemewe.",
    INVALID_PAYLOAD: "Imiterere y'icyifuzo ntabwo ari yo.",
  },
};

const ERROR_DEFINITIONS: Record<ErrorCode, Omit<ServiceError, "message" | "userMessage" | "details">> = {
  AUTH_INVALID_SIGNATURE: { code: "AUTH_INVALID_SIGNATURE", httpStatus: 401, severity: "medium", retryable: true },
  AUTH_MISSING_SIGNATURE: { code: "AUTH_MISSING_SIGNATURE", httpStatus: 401, severity: "medium", retryable: false },
  AUTH_EXPIRED_TOKEN: { code: "AUTH_EXPIRED_TOKEN", httpStatus: 401, severity: "low", retryable: false },
  AUTH_UNAUTHORIZED: { code: "AUTH_UNAUTHORIZED", httpStatus: 403, severity: "medium", retryable: false },
  RATE_LIMIT_EXCEEDED: { code: "RATE_LIMIT_EXCEEDED", httpStatus: 429, severity: "low", retryable: true, retryAfterSeconds: 60 },
  VALIDATION_FAILED: { code: "VALIDATION_FAILED", httpStatus: 400, severity: "low", retryable: false },
  INVALID_INPUT: { code: "INVALID_INPUT", httpStatus: 400, severity: "low", retryable: false },
  MISSING_REQUIRED_FIELD: { code: "MISSING_REQUIRED_FIELD", httpStatus: 400, severity: "low", retryable: false },
  INVALID_FORMAT: { code: "INVALID_FORMAT", httpStatus: 400, severity: "low", retryable: false },
  RESOURCE_NOT_FOUND: { code: "RESOURCE_NOT_FOUND", httpStatus: 404, severity: "low", retryable: false },
  RESOURCE_ALREADY_EXISTS: { code: "RESOURCE_ALREADY_EXISTS", httpStatus: 409, severity: "low", retryable: false },
  RESOURCE_EXPIRED: { code: "RESOURCE_EXPIRED", httpStatus: 410, severity: "low", retryable: false },
  OPERATION_FAILED: { code: "OPERATION_FAILED", httpStatus: 500, severity: "medium", retryable: true },
  INSUFFICIENT_FUNDS: { code: "INSUFFICIENT_FUNDS", httpStatus: 400, severity: "low", retryable: false },
  LIMIT_EXCEEDED: { code: "LIMIT_EXCEEDED", httpStatus: 400, severity: "low", retryable: false },
  QUOTA_EXCEEDED: { code: "QUOTA_EXCEEDED", httpStatus: 429, severity: "low", retryable: true, retryAfterSeconds: 3600 },
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", httpStatus: 500, severity: "high", retryable: true },
  SERVICE_UNAVAILABLE: { code: "SERVICE_UNAVAILABLE", httpStatus: 503, severity: "high", retryable: true, retryAfterSeconds: 30 },
  TIMEOUT: { code: "TIMEOUT", httpStatus: 504, severity: "medium", retryable: true },
  DATABASE_ERROR: { code: "DATABASE_ERROR", httpStatus: 500, severity: "high", retryable: true },
  PAYLOAD_TOO_LARGE: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413, severity: "low", retryable: false },
  INVALID_CONTENT_TYPE: { code: "INVALID_CONTENT_TYPE", httpStatus: 415, severity: "low", retryable: false },
  INVALID_PAYLOAD: { code: "INVALID_PAYLOAD", httpStatus: 400, severity: "low", retryable: false },
};

export class ErrorHandler {
  private serviceName: string;
  private defaultLocale: string;

  constructor(serviceName: string, defaultLocale = "en") {
    this.serviceName = serviceName;
    this.defaultLocale = defaultLocale;
  }

  createError(
    code: ErrorCode,
    options: {
      locale?: string;
      details?: Record<string, unknown>;
      internalMessage?: string;
    } = {}
  ): ServiceError {
    const definition = ERROR_DEFINITIONS[code];
    const locale = (options.locale || this.defaultLocale) as keyof ErrorMessages;
    const messages = ERROR_MESSAGES[locale] || ERROR_MESSAGES.en;

    return {
      ...definition,
      message: options.internalMessage || code,
      userMessage: messages[code] || messages.INTERNAL_ERROR,
      details: options.details,
    };
  }

  createErrorResponse(
    error: ServiceError,
    requestId: string,
    correlationId: string
  ): Response {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
      "X-Service": this.serviceName,
    });

    if (error.retryAfterSeconds) {
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }

    const body = {
      error: error.code,
      message: error.userMessage,
      requestId,
      ...(error.details && { details: error.details }),
      ...(error.retryable && { retryable: true }),
      ...(error.retryAfterSeconds && { retryAfter: error.retryAfterSeconds }),
    };

    return new Response(JSON.stringify(body), {
      status: error.httpStatus,
      headers,
    });
  }

  async handleError(
    error: unknown,
    context: {
      requestId: string;
      correlationId: string;
      locale?: string;
      operation?: string;
    }
  ): Promise<Response> {
    let serviceError: ServiceError;

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        serviceError = this.createError("RATE_LIMIT_EXCEEDED", { locale: context.locale });
      } else if (error.message.includes("not found")) {
        serviceError = this.createError("RESOURCE_NOT_FOUND", { locale: context.locale });
      } else if (error.message.includes("timeout")) {
        serviceError = this.createError("TIMEOUT", { locale: context.locale });
      } else if (error.message.includes("database") || error.message.includes("supabase")) {
        serviceError = this.createError("DATABASE_ERROR", { 
          locale: context.locale,
          internalMessage: error.message,
        });
      } else {
        serviceError = this.createError("INTERNAL_ERROR", {
          locale: context.locale,
          internalMessage: error.message,
        });
      }
    } else {
      serviceError = this.createError("INTERNAL_ERROR", {
        locale: context.locale,
        internalMessage: String(error),
      });
    }

    logStructuredEvent(`${this.serviceName.toUpperCase()}_ERROR`, {
      service: this.serviceName,
      requestId: context.requestId,
      correlationId: context.correlationId,
      operation: context.operation,
      errorCode: serviceError.code,
      errorMessage: serviceError.message,
      severity: serviceError.severity,
      stack: error instanceof Error ? error.stack : undefined,
    }, serviceError.severity === "critical" || serviceError.severity === "high" ? "error" : "warn");

    return this.createErrorResponse(serviceError, context.requestId, context.correlationId);
  }

  getUserMessage(code: ErrorCode, locale = "en"): string {
    const messages = ERROR_MESSAGES[locale as keyof ErrorMessages] || ERROR_MESSAGES.en;
    return messages[code] || messages.INTERNAL_ERROR;
  }
}

export function createErrorHandler(serviceName: string, defaultLocale = "en"): ErrorHandler {
  return new ErrorHandler(serviceName, defaultLocale);
}

export function errorResponse(
  code: ErrorCode,
  requestId: string,
  correlationId: string,
  options: {
    serviceName?: string;
    locale?: string;
    details?: Record<string, unknown>;
  } = {}
): Response {
  const handler = createErrorHandler(options.serviceName || "unknown", options.locale);
  const error = handler.createError(code, { locale: options.locale, details: options.details });
  return handler.createErrorResponse(error, requestId, correlationId);
}
