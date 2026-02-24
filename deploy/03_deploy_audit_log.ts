import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre as any;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("AuditLog", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`AuditLog deployed: ${result.address}`);
};

export default func;
func.tags = ["AuditLog"];