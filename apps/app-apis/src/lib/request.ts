import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

export const getRequestId = (request: NextRequest): string => {
  const headerValue = request.headers.get("x-request-id");
  if (headerValue && headerValue.trim().length > 0) {
    return headerValue;
  }

  return uuid();
};

export const readJsonBody = async <T>(request: NextRequest): Promise<T> => {
  const body = await request.json();
  return body as T;
};
