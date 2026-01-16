// tsplot/src/data/timanda_schema.ts

export type TimandaTsplotSchema = "timanda-tsplot";

export type TimandaTsplotEnvelopeBase = {
  schema: TimandaTsplotSchema;
  version: number;
  type: string;
};

export type TimandaMtsSegmentV1 = {
  mjd: number[];
  val: number[];
};

export type TimandaMtsV1 = TimandaTsplotEnvelopeBase & {
  type: "MTS";
  version: 1;
  segments: TimandaMtsSegmentV1[];
};

// Na przyszłość: można tu dodać kolejne typy (np. GTSerie)
export type TimandaTsplotJsonV1 = TimandaMtsV1;
