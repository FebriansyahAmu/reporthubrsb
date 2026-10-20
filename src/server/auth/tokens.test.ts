import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC, signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokens";

const RAHASIA = "rahasia-uji-refresh-token-minimal-32-karakter";
const sekarang = () => Math.floor(Date.now() / 1000);

beforeAll(() => {
  process.env.AUTH_ACCESS_SECRET = "rahasia-uji-access-token-minimal-32-karakter";
  process.env.AUTH_REFRESH_SECRET = RAHASIA;
});

describe("refresh token: auth_time & batas mutlak", () => {
  it("auth_time dibawa utuh dan dibaca kembali", async () => {
    const mulai = sekarang() - 3600;
    const t = await signRefreshToken("u1", "j1", mulai);
    expect((await verifyRefreshToken(t))?.authTime).toBe(mulai);
    expect(decodeJwt(t).exp).toBe(sekarang() + REFRESH_TTL_SEC);
  });

  it("exp dipotong di batas mutlak sesi (refresh & access)", async () => {
    const batas = sekarang() + 300;
    const r = await signRefreshToken("u1", "j1", sekarang() - 3600, batas);
    const a = await signAccessToken({ sub: "u1", username: "u", name: "U", role: "r" }, batas);
    expect(decodeJwt(r).exp).toBe(batas);
    expect(decodeJwt(a).exp).toBe(batas);
    const jauh = sekarang() + 99_999;
    expect(decodeJwt(await signAccessToken({ sub: "u1", username: "u", name: "U", role: "r" }, jauh)).exp).toBe(sekarang() + ACCESS_TTL_SEC);
  });

  it("token lama tanpa auth_time → iat; auth_time di masa depan / rusak → iat", async () => {
    const iat = sekarang() - 120;
    const buat = (klaim: Record<string, unknown>) =>
      new SignJWT(klaim)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject("u1")
        .setJti("j")
        .setIssuedAt(iat)
        .setExpirationTime(iat + 3600)
        .sign(new TextEncoder().encode(RAHASIA));
    expect((await verifyRefreshToken(await buat({})))?.authTime).toBe(iat);
    expect((await verifyRefreshToken(await buat({ auth_time: iat + 500 })))?.authTime).toBe(iat);
    expect((await verifyRefreshToken(await buat({ auth_time: "kemarin" })))?.authTime).toBe(iat);
  });

  it("tanda tangan salah → null", async () => {
    const palsu = await new SignJWT({ auth_time: 1 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("u1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("rahasia-lain-yang-tidak-sah-sama-sekali-ya"));
    expect(await verifyRefreshToken(palsu)).toBeNull();
  });
});
