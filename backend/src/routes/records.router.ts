import { Router, Request, Response } from "express";
import multer from "multer";
import { encryptFile, hashFile, decryptFile, verifyIntegrity } from "../services/crypto.service";
import { uploadToIPFS, fetchFromIPFS } from "../services/ipfs.service";
import { getRecordRegistry, getAccessControl } from "../services/contract.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── POST /records ────────────────────────────────────────────────────────────

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

  const fileBuffer         = req.file.buffer;
  const dataHash           = hashFile(fileBuffer);
  const { encrypted, key } = encryptFile(fileBuffer);
  const ipfsCID            = await uploadToIPFS(encrypted, req.file.originalname);

  const tx = await getRecordRegistry().addRecord(patientDID, ipfsCID, dataHash, recordType);
  await tx.wait();

  res.status(201).json({ ipfsCID, dataHash, recordType, key, txHash: tx.hash });
});

// ─── GET /records/:patientDID ─────────────────────────────────────────────────

router.get("/:patientDID", async (req: Request, res: Response) => {
  const { patientDID }    = req.params;
  const { callerAddress, aesKey } = req.query as { callerAddress: string; aesKey?: string };

  if (!callerAddress) {
    res.status(400).json({ error: "callerAddress is required" });
    return;
  }

  const hasAccess = await getAccessControl().hasAccess(patientDID, callerAddress);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const records = await getRecordRegistry().getRecords(patientDID);

  if (aesKey) {
    const decryptedRecords = await Promise.all(
      records.map(async (record: any) => {
        const encryptedBuffer = await fetchFromIPFS(record.ipfsCID);
        const decrypted       = decryptFile(encryptedBuffer, aesKey);
        const isValid         = verifyIntegrity(decrypted, record.dataHash);
        return {
          ipfsCID:    record.ipfsCID,
          dataHash:   record.dataHash,
          recordType: record.recordType,
          createdBy:  record.createdBy,
          createdAt:  Number(record.createdAt),
          fileBase64: decrypted.toString("base64"),
          isValid,
        };
      }),
    );
    res.json({ records: decryptedRecords });
    return;
  }

  res.json({
    records: records.map((r: any) => ({
      ipfsCID:    r.ipfsCID,
      dataHash:   r.dataHash,
      recordType: r.recordType,
      createdBy:  r.createdBy,
      createdAt:  Number(r.createdAt),
    })),
  });
});

export default router;