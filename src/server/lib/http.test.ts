import { describe, expect, it } from "vitest";
import { PayloadTooLargeError, ValidationError } from "./errors";
import { parseJson, readJson, readJsonTerbatas } from "./http";

const permintaan = (body: BodyInit, header: Record<string, string> = {}) =>
  new Request("http://localhost/x", { method: "POST", body, headers: header, duplex: "half" } as RequestInit);

describe("parseJson", () => {
  it("JSON sah apa adanya", () => {
    expect(parseJson('{"a":1,"b":[{"c":"x"}]}')).toEqual({ a: 1, b: [{ c: "x" }] });
  });

  it.each([
    ['{"__proto__":{"admin":true}}'],
    ['{"a":{"b":[{"__proto__":{"x":1}}]}}'],
    ['[{"__proto__":null}]'],
  ])("kunci __proto__ di kedalaman mana pun → 422 %s", (teks) => {
    expect(() => parseJson(teks)).toThrow(ValidationError);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("nilai string '__proto__' (bukan kunci) tetap boleh", () => {
    expect(parseJson('{"a":"__proto__"}')).toEqual({ a: "__proto__" });
  });

  it("JSON rusak / kosong → 422", () => {
    expect(() => parseJson('{"a":')).toThrow(ValidationError);
    expect(() => parseJson("")).toThrow(ValidationError);
  });
});

describe("readJsonTerbatas", () => {
  it("di bawah batas → objek", async () => {
    await expect(readJsonTerbatas(permintaan('{"a":1}'), 100)).resolves.toEqual({ a: 1 });
  });

  it("Content-Length di atas batas → 413 tanpa membaca body", async () => {
    await expect(readJsonTerbatas(permintaan("{}", { "content-length": "999" }), 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("body aliran tanpa Content-Length di atas batas → 413, pembacaan berhenti", async () => {
    let ditarik = 0;
    const aliran = new ReadableStream<Uint8Array>({
      pull(c) {
        ditarik++;
        if (ditarik > 1000) return c.close();
        c.enqueue(new Uint8Array(1024).fill(0x61));
      },
    });
    await expect(readJsonTerbatas(permintaan(aliran), 8 * 1024)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(ditarik).toBeLessThan(20);
  });

  it("kunci __proto__ → 422", async () => {
    await expect(readJsonTerbatas(permintaan('{"__proto__":{"x":1}}'), 100)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("readJson", () => {
  it("sah / rusak / __proto__", async () => {
    await expect(readJson(permintaan('{"a":[1]}'))).resolves.toEqual({ a: [1] });
    await expect(readJson(permintaan("bukan json"))).rejects.toBeInstanceOf(ValidationError);
    await expect(readJson(permintaan('{"__proto__":{}}'))).rejects.toBeInstanceOf(ValidationError);
  });
});
