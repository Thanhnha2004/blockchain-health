import PinataSDK from "@pinata/sdk";
import { Readable } from "stream";

const pinata = new PinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_SECRET!,
);

/**
 * Upload dữ liệu đã mã hóa lên IPFS qua Pinata
 * @param encryptedData  Buffer của file đã mã hóa
 * @param filename       Tên file để dễ quản lý trên Pinata dashboard
 * @returns CID của file trên IPFS
 */
export async function uploadToIPFS(
  encryptedData: Buffer,
  filename: string = "record",
): Promise<string> {
  const stream = Readable.from(encryptedData);
  // Pinata yêu cầu stream có property path
  (stream as any).path = filename;

  const result = await pinata.pinFileToIPFS(stream, {
    pinataMetadata: { name: filename },
  });

  return result.IpfsHash; // CID
}

/**
 * Fetch file đã mã hóa từ IPFS
 * @param cid  CID của file cần fetch
 * @returns Buffer của file
 */
export async function fetchFromIPFS(cid: string): Promise<Buffer> {
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `IPFS fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Kiểm tra kết nối Pinata
 */
export async function testPinataConnection(): Promise<boolean> {
  const result = await pinata.testAuthentication();
  return result.authenticated;
}
