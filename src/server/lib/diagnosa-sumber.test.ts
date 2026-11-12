import { describe, expect, it } from "vitest";
import { catatanSumberDiagnosa, DIAGNOSA_SUMBER_CATATAN, diagnosaSumberSql } from "./diagnosa-sumber";

describe("catatanSumberDiagnosa", () => {
  it("menyebut porsi grouper dengan format angka Indonesia", () => {
    expect(catatanSumberDiagnosa(1234, 5678, "kasus")).toBe(
      `${DIAGNOSA_SUMBER_CATATAN} (1.234 dari 5.678 kasus)`,
    );
  });
  it("tanpa porsi bila total 0", () => {
    expect(catatanSumberDiagnosa(0, 0, "kunjungan")).toBe(DIAGNOSA_SUMBER_CATATAN);
  });
});

describe("diagnosaSumberSql", () => {
  it("memilih klinis, atau grouper bila kunjungan tanpa baris klinis berkode", () => {
    const sql = diagnosaSumberSql("md", "medicalrecord").replace(/\s+/g, " ");
    expect(sql).toContain("(md.INA_GROUPER = 0 OR (md.INA_GROUPER = 1 AND NOT EXISTS (");
    expect(sql).toContain("FROM medicalrecord.diagnosa dk WHERE dk.NOPEN = md.NOPEN");
    expect(sql).toContain("dk.INA_GROUPER = 0");
    expect(sql).toContain("dk.KODE IS NOT NULL AND dk.KODE <> ''");
  });

  it("menolak alias/database yang bukan identifier", () => {
    expect(() => diagnosaSumberSql("md; DROP", "medicalrecord")).toThrow();
    expect(() => diagnosaSumberSql("md", "medicalrecord`.x")).toThrow();
    expect(() => diagnosaSumberSql("", "medicalrecord")).toThrow();
  });
});
