import PinataSDK from "@pinata/sdk";
import { Readable } from "stream";

const pinata = new PinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_SECRET!,
);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 giây

// ─── Errors ───────────────────────────────────────────────────────────────────

export class IPFSUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IPFSUploadError";
  }
}

export class IPFSFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IPFSFetchError";
  }
}

export class FileTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(
      `File size ${sizeBytes} bytes exceeds limit of ${MAX_FILE_SIZE} bytes (100MB)`,
    );
    this.name = "FileTooLargeError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY,
  label: string = "operation",
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === retries;
      console.error(
        `[IPFS] ${label} attempt ${attempt}/${retries} failed:`,
        (err as Error).message,
      );

      if (isLast) throw err;
      await sleep(delay * attempt); // exponential backoff
    }
  }
  throw new Error("Unreachable");
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload dữ liệu đã mã hóa lên IPFS qua Pinata — có retry
 * @param encryptedData  Buffer của file đã mã hóa
 * @param filename       Tên file để quản lý trên Pinata dashboard
 * @returns CID của file trên IPFS
 */
export async function uploadToIPFS(
  encryptedData: Buffer,
  filename: string = "record",
): Promise<string> {
  // Edge case: file quá lớn
  if (encryptedData.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(encryptedData.length);
  }

  return withRetry(
    async () => {
      const stream = Readable.from(encryptedData);
      (stream as any).path = filename;

      const result = await pinata.pinFileToIPFS(stream, {
        pinataMetadata: { name: filename },
      });

      return result.IpfsHash;
    },
    MAX_RETRIES,
    RETRY_DELAY,
    "uploadToIPFS",
  ).catch((err) => {
    throw new IPFSUploadError(`Failed to upload to IPFS: ${err.message}`);
  });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://ipfs.io/ipfs",
];

/**
 * Fetch file từ IPFS — thử nhiều gateway nếu một cái timeout
 * @param cid  CID của file cần fetch
 * @returns Buffer của file
 */
export async function fetchFromIPFS(cid: string): Promise<Buffer> {
  // Edge case: CID rỗng
  if (!cid || cid.trim() === "") {
    throw new IPFSFetchError("CID cannot be empty");
  }

  // Thử từng gateway, gateway nào thành công thì dùng
  for (const gateway of IPFS_GATEWAYS) {
    try {
      return await withRetry(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

          try {
            const response = await fetch(`${gateway}/${cid}`, {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            return Buffer.from(await response.arrayBuffer());
          } finally {
            clearTimeout(timeout);
          }
        },
        MAX_RETRIES,
        RETRY_DELAY,
        `fetchFromIPFS(${gateway})`,
      );
    } catch (err) {
      console.warn(`[IPFS] Gateway ${gateway} failed, trying next...`);
    }
  }

  throw new IPFSFetchError(`Failed to fetch CID ${cid} from all gateways`);
}

/**
 * Kiểm tra kết nối Pinata
 */
export async function testPinataConnection(): Promise<boolean> {
  const result = await pinata.testAuthentication();
  return result.authenticated;
}
