import { getRequestId, setRequestId } from "@easymo/commons";
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Observable } from "rxjs";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const headerId = typeof request.headers["x-request-id"] === "string"
      ? request.headers["x-request-id"]
      : undefined;
    const currentContextId = getRequestId();
    const existingRequestId = typeof request.requestId === "string" && request.requestId.trim()
      ? request.requestId
      : undefined;
    const requestId = headerId?.trim()
      || existingRequestId
      || (typeof currentContextId === "string" && currentContextId.trim() ? currentContextId : undefined)
      || randomUUID();

    request.headers["x-request-id"] = requestId;
    request.requestId = requestId;
    setRequestId(requestId);

    const response = context.switchToHttp().getResponse();
    response.setHeader("x-request-id", requestId);
    return next.handle();
  }
}
