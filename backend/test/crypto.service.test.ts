import { expect } from "chai";
import { encryptFile, decryptFile, hashFile, verifyIntegrity } from "../src/services/crypto.service";

describe("crypto.service", () => {
  const sampleContent = "Kết quả xét nghiệm máu: Hemoglobin 13.5 g/dL, bình thường.";
  const fileBuffer = Buffer.from(sampleContent, "utf-8");

  // ─── encryptFile ──────────────────────────────────────────

  describe("encryptFile", () => {
    it("should return encrypted buffer and key", () => {
      const { encrypted, key } = encryptFile(fileBuffer);
      expect(encrypted).to.be.instanceOf(Buffer);
      expect(key).to.be.a("string");
      expect(key).to.have.length(64); // 32 bytes hex = 64 chars
    });

    it("encrypted output should differ from original", () => {
      const { encrypted } = encryptFile(fileBuffer);
      expect(encrypted.equals(fileBuffer)).to.be.false;
    });

    it("two encryptions of same file should produce different output (random IV)", () => {
      const { encrypted: enc1 } = encryptFile(fileBuffer);
      const { encrypted: enc2 } = encryptFile(fileBuffer);
      expect(enc1.equals(enc2)).to.be.false;
    });
  });

  // ─── decryptFile ──────────────────────────────────────────

  describe("decryptFile", () => {
    it("should decrypt back to original content", () => {
      const { encrypted, key } = encryptFile(fileBuffer);
      const decrypted = decryptFile(encrypted, key);
      expect(decrypted.toString("utf-8")).to.equal(sampleContent);
    });

    it("should throw with wrong key", () => {
      const { encrypted } = encryptFile(fileBuffer);
      const wrongKey = Buffer.from("a".repeat(64), "hex").toString("hex");
      expect(() => decryptFile(encrypted, wrongKey)).to.throw();
    });
  });

  // ─── hashFile ─────────────────────────────────────────────

  describe("hashFile", () => {
    it("should return a 0x-prefixed hex string", () => {
      const hash = hashFile(fileBuffer);
      expect(hash).to.match(/^0x[0-9a-f]{64}$/);
    });

    it("same file should produce same hash", () => {
      expect(hashFile(fileBuffer)).to.equal(hashFile(fileBuffer));
    });

    it("different files should produce different hash", () => {
      const other = Buffer.from("nội dung khác", "utf-8");
      expect(hashFile(fileBuffer)).to.not.equal(hashFile(other));
    });
  });

  // ─── verifyIntegrity ──────────────────────────────────────

  describe("verifyIntegrity", () => {
    it("should return true for matching hash", () => {
      const hash = hashFile(fileBuffer);
      expect(verifyIntegrity(fileBuffer, hash)).to.be.true;
    });

    it("should return false for tampered file", () => {
      const hash = hashFile(fileBuffer);
      const tampered = Buffer.from("nội dung bị sửa", "utf-8");
      expect(verifyIntegrity(tampered, hash)).to.be.false;
    });

    it("should return false for wrong hash", () => {
      const wrongHash = "0x" + "0".repeat(64);
      expect(verifyIntegrity(fileBuffer, wrongHash)).to.be.false;
    });
  });

  // ─── Full flow ────────────────────────────────────────────

  describe("full encrypt → decrypt → verify flow", () => {
    it("should encrypt, decrypt, and verify integrity correctly", () => {
      // Encrypt
      const { encrypted, key } = encryptFile(fileBuffer);

      // Hash file gốc để lưu on-chain
      const onChainHash = hashFile(fileBuffer);

      // Decrypt sau khi fetch từ IPFS
      const decrypted = decryptFile(encrypted, key);

      // Verify file khớp với hash on-chain
      expect(verifyIntegrity(decrypted, onChainHash)).to.be.true;
      expect(decrypted.toString("utf-8")).to.equal(sampleContent);
    });
  });
});