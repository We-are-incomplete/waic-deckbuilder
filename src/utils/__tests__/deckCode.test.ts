/**
 * KCG形式デッキコードのエンコード・デコード機能のテスト
 * ラウンドトリップ（エンコード→デコード→エンコード）の一貫性を検証
 */
import { describe, it, expect } from "vitest";
import { encodeKcgDeckCode, decodeKcgDeckCode } from "../deckCode";

describe("KCG Deck Code Roundtrip", () => {
  const testCodes = [
    "KCG-8DLMyRZudwwdvMmMDPMqOSpBwx7OzmVZOuongvJWnbq8hLSC2?97JBaoKvWsW4lGkzzrTgpwonE",
    "KCG-vWuDyYIu6k7yPBQRbfJRPSB5okg3Ve5orLixJH2IhD6ggKoH81d",
    "KCG-8Pgp1IishufKLBEjDOornCj2?17RKcoCoWhTvEOC!TOIRFosKs2jOPG",
  ];

  testCodes.forEach((originalCode) => {
    it(`should decode and re-encode ${originalCode} back to the original`, () => {
      const decodedResult = decodeKcgDeckCode(originalCode);
      expect(decodedResult.isOk()).toBe(true);

      if (decodedResult.isOk()) {
        const decodedCardIds = decodedResult.value;
        const reEncodedCodeResult = encodeKcgDeckCode(decodedCardIds);
        expect(reEncodedCodeResult.isOk()).toBe(true);
        if (!reEncodedCodeResult.isOk()) return;

        expect(reEncodedCodeResult.value).toBe(originalCode);
      }
    });
  });
});
