import JSZip from "jszip";
import { toCsv } from "@/lib/export/csv";
import { promptTemplate } from "@/lib/export/prompt";
import type { ExportData, JsonRecord } from "@/lib/types";

const activityFields = [
  "activity_id",
  "name",
  "sport_type",
  "type",
  "started_at",
  "distance_m",
  "moving_time_s",
  "elapsed_time_s",
  "avg_heartrate",
  "max_heartrate",
  "average_watts",
  "gear_id",
];

export async function buildExportZip(data: ExportData): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("activities.csv", toCsv(data.activities, activityFields));
  zip.file("laps.csv", toCsv(data.laps));
  zip.file("zones.csv", toCsv(data.zones));
  zip.file("gear.csv", toCsv(data.gear));
  zip.file("athlete_profile.json", JSON.stringify(redactAthlete(data.athlete.profile), null, 2));
  zip.file("athlete_stats.json", JSON.stringify(data.athleteStats ?? {}, null, 2));
  zip.file("athlete_zones.json", JSON.stringify(data.athleteZones ?? {}, null, 2));
  zip.file("prompt_template.txt", promptTemplate);

  for (const stream of data.streams) {
    zip.file(`streams/${stream.activityId}.csv`, streamToCsv(stream.data));
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function streamToCsv(streams: JsonRecord): string {
  const entries = Object.entries(streams)
    .map(([key, value]) => [key, value && typeof value === "object" ? (value as JsonRecord).data : null] as const)
    .filter((entry): entry is readonly [string, unknown[]] => Array.isArray(entry[1]));

  const maxLength = entries.reduce((max, [, values]) => Math.max(max, values.length), 0);
  const rows = Array.from({ length: maxLength }, (_, index) => {
    const row: JsonRecord = {};
    for (const [key, values] of entries) {
      row[key] = Array.isArray(values[index]) ? JSON.stringify(values[index]) : values[index];
    }
    return row;
  });
  return toCsv(rows, entries.map(([key]) => key));
}

function redactAthlete(profile: JsonRecord): JsonRecord {
  const copy = { ...profile };
  delete copy.access_token;
  delete copy.refresh_token;
  return copy;
}
