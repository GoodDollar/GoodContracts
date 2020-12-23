/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import { HardhatUserConfig } from "hardhat/types";
import "hardhat-typechain";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import { sha3 } from "web3-utils";
const mnemonic = process.env.MNEMONIC;
const infura_api = process.env.INFURA_API;
const alchemy_key = process.env.ALCHEMY_KEY;

console.log({ mnemonic: sha3(mnemonic) });
const config: HardhatUserConfig = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  typechain: {
    outDir: "types",
    target: "truffle-v5"
  },
  etherscan: {
    apiKey: "IU57R7ENC6881PG2WN5DRU75DACWYQCXJY"
  },
  networks: {
    ropsten: {
      accounts: { mnemonic },
      url: "https://ropsten.infura.io/v3/" + infura_api,
      gas: 3000000,
      gasPrice: 25000000000,
      chainId: 3
    },
    fuse: {
      accounts: { mnemonic },
      url: "https://rpc.fuse.io/",
      gas: 3000000,
      gasPrice: 2000000000,
      chainId: 122
    },
    "production-mainnet": {
      accounts: { mnemonic },
      url: "https://mainnet.infura.io/v3/" + infura_api,
      gas: 3000000,
      gasPrice: 25000000000,
      chainId: 1
    }
  }
};
export default config;
