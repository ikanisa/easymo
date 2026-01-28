import type { SourceSacco } from "../types.js";
import { validateSacco } from "../validators/sacco.js";
import { BaseMigrator } from "./base.js";

export class SaccoMigrator extends BaseMigrator<SourceSacco> {
  get tableName() {
    return "saccos";
  }

  get displayName() {
    return "SACCOs";
  }

  validate(data: SourceSacco): boolean {
    return validateSacco(data);
  }

  transform(source: SourceSacco) {
    return {
      name: source.name,
      district: source.district,
      sector: source.sector,
      sector_code: source.sector_code,
      merchant_code: source.merchant_code,
      province: source.province,
      email: source.email,
      category: source.category || "Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)",
      logo_url: source.logo_url,
      brand_color: source.brand_color,
      status: source.status || "ACTIVE",
      metadata: source.metadata || {},
      created_at: source.created_at,
      updated_at: new Date().toISOString(),
    };
  }
}
