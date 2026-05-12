import Papa from "papaparse";
import type { JsonRecord } from "@/lib/types";

export function toCsv(rows: JsonRecord[], fields?: string[]): string {
  const allFields = fields ?? collectFields(rows);
  return Papa.unparse(
    {
      fields: allFields,
      data: rows.map((row) => allFields.map((field) => normalizeValue(row[field]))),
    },
    {
      escapeFormulae: true,
      quotes: true,
    },
  );
}

export function collectFields(rows: JsonRecord[]): string[] {
  const fields = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) fields.add(key);
  }
  return [...fields];
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}
