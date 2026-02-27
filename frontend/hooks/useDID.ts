"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { useContracts } from "./useContracts";

export function useDID() {
  const { address } = useAccount();
  const { contracts } = useContracts();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /**
   * Tạo DID hash từ string — giống cách làm trong test
   */
  function makeDID(didString: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(didString));
  }

  /**
   * Đăng ký DID mới cho user hiện tại
   */
  async function registerDID(publicKey: string, serviceEndpoint: string) {
    if (!contracts || !address) throw new Error("Wallet not connected");

    setLoading(true);
    setError(null);

    try {
      const did      = makeDID(`did:health:vn:${address}`);
      const contract = await contracts.getDIDRegistry();
      const tx       = await contract.registerDID(did, publicKey, serviceEndpoint);
      await tx.wait();
      return did;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lấy thông tin DID của một địa chỉ
   */
  async function resolveDID(did: string) {
    if (!contracts) throw new Error("Wallet not connected");

    const contract = await contracts.getDIDRegistry();
    return contract.resolveDID(did);
  }

  /**
   * Lấy DID của address hiện tại
   */
  async function getMyDID(): Promise<string | null> {
    if (!contracts || !address) return null;

    const contract = await contracts.getDIDRegistry();
    const did      = await contract.getDIDByAddress(address);

    // ZeroHash nghĩa là chưa đăng ký
    if (did === ethers.ZeroHash) return null;
    return did;
  }

  return { registerDID, resolveDID, getMyDID, makeDID, loading, error };
}