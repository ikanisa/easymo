import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Logger } from "nestjs-pino";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.log({
          msg: "request.completed",
          path: request.url,
          method: request.method,
          statusCode: response.statusCode,
          requestId: request.requestId,
          durationMs: Date.now() - start,
        });
      }),
    );
  }
}
