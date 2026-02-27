import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Medical DApp",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "dev",
  chains: [hardhat, sepolia],
  ssr: true,
});