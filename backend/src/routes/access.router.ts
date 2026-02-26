import { Router, Request, Response } from "express";
import { getAccessControl, getAuditLog } from "../services/contract.service";

const router = Router();

router.post("/grant", async (req: Request, res: Response) => {
  const { patientDID, doctorAddress, durationHours, dataTypes } = req.body;

  if (!patientDID || !doctorAddress || !durationHours || !dataTypes) {
    res.status(400).json({ error: "patientDID, doctorAddress, durationHours, dataTypes are required" });
    return;
  }
  if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
    res.status(400).json({ error: "dataTypes must be a non-empty array" });
    return;
  }

  const tx = await getAccessControl().grantAccess(patientDID, doctorAddress, durationHours, dataTypes);
  await tx.wait();

  res.status(201).json({ message: "Access granted", patientDID, doctorAddress, durationHours, dataTypes, txHash: tx.hash });
});

router.post("/revoke", async (req: Request, res: Response) => {
  const { patientDID, doctorAddress } = req.body;

  if (!patientDID || !doctorAddress) {
    res.status(400).json({ error: "patientDID and doctorAddress are required" });
    return;
  }

  const tx = await getAccessControl().revokeAccess(patientDID, doctorAddress);
  await tx.wait();

  res.json({ message: "Access revoked", patientDID, doctorAddress, txHash: tx.hash });
});

router.get("/check", async (req: Request, res: Response) => {
  const { patientDID, callerAddress } = req.query as { patientDID: string; callerAddress: string };

  if (!patientDID || !callerAddress) {
    res.status(400).json({ error: "patientDID and callerAddress are required" });
    return;
  }

  const hasAccess = await getAccessControl().hasAccess(patientDID, callerAddress);
  res.json({ hasAccess });
});

router.get("/audit/:patientDID", async (req: Request, res: Response) => {
  const { patientDID } = req.params;

  const logs = await getAuditLog().queryLogs(patientDID);

  res.json({
    patientDID,
    logs: logs.map((entry: any) => ({
      actor:      entry.actor,
      action:     entry.action,
      timestamp:  Number(entry.timestamp),
      patientDID: entry.patientDID,
    })),
  });
});

export default router;