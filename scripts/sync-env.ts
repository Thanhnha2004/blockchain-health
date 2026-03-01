import fs from "fs";
import path from "path";

const deploymentsDir = path.join(__dirname, "../deployments/localhost");
const backendEnv     = path.join(__dirname, "../backend/.env");
const frontendEnv    = path.join(__dirname, "../frontend/.env.local");

function getAddress(contractName: string): string {
  const file = path.join(deploymentsDir, `${contractName}.json`);
  const json  = JSON.parse(fs.readFileSync(file, "utf-8"));
  return json.address;
}

function updateEnvFile(envPath: string, updates: Record<string, string>) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line  = `${key}=${value}`;

    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, content.trim() + "\n");
  console.log(`✓ Updated ${envPath}`);
}

const addresses = {
  didRegistry:    getAddress("DIDRegistry"),
  accessControl:  getAddress("HealthAccessControl"),
  auditLog:       getAddress("AuditLog"),
  recordRegistry: getAddress("RecordRegistry"),
};

console.log("Addresses:", addresses);

// Cập nhật backend .env
updateEnvFile(backendEnv, {
  DID_REGISTRY_ADDRESS:    addresses.didRegistry,
  ACCESS_CONTROL_ADDRESS:  addresses.accessControl,
  AUDIT_LOG_ADDRESS:       addresses.auditLog,
  RECORD_REGISTRY_ADDRESS: addresses.recordRegistry,
});

// Cập nhật frontend .env.local
updateEnvFile(frontendEnv, {
  NEXT_PUBLIC_DID_REGISTRY_ADDRESS:    addresses.didRegistry,
  NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS:  addresses.accessControl,
  NEXT_PUBLIC_AUDIT_LOG_ADDRESS:       addresses.auditLog,
  NEXT_PUBLIC_RECORD_REGISTRY_ADDRESS: addresses.recordRegistry,
});

console.log("✓ All env files updated");