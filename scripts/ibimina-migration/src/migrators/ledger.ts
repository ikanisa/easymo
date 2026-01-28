import type { SourceLedgerEntry } from "../types.js";
import { BaseMigrator } from "./base.js";

export class LedgerMigrator extends BaseMigrator<SourceLedgerEntry> {
  get tableName() {
    return "ledger_entries";
  }

  get displayName() {
    return "Ledger Entries";
  }

  validate(data: SourceLedgerEntry): boolean {
    return Boolean(data.id && data.amount !== undefined);
  }

  transform(source: SourceLedgerEntry) {
    return {
      sacco_id: this.idMapper.get("saccos", source.sacco_id),
      debit_id: this.idMapper.get("accounts", source.debit_id),
      credit_id: this.idMapper.get("accounts", source.credit_id),
      amount: source.amount,
      value_date: source.value_date,
      description: source.description,
      reference: source.reference,
      created_at: source.created_at,
    };
  }
}
