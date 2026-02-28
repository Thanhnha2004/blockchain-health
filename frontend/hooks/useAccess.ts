"use client";

import { useState } from "react";
import { useContracts } from "./useContracts";

export function useAccess() {
  const { contracts } = useContracts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grantAccess(
    patientDID: string,
    doctorAddress: string,
    durationHours: number,
    dataTypes: string[],
  ) {
    if (!contracts) throw new Error("Wallet not connected");

    setLoading(true);
    setError(null);

    try {
      const contract = await contracts.getAccessControl();
      const tx = await contract.grantAccess(
        patientDID,
        doctorAddress,
        durationHours,
        dataTypes,
      );
      await tx.wait();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function revokeAccess(patientDID: string, doctorAddress: string) {
    if (!contracts) throw new Error("Wallet not connected");

    setLoading(true);
    setError(null);

    try {
      const contract = await contracts.getAccessControl();
      const tx = await contract.revokeAccess(patientDID, doctorAddress);
      await tx.wait();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function hasAccess(
    patientDID: string,
    address: string,
  ): Promise<boolean> {
    if (!contracts) return false;
    const contract = await contracts.getAccessControl();
    return contract.hasAccess(patientDID, address);
  }

  async function getAuditLogs(patientDID: string) {
    console.log("queryLogs patientDID:", patientDID);
    if (!contracts) return [];
    const contract = await contracts.getAuditLog();
    return contract.queryLogs(patientDID);
  }

  return { grantAccess, revokeAccess, hasAccess, getAuditLogs, loading, error };
}
