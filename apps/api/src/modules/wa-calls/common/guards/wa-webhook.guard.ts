import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class WaWebhookGuard implements CanActivate {
  // TODO: verify Meta signatures when webhook validation is enabled.
  canActivate(_ctx: ExecutionContext): boolean {
    return true;
  }
}
