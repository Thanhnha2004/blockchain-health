import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import RecordRegistryABI from "../../../artifacts/contracts/RecordRegistry.sol/RecordRegistry.json";
import HealthAccessControlABI from "../../../artifacts/contracts/HealthAccessControl.sol/HealthAccessControl.json";
import AuditLogABI from "../../../artifacts/contracts/AuditLog.sol/AuditLog.json";

const getProvider = () => new ethers.JsonRpcProvider(process.env.RPC_URL);
const getSigner = () =>
  new ethers.Wallet(process.env.PRIVATE_KEY!, getProvider());

export const getRecordRegistry = () =>
  new ethers.Contract(
    process.env.RECORD_REGISTRY_ADDRESS!,
    RecordRegistryABI.abi,
    getSigner(),
  );

export const getAccessControl = () =>
  new ethers.Contract(
    process.env.ACCESS_CONTROL_ADDRESS!,
    HealthAccessControlABI.abi,
    getSigner(),
  );

export const getAuditLog = () =>
  new ethers.Contract(
    process.env.AUDIT_LOG_ADDRESS!,
    AuditLogABI.abi,
    getProvider(),
  );
