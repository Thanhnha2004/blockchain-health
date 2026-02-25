import crypto from "crypto";
import { ethers } from "ethers";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // 256 bit
const IV_LENGTH = 16; // 128 bit

/**
 * Mã hóa file bằng AES-256-CBC
 * @param fileBuffer  Buffer của file gốc
 * @returns encrypted  Buffer đã mã hóa (IV + ciphertext ghép lại)
 * @returns key        AES key dạng hex — cần lưu lại để giải mã
 */
export function encryptFile(fileBuffer: Buffer): {
  encrypted: Buffer;
  key: string;
} {
  const key = crypto.randomBytes(KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

  // Ghép IV vào đầu để lưu cùng file — cần IV khi giải mã
  const result = Buffer.concat([iv, encrypted]);

  return {
    encrypted: result,
    key: key.toString("hex"),
  };
}

/**
 * Giải mã file sau khi fetch từ IPFS
 * @param encryptedBuffer  Buffer đã mã hóa (IV + ciphertext)
 * @param keyHex           AES key dạng hex
 * @returns Buffer của file gốc
 */
export function decryptFile(encryptedBuffer: Buffer, keyHex: string): Buffer {
  const key = Buffer.from(keyHex, "hex");

  // Tách IV ra khỏi đầu buffer
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Hash file để lưu on-chain — dùng keccak256 giống Solidity
 * @param fileBuffer  Buffer của file GỐC (trước khi mã hóa)
 * @returns hash dạng hex string "0x..."
 */
export function hashFile(fileBuffer: Buffer): string {
  return ethers.keccak256(fileBuffer);
}

/**
 * Verify file fetch về có khớp với hash trên chain không
 * @param fileBuffer   Buffer của file gốc (sau khi giải mã)
 * @param onChainHash  Hash lưu trên blockchain dạng "0x..."
 */
export function verifyIntegrity(
  fileBuffer: Buffer,
  onChainHash: string,
): boolean {
  return hashFile(fileBuffer) === onChainHash;
}
