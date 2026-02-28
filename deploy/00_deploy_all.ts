import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async () => {
  console.log("Deploying full system locally...");
};

export default func;

func.tags = ["all"];
func.dependencies = [
  "AuditLog",
  "HealthAccessControl",
  "RecordRegistry",
  "DIDRegistry",
];