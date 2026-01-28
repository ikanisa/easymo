import type { SourceMember, TargetMember } from "../types.js";
import { processPII } from "../utils/crypto.js";
import { validateMember } from "../validators/member.js";
import { BaseMigrator } from "./base.js";

export class MemberMigrator extends BaseMigrator<SourceMember, TargetMember> {
  get tableName() {
    return "members";
  }

  get displayName() {
    return "Members";
  }

  validate(data: SourceMember): boolean {
    return validateMember(data);
  }

  transform(source: SourceMember): TargetMember {
    // Process PII fields
    const phonePII = processPII(source.msisdn, "phone");
    const nationalIdPII = processPII(source.national_id, "national_id");

    return {
      ikimina_id: this.idMapper.get("ikimina", source.ikimina_id),
      sacco_id: this.idMapper.getOrThrow("saccos", source.sacco_id),
      member_code: source.member_code,
      full_name: source.full_name,
      
      // National ID - encrypted, hashed, masked
      national_id: null,
      national_id_encrypted: nationalIdPII.encrypted,
      national_id_hash: nationalIdPII.hash,
      national_id_masked: nationalIdPII.masked,
      
      // Phone - encrypted, hashed, masked
      msisdn: null,
      msisdn_encrypted: phonePII.encrypted,
      msisdn_hash: phonePII.hash,
      msisdn_masked: phonePII.masked,
      
      joined_at: source.joined_at || source.created_at,
      status: source.status || "ACTIVE",
      created_at: source.created_at,
      updated_at: new Date().toISOString(),
    };
  }
}
