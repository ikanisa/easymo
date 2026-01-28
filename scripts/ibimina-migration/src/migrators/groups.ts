import type { SourceIkimina } from "../types.js";
import { validateGroup } from "../validators/group.js";
import { BaseMigrator } from "./base.js";

export class GroupMigrator extends BaseMigrator<SourceIkimina> {
  get tableName() {
    return "ikimina";
  }

  get displayName() {
    return "Groups (Ikimina)";
  }

  validate(data: SourceIkimina): boolean {
    return validateGroup(data);
  }

  transform(source: SourceIkimina) {
    return {
      sacco_id: this.idMapper.getOrThrow("saccos", source.sacco_id),
      code: source.code,
      name: source.name,
      type: source.type || "ASCA",
      settings_json: source.settings_json || {},
      status: source.status || "ACTIVE",
      created_at: source.created_at,
      updated_at: new Date().toISOString(),
    };
  }
}
