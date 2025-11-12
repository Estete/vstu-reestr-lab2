import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },


  verify: {
    etherscan: {
      apiKey: "I89IYQ7GUU7NMDN1MIAAK78TWSW3FIKFRH",
    },
  },


  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: ["private key",],
      chainId: 11155111,
      timeout: 200000,
    },
  },
});
