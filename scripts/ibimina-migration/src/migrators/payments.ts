import type { SourcePayment } from "../types.js";
import { validatePayment } from "../validators/payment.js";
import { BaseMigrator } from "./base.js";

export class PaymentMigrator extends BaseMigrator<SourcePayment> {
  get tableName() {
    return "payments";
  }

  get displayName() {
    return "Payments";
  }

  validate(data: SourcePayment): boolean {
    return validatePayment(data);
  }

  transform(source: SourcePayment) {
    return {
      sacco_id: this.idMapper.get("saccos", source.sacco_id),
      ikimina_id: this.idMapper.get("ikimina", source.ikimina_id),
      member_id: this.idMapper.get("members", source.member_id),
      account_id: this.idMapper.get("accounts", source.account_id),
      amount: source.amount,
      currency: source.currency || "RWF",
      payment_method: source.payment_method,
      reference: source.reference,
      status: source.status || "matched",
      confidence: source.confidence,
      sms_id: source.sms_id,
      metadata: source.metadata || {},
      created_at: source.created_at,
      processed_at: source.processed_at,
    };
  }
}
