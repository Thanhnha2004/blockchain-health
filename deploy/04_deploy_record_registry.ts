import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre as any;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { get, execute } = deployments;

  // Lấy địa chỉ các contract đã deploy trước
  const accessControl = await get("HealthAccessControl");
  const auditLog = await get("AuditLog");

  const result = await deploy("RecordRegistry", {
    from: deployer,
    args: [accessControl.address, auditLog.address],
    log: true,
  });

  // Whitelist RecordRegistry trong AuditLog
  await execute(
    "AuditLog",
    { from: deployer, log: true },
    "addAuthorizedContract",
    result.address,
  );

  console.log(`RecordRegistry whitelisted in AuditLog`);
};

export default func;
func.tags = ["RecordRegistry"];
// Đảm bảo deploy sau AuditLog và HealthAccessControl
func.dependencies = ["AuditLog", "HealthAccessControl"];