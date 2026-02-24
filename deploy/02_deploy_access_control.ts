import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre as any;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("HealthAccessControl", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`HealthAccessControl deployed: ${result.address}`);
};

export default func;
func.tags = ["HealthAccessControl"];