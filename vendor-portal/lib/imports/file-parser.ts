import Papa from "papaparse";
import { loadXlsx } from "@/lib/imports/xlsx-loader";

type ParsedRow = Record<string, string>;

const CSV_EXTENSIONS = new Set([".csv"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm", ".xlsb"]);

type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
};

const toLowerExtension = (name: string) => {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
};

export async function parseTabularFile(file: File): Promise<ParseResult> {
  const extension = toLowerExtension(file.name);

  if (CSV_EXTENSIONS.has(extension) || file.type.includes("csv")) {
    return parseCsv(file);
  }

  if (
    EXCEL_EXTENSIONS.has(extension) ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel")
  ) {
    return parseXlsx(file);
  }

  // default to csv parsing attempt
  return parseCsv(file);
}

async function parseCsv(file: File): Promise<ParseResult> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(text, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        if (result.errors.length) {
          reject(new Error(result.errors[0]?.message ?? "Failed to parse CSV"));
          return;
        }
        const headers = result.meta.fields ?? [];
        resolve({ headers, rows: result.data });
      },
      error(parseError: Error) {
        reject(parseError);
      },
    });
  });
}

async function parseXlsx(file: File): Promise<ParseResult> {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows: ParsedRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
