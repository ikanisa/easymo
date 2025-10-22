import { Injectable } from '@nestjs/common';

@Injectable()
export class ToolRouterService {
  async handle(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'lookupLead':
        return this.lookupLead(args.phone as string);
      case 'createQuote':
        return this.createQuote(args.sku as string, Number(args.qty));
      default:
        return { error: 'Unknown tool' };
    }
  }

  private async lookupLead(phone: string) {
    // TODO: integrate with CRM or Supabase.
    return { exists: true, name: 'Jean', lastOrderAt: '2025-08-10' };
  }

  private async createQuote(sku: string, qty: number) {
    const price = 12.5;
    return { sku, qty, total: price * qty, currency: 'RWF' };
  }
}
