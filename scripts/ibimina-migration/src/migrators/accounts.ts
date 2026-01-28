import type { SourceAccount } from "../types.js";
import { BaseMigrator } from "./base.js";

export class AccountMigrator extends BaseMigrator<SourceAccount> {
  get tableName() {
    return "accounts";
  }

  get displayName() {
    return "Accounts";
  }

  validate(data: SourceAccount): boolean {
    return Boolean(data.id && data.account_type);
  }

  transform(source: SourceAccount) {
    return {
      sacco_id: this.idMapper.get("saccos", source.sacco_id),
      ikimina_id: this.idMapper.get("ikimina", source.ikimina_id),
      member_id: this.idMapper.get("members", source.member_id),
      account_type: source.account_type,
      balance: source.balance || 0,
      currency: source.currency || "RWF",
      status: source.status || "ACTIVE",
      created_at: source.created_at,
      updated_at: new Date().toISOString(),
    };
  }
}
