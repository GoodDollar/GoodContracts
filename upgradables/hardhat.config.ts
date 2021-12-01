/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "hardhat-gas-reporter";
import { task, types } from "hardhat/config";
import { sha3 } from "web3-utils";
import dotenv from "dotenv";
dotenv.config();

const mnemonic = process.env.MNEMONIC;
const infura_api = process.env.INFURA_API;
const alchemy_key = process.env.ALCHEMY_KEY;
const etherscan_key = process.env.ETHERSCAN_KEY;
const ethplorer_key = process.env.ETHPLORER_KEY;

console.log({ mnemonic: sha3(mnemonic) });
const config: HardhatUserConfig = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "types",
  },
  etherscan: {
    apiKey: etherscan_key,
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
    },
    ropsten: {
      accounts: { mnemonic },
      url: "https://ropsten.infura.io/v3/" + infura_api,
      gas: 3000000,
      gasPrice: 25000000000,
      chainId: 3,
    },
    fuse: {
      accounts: { mnemonic },
      url: "https://rpc.fuse.io/",
      gas: 3000000,
      gasPrice: 1000000000,
      chainId: 122,
    },
    staging: {
      accounts: { mnemonic },
      url: "https://rpc.fuse.io/",
      gas: 3000000,
      gasPrice: 1000000000,
      chainId: 122,
    },
    production: {
      accounts: { mnemonic },
      url: "https://rpc.fuse.io/",
      gas: 3000000,
      gasPrice: 1000000000,
      chainId: 122,
    },
    "production-mainnet": {
      accounts: { mnemonic },
      url: "https://mainnet.infura.io/v3/" + infura_api,
      gas: 3000000,
      gasPrice: 25000000000,
      chainId: 1,
    },
  },
  mocha: {
    timeout: 60000,
  },
};

export default config;
