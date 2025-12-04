/**
 * Input Validation Utilities
 * Validates and sanitizes user inputs to prevent injection attacks
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate geographic coordinates
 * @throws ValidationError if coordinates are invalid
 */
export function validateCoordinates(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  // Check if values are finite numbers
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ValidationError(
      "Coordinates must be valid numbers",
      "coordinates",
      "INVALID_COORDINATES",
    );
  }

  // Validate latitude range
  if (lat < -90 || lat > 90) {
    throw new ValidationError(
      `Latitude must be between -90 and 90, got ${lat}`,
      "latitude",
      "INVALID_LATITUDE",
    );
  }

  // Validate longitude range
  if (lng < -180 || lng > 180) {
    throw new ValidationError(
      `Longitude must be between -180 and 180, got ${lng}`,
      "longitude",
      "INVALID_LONGITUDE",
    );
  }

  return { lat, lng };
}

/**
 * Validate phone number format
 * Supports E.164 format and local Rwanda format
 */
export function validatePhoneNumber(phone: string): string {
  const cleaned = phone.trim().replace(/\s+/g, "");

  // E.164 format (e.g., +250788123456)
  const e164Pattern = /^\+\d{10,15}$/;
  // Rwanda local format (e.g., 0788123456)
  const rwandaPattern = /^0[7][0-9]{8}$/;

  if (!e164Pattern.test(cleaned) && !rwandaPattern.test(cleaned)) {
    throw new ValidationError(
      "Invalid phone number format",
      "phone",
      "INVALID_PHONE",
    );
  }

  return cleaned;
}

/**
 * Validate vehicle type
 */
export function validateVehicleType(vehicleType: string): string {
  const validTypes = ["moto", "car", "van", "bus"];

  if (!validTypes.includes(vehicleType.toLowerCase())) {
    throw new ValidationError(
      `Invalid vehicle type. Must be one of: ${validTypes.join(", ")}`,
      "vehicle_type",
      "INVALID_VEHICLE_TYPE",
    );
  }

  return vehicleType.toLowerCase();
}

/**
 * Validate trip status
 */
export function validateTripStatus(status: string): string {
  const validStatuses = [
    "pending",
    "accepted",
    "driver_arrived",
    "in_progress",
    "completed",
    "cancelled_by_driver",
    "cancelled_by_passenger",
    "expired",
  ];

  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `Invalid trip status. Must be one of: ${validStatuses.join(", ")}`,
      "status",
      "INVALID_STATUS",
    );
  }

  return status;
}

/**
 * Validate rating (1-5)
 */
export function validateRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError(
      "Rating must be an integer between 1 and 5",
      "rating",
      "INVALID_RATING",
    );
  }

  return rating;
}

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(text: string, maxLength = 500): string {
  if (typeof text !== "string") {
    throw new ValidationError(
      "Input must be a string",
      "text",
      "INVALID_INPUT_TYPE",
    );
  }

  // Remove any HTML tags
  const sanitized = text
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength);

  return sanitized;
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(uuid)) {
    throw new ValidationError(
      "Invalid UUID format",
      "id",
      "INVALID_UUID",
    );
  }

  return uuid;
}

/**
 * Validate and sanitize search radius
 */
export function validateRadius(radius: number, maxRadius = 50): number {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new ValidationError(
      "Radius must be a positive number",
      "radius",
      "INVALID_RADIUS",
    );
  }

  if (radius > maxRadius) {
    throw new ValidationError(
      `Radius cannot exceed ${maxRadius} km`,
      "radius",
      "RADIUS_TOO_LARGE",
    );
  }

  return radius;
}
