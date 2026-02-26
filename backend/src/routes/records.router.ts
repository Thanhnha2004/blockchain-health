import { Router, Request, Response } from "express";
import multer from "multer";
import { encryptFile, hashFile } from "../services/crypto.service";
import { uploadToIPFS, fetchFromIPFS } from "../services/ipfs.service";
import { recordRegistry, accessControl } from "../services/contract.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── POST /records ────────────────────────────────────────────────────────────
// Body: multipart/form-data { patientDID, recordType, file }
// Flow: encrypt file → upload IPFS → hash → gọi contract addRecord

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  const { patientDID, recordType } = req.body;

  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }
  if (!patientDID || !recordType) {
    res.status(400).json({ error: "patientDID and recordType are required" });
    return;
  }

  // 1. Hash file gốc — lưu on-chain để verify sau
  const fileBuffer = req.file.buffer;
  const dataHash = hashFile(fileBuffer);

  // 2. Mã hóa file
  const { encrypted, key } = encryptFile(fileBuffer);

  // 3. Upload file đã mã hóa lên IPFS
  const ipfsCID = await uploadToIPFS(encrypted, req.file.originalname);

  // 4. Gọi contract addRecord
  const tx = await recordRegistry.addRecord(
    patientDID,
    ipfsCID,
    dataHash,
    recordType,
  );
  await tx.wait();

  // NOTE: key cần được mã hóa bằng RSA public key của bệnh nhân trước khi trả về
  // Hiện tại trả về plaintext để test — KHÔNG dùng trong production
  res.status(201).json({
    ipfsCID,
    dataHash,
    recordType,
    key, // TODO: RSA encrypt bằng public key bệnh nhân
    txHash: tx.hash,
  });
});

// ─── GET /records/:patientDID ─────────────────────────────────────────────────
// Flow: check hasAccess on-chain → fetch IPFS → decrypt → trả về

router.get("/:patientDID", async (req: Request, res: Response) => {
  const { patientDID } = req.params;
  const { callerAddress, aesKey } = req.query as {
    callerAddress: string;
    aesKey: string;
  };

  if (!callerAddress) {
    res.status(400).json({ error: "callerAddress is required" });
    return;
  }

  // 1. Check quyền truy cập on-chain
  const hasAccess = await accessControl.hasAccess(patientDID, callerAddress);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // 2. Lấy danh sách records từ contract
  const records = await recordRegistry.getRecords(patientDID);

  // 3. Nếu có AES key → fetch và decrypt file từ IPFS
  if (aesKey) {
    const { decryptFile } = await import("../services/crypto.service");
    const { verifyIntegrity } = await import("../services/crypto.service");

    const decryptedRecords = await Promise.all(
      records.map(async (record: any) => {
        const encryptedBuffer = await fetchFromIPFS(record.ipfsCID);
        const decrypted = decryptFile(encryptedBuffer, aesKey);
        const isValid = verifyIntegrity(decrypted, record.dataHash);

        return {
          ipfsCID: record.ipfsCID,
          dataHash: record.dataHash,
          recordType: record.recordType,
          createdBy: record.createdBy,
          createdAt: Number(record.createdAt),
          fileBase64: decrypted.toString("base64"),
          isValid,
        };
      }),
    );

    res.json({ records: decryptedRecords });
    return;
  }

  // Không có key → chỉ trả metadata
  res.json({
    records: records.map((r: any) => ({
      ipfsCID: r.ipfsCID,
      dataHash: r.dataHash,
      recordType: r.recordType,
      createdBy: r.createdBy,
      createdAt: Number(r.createdAt),
    })),
  });
});

export default router;
