import dotenv from "dotenv";
dotenv.config();

import { testPinataConnection } from "../services/ipfs.service";

async function main() {
  console.log("Testing Pinata connection...");
  const ok = await testPinataConnection();
  console.log(ok ? "✓ Connected" : "✗ Failed");
}

main().catch(console.error);
