import { ethers } from "ethers";
import RecordRegistryABI from "../../../artifacts/contracts/RecordRegistry.sol/RecordRegistry.json";
import HealthAccessControlABI from "../../../artifacts/contracts/HealthAccessControl.sol/HealthAccessControl.json";
import AuditLogABI from "../../../artifacts/contracts/AuditLog.sol/AuditLog.json";

// ─── Provider & Signer ───────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// ─── Contract instances ──────────────────────────────────────────────────────

export const recordRegistry = new ethers.Contract(
  process.env.RECORD_REGISTRY_ADDRESS!,
  RecordRegistryABI.abi,
  signer,
);

export const accessControl = new ethers.Contract(
  process.env.ACCESS_CONTROL_ADDRESS!,
  HealthAccessControlABI.abi,
  signer,
);

export const auditLog = new ethers.Contract(
  process.env.AUDIT_LOG_ADDRESS!,
  AuditLogABI.abi,
  provider, // read-only
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tạo contract instance với signer của caller — dùng khi cần gọi
 * contract với private key của người dùng (patient/doctor)
 */
export function getSignedContract(
  contractAddress: string,
  abi: any[],
  privateKey: string,
) {
  const callerSigner = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(contractAddress, abi, callerSigner);
}
