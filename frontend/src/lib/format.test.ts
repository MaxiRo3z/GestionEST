import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formatea un string numérico como pesos argentinos", () => {
    expect(formatMoney("1000")).toContain("1.000");
  });

  it("formatea un number", () => {
    expect(formatMoney(1500.5)).toContain("1.500");
  });

  it("no rompe con cero", () => {
    expect(formatMoney("0")).toContain("0");
  });
});

describe("formatDate", () => {
  it("convierte YYYY-MM-DD a DD/MM/YYYY", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
  });

  it("ignora la parte de hora si viene un datetime completo", () => {
    expect(formatDate("2026-03-05T10:30:00Z")).toBe("05/03/2026");
  });

  it("devuelve vacío si no hay fecha", () => {
    expect(formatDate("")).toBe("");
  });
});
