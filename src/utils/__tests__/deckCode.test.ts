import { describe, it, expect } from "vitest";
import { encodeKcgDeckCode, decodeKcgDeckCode } from "../deckCode";

describe("KCG Deck Code Roundtrip", () => {
  const testCodes = [
    "KCG-8DLMyRZudwwdvMmMDPMqOSpBwx7OzmVZOuongvJWnbq8hLSC2?97JBaoKvWsW4lGkzzrTgpwonE",
    "KCG-vWuDyYIu6k7yPBQRbfJRPSB5okg3Ve5orLixJH2IhD6ggKoH81d",
    "KCG-zPgp1IishufKLBEjDOornCj2?17RKcoCoWhTvhGiNrJIRFosc59GvmE",
  ];

  testCodes.forEach((originalCode) => {
    it(`should decode and re-encode ${originalCode} back to the original`, () => {
      const decodedResult = decodeKcgDeckCode(originalCode);
      expect(decodedResult.isOk()).toBe(true);

      if (decodedResult.isOk()) {
        const decodedCardIds = decodedResult.value;
        const reEncodedCode = encodeKcgDeckCode(decodedCardIds);
        expect(reEncodedCode).toBe(originalCode);
      }
    });
  });
});
