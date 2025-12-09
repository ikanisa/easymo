const EMAIL_REGEX = /([A-Z0-9._%+-]{2})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const PHONE_REGEX = /(\+?\d{2})\d{3,8}(\d{2})/g;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const LONG_NUMBER_REGEX = /(\d{2})\d{4,}(\d{2})/g;

const mask = (value: string, matcher: RegExp, replacer: (match: RegExpExecArray) => string) =>
  value.replace(matcher, (...args) => replacer(args as unknown as RegExpExecArray));

export const scrubString = (value: string): string => {
  let result = value;
  result = mask(result, EMAIL_REGEX, (match) => `${match[1]}…${match[2]}`);
  result = mask(result, PHONE_REGEX, (match) => `${match[1]}••••${match[2]}`);
  result = mask(result, UUID_REGEX, () => "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
  result = mask(result, LONG_NUMBER_REGEX, (match) => `${match[1]}••••${match[2]}`);
  return result;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const scrubPII = <T>(value: T): T => {
  if (typeof value === "string") {
    return scrubString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubPII(entry)) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack,
    } as T;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value) as T;
  }

  if (typeof value === "symbol") {
    return value.toString() as T;
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = scrubPII(entry);
      return acc;
    }, {}) as T;
  }

  return value;
};

export const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return scrubPII({
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    });
  }

  if (typeof error === "string") {
    return { message: scrubString(error) };
  }

  return { message: "Unknown error", detail: scrubPII(error) };
};
