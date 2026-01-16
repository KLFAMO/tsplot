// tsplot/src/data/parse.ts

import { TimandaMtsV1, TimandaTsplotJsonV1 } from "./timanda_schema";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

/**
 * Parse + validate "timanda-tsplot" JSON envelope.
 * Throws a descriptive Error when validation fails.
 */
export function parseTimandaTsplotJson(raw: unknown): TimandaTsplotJsonV1 {
  if (!isObject(raw)) {
    throw new Error("tsplot: invalid data (expected object).");
  }

  const schema = raw.schema;
  const version = raw.version;
  const type = raw.type;

  if (schema !== "timanda-tsplot") {
    throw new Error(`tsplot: unsupported schema: ${String(schema)}.`);
  }
  if (version !== 1) {
    throw new Error(`tsplot: unsupported version: ${String(version)}.`);
  }
  if (type !== "MTS") {
    throw new Error(`tsplot: unsupported type: ${String(type)}.`);
  }

  const segments = raw.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("tsplot: MTS has no segments.");
  }

  // Validate first segment strictly (others can be validated later as needed)
  const s0 = segments[0];
  if (!isObject(s0)) {
    throw new Error("tsplot: invalid segment[0] (expected object).");
  }

  if (!isNumberArray(s0.mjd) || !isNumberArray(s0.val)) {
    throw new Error("tsplot: invalid segment[0] (expected mjd:number[] and val:number[]).");
  }

  // We can accept the raw object as TimandaMtsV1 now (already validated essentials).
  return raw as TimandaMtsV1;
}
