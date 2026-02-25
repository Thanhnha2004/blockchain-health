import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";

const { POLYGON_PRIVATE_KEY, POLYGONSCAN_API_KEY } = process.env;

const config: HardhatUserConfig = {
  networks: {
    amoy: {
      url: "https://polygon-amoy.drpc.org",
      chainId: 80002,
      accounts: POLYGON_PRIVATE_KEY ? [POLYGON_PRIVATE_KEY] : [],
      timeout: 60000,
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 1000 },
          viaIR: true,
        },
      },
    ],
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },

  namedAccounts: {
    deployer: { default: 0 },
  },

  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY ? POLYGONSCAN_API_KEY : "",
    },
  },

  mocha: {
    timeout: 60000,
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    // outputFile: "gas-report.txt",
    // noColors: true,
  },
};

export default config;
