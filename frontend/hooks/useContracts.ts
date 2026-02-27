"use client";

import { BrowserProvider, Contract } from "ethers";
import { useWalletClient } from "wagmi";
import { useMemo } from "react";

// Import ABI từ artifacts — đường dẫn tương đối từ frontend đến root project
import DIDRegistryABI from "../../artifacts/contracts/DIDRegistry.sol/DIDRegistry.json";
import HealthAccessControlABI from "../../artifacts/contracts/HealthAccessControl.sol/HealthAccessControl.json";
import RecordRegistryABI from "../../artifacts/contracts/RecordRegistry.sol/RecordRegistry.json";
import AuditLogABI from "../../artifacts/contracts/AuditLog.sol/AuditLog.json";

// Địa chỉ contract — đọc từ env
const ADDRESSES = {
  didRegistry:    process.env.NEXT_PUBLIC_DID_REGISTRY_ADDRESS!,
  accessControl:  process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS!,
  recordRegistry: process.env.NEXT_PUBLIC_RECORD_REGISTRY_ADDRESS!,
  auditLog:       process.env.NEXT_PUBLIC_AUDIT_LOG_ADDRESS!,
};

/**
 * Chuyển wagmi WalletClient sang ethers Signer
 * Cần thiết vì wagmi dùng viem, contract call cần ethers signer
 */
function walletClientToSigner(walletClient: any) {
  const { account, chain, transport } = walletClient;
  const provider = new BrowserProvider(transport, {
    chainId: chain.id,
    name:    chain.name,
  });
  return provider.getSigner(account.address);
}

/**
 * Hook trả về các contract instance đã kết nối với signer của user
 * Chỉ dùng được sau khi user đã connect wallet
 */
export function useContracts() {
  const { data: walletClient } = useWalletClient();

  const contracts = useMemo(() => {
    if (!walletClient) return null;

    const signerPromise = walletClientToSigner(walletClient);

    return {
      async getDIDRegistry() {
        const signer = await signerPromise;
        return new Contract(ADDRESSES.didRegistry, DIDRegistryABI.abi, signer);
      },
      async getAccessControl() {
        const signer = await signerPromise;
        return new Contract(ADDRESSES.accessControl, HealthAccessControlABI.abi, signer);
      },
      async getRecordRegistry() {
        const signer = await signerPromise;
        return new Contract(ADDRESSES.recordRegistry, RecordRegistryABI.abi, signer);
      },
      async getAuditLog() {
        const signer = await signerPromise;
        return new Contract(ADDRESSES.auditLog, AuditLogABI.abi, signer);
      },
    };
  }, [walletClient]);

  return { contracts, isConnected: !!walletClient };
}