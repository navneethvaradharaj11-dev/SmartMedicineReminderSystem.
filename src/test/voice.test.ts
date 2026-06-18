import { describe, it, expect } from "vitest";
import { checkIsVoiceMale } from "../pages/Index";

describe("checkIsVoiceMale", () => {
  it("should classify male variant suffix voices correctly", () => {
    // Male variants: b, d, i, j, m, o
    expect(checkIsVoiceMale("Google US English", "en-us-x-iom-local")).toBe(true);
    expect(checkIsVoiceMale("Google US English", "en-us-x-iob-local")).toBe(true);
    expect(checkIsVoiceMale("Google US English", "en-us-x-tpd-local")).toBe(true);
    expect(checkIsVoiceMale("Tamil Male Voice", "ta-in-x-tad-local")).toBe(true);
  });

  it("should classify female variant suffix voices correctly", () => {
    // Female variants: a, c, e, f, g, h, k, l, n
    expect(checkIsVoiceMale("Google US English", "en-us-x-sfg-local")).toBe(false);
    expect(checkIsVoiceMale("Google US English", "en-us-x-iol-local")).toBe(false);
    expect(checkIsVoiceMale("Google US English", "en-us-x-tpc-local")).toBe(false);
    expect(checkIsVoiceMale("Google US English", "en-us-x-iog-local")).toBe(false);
    expect(checkIsVoiceMale("Google US English", "en-us-x-tpf-local")).toBe(false);
    expect(checkIsVoiceMale("Tamil Female Voice", "ta-in-x-tag-local")).toBe(false);
    expect(checkIsVoiceMale("Tamil Female Voice", "ta-in-x-tae-local")).toBe(false);
    expect(checkIsVoiceMale("Tamil Female Voice", "ta-in-x-tac-local")).toBe(false);
  });

  it("should classify named voices by keywords correctly", () => {
    // Named desktop/standard voices
    expect(checkIsVoiceMale("Microsoft David Desktop - English (United States)", "MSTTS_V110_enUS_DavidM")).toBe(true);
    expect(checkIsVoiceMale("Microsoft Zira Desktop - English (United States)", "MSTTS_V110_enUS_ZiraF")).toBe(false);
    
    // Explicit keywords
    expect(checkIsVoiceMale("Male Speaker", "some-uri")).toBe(true);
    expect(checkIsVoiceMale("Female Speaker", "some-uri")).toBe(false);
  });
});
