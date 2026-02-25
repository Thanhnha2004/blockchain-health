import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy toàn bộ hệ thống theo đúng thứ tự:
 * AuditLog → HealthAccessControl → RecordRegistry → DIDRegistry
 *
 * Sau deploy tự động:
 * - Whitelist RecordRegistry trong AuditLog
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre as any;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { get, execute } = deployments;

  console.log("\n── Deploying all contracts ──────────────────────────");
  console.log(`Deployer: ${deployer}`);

  // 1. AuditLog — không phụ thuộc gì
  const auditLog = await deploy("AuditLog", {
    from: deployer,
    args: [],
    log: true,
  });

  // 2. HealthAccessControl — không phụ thuộc gì
  const accessControl = await deploy("HealthAccessControl", {
    from: deployer,
    args: [],
    log: true,
  });

  // 3. RecordRegistry — cần địa chỉ 2 contract trên
  const recordRegistry = await deploy("RecordRegistry", {
    from: deployer,
    args: [accessControl.address, auditLog.address],
    log: true,
  });

  // 4. DIDRegistry — độc lập
  const didRegistry = await deploy("DIDRegistry", {
    from: deployer,
    args: [],
    log: true,
  });

  // 5. Whitelist RecordRegistry trong AuditLog
  console.log("\n── Post-deploy setup ────────────────────────────────");
  await execute(
    "AuditLog",
    { from: deployer, log: true },
    "addAuthorizedContract",
    recordRegistry.address,
  );
  console.log(`✓ RecordRegistry whitelisted in AuditLog`);

  // Summary
  console.log("\n── Deployed addresses ───────────────────────────────");
  console.log(`DIDRegistry:         ${didRegistry.address}`);
  console.log(`HealthAccessControl: ${accessControl.address}`);
  console.log(`AuditLog:            ${auditLog.address}`);
  console.log(`RecordRegistry:      ${recordRegistry.address}`);
  console.log("─────────────────────────────────────────────────────\n");
};

export default func;
func.tags = ["all"];
func.dependencies = [
  "DIDRegistry",
  "AuditLog",
  "HealthAccessControl",
  "RecordRegistry",
];
