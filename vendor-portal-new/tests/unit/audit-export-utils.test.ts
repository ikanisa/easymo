import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvHeaders, csvValue } from "@/app/api/admin/audit/export/route";

describe("audit export csv helpers", () => {
  it("renders empty strings for nullish values", () => {
    assert.equal(csvValue(null), "");
    assert.equal(csvValue(undefined), "");
  });

  it("escapes embedded quotes and wraps records with separators", () => {
    assert.equal(csvValue("plain"), "plain");
    assert.equal(csvValue("needs,comma"), '"needs,comma"');
    assert.equal(csvValue('"quoted"'), '"""quoted"""');
    assert.equal(csvValue("multi\nline"), '"multi\nline"');
  });

  it("produces attachment headers with csv content type", () => {
    const headers = csvHeaders() as Record<string, string>;
    assert.equal(headers["Content-Type"], "text/csv; charset=utf-8");
    const disposition = headers["Content-Disposition"];
    assert.ok(typeof disposition === "string");
    const prefix = 'attachment; filename="audit-export-';
    const suffix = '.csv"';
    assert.ok(disposition!.startsWith(prefix));
    assert.ok(disposition!.endsWith(suffix));
    const timestamp = disposition!.slice(prefix.length, -suffix.length);
    assert.ok(/^[0-9]+$/.test(timestamp));
  });
});
