import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, ethers } = hre as any;
  const { deploy, get, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const didRegistry = await get("DIDRegistry");
  const accessControl = await get("HealthAccessControl");
  const auditLog = await get("AuditLog");

  const result = await deploy("RecordRegistry", {
    from: deployer,
    args: [accessControl.address, auditLog.address, didRegistry.address],
    log: true,
  });

  console.log(`RecordRegistry deployed: ${result.address}`);

  const isAuthorized = await (
    await ethers.getContractAt("AuditLog", auditLog.address)
  ).authorizedContracts(result.address);

  if (!isAuthorized) {
    await execute(
      "AuditLog",
      { from: deployer, log: true },
      "addAuthorizedContract",
      result.address,
    );
    console.log(`RecordRegistry whitelisted in AuditLog`);
  } else {
    console.log(`RecordRegistry already whitelisted, skipping`);
  }
};

export default func;
func.tags = ["RecordRegistry"];
func.dependencies = ["DIDRegistry", "AuditLog", "HealthAccessControl"];
