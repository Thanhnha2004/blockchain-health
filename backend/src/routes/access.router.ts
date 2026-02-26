import { Router, Request, Response } from "express";
import { accessControl, auditLog } from "../services/contract.service";

const router = Router();

// ─── POST /access/grant ───────────────────────────────────────────────────────
// Body: { patientDID, doctorAddress, durationHours, dataTypes }
// Flow: verify caller là patient → gọi contract grantAccess

router.post("/grant", async (req: Request, res: Response) => {
  const { patientDID, doctorAddress, durationHours, dataTypes } = req.body;

  if (!patientDID || !doctorAddress || !durationHours || !dataTypes) {
    res
      .status(400)
      .json({
        error:
          "patientDID, doctorAddress, durationHours, dataTypes are required",
      });
    return;
  }

  if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
    res.status(400).json({ error: "dataTypes must be a non-empty array" });
    return;
  }

  const tx = await accessControl.grantAccess(
    patientDID,
    doctorAddress,
    durationHours,
    dataTypes,
  );
  await tx.wait();

  res.status(201).json({
    message: "Access granted",
    patientDID,
    doctorAddress,
    durationHours,
    dataTypes,
    txHash: tx.hash,
  });
});

// ─── POST /access/revoke ──────────────────────────────────────────────────────

router.post("/revoke", async (req: Request, res: Response) => {
  const { patientDID, doctorAddress } = req.body;

  if (!patientDID || !doctorAddress) {
    res
      .status(400)
      .json({ error: "patientDID and doctorAddress are required" });
    return;
  }

  const tx = await accessControl.revokeAccess(patientDID, doctorAddress);
  await tx.wait();

  res.json({
    message: "Access revoked",
    patientDID,
    doctorAddress,
    txHash: tx.hash,
  });
});

// ─── GET /access/check ────────────────────────────────────────────────────────

router.get("/check", async (req: Request, res: Response) => {
  const { patientDID, callerAddress } = req.query as {
    patientDID: string;
    callerAddress: string;
  };

  if (!patientDID || !callerAddress) {
    res
      .status(400)
      .json({ error: "patientDID and callerAddress are required" });
    return;
  }

  const hasAccess = await accessControl.hasAccess(patientDID, callerAddress);
  res.json({ hasAccess });
});

// ─── GET /audit/:patientDID ───────────────────────────────────────────────────
// Flow: query auditLog contract → trả về danh sách ai đã truy cập

router.get("/audit/:patientDID", async (req: Request, res: Response) => {
  const { patientDID } = req.params;

  const logs = await auditLog.queryLogs(patientDID);

  res.json({
    patientDID,
    logs: logs.map((entry: any) => ({
      actor: entry.actor,
      action: entry.action,
      timestamp: Number(entry.timestamp),
      patientDID: entry.patientDID,
    })),
  });
});

export default router;
