require("@babel/register")({
  ignore: [/node_modules/]
});
require("@babel/polyfill");
require("ts-node/register");

// if (process.env.NODE_ENV !== 'production') { // https://codeburst.io/process-env-what-it-is-and-why-when-how-to-use-it-effectively-505d0b2831e7
require("dotenv").load();
// }

const PrivateKeyProvider = require("truffle-hdwallet-provider-privkey");
const HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonic = process.env.MNEMONIC;
const admin_password = process.env.ADMIN_PASSWORD;
const privateKey = process.env.PRIVATE_KEY;

const infura_api = process.env.INFURA_API;
const alchemy_key = process.env.ALCHEMY_KEY;
const celoscan_key = process.env.CELOSCAN_KEY;
const admin_mnemonic = process.env.ADMIN_MNEMONIC;

const FUSE_RPC = "https://rpc.fuse.io";

console.log({ mnemonic, admin_mnemonic, privateKey, infura_api, alchemy_key });

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

  networks: {
    develop: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://localhost:9545/", 0, 10);
      },
      host: "127.0.0.1",
      port: 9545,
      network_id: "4447",
      gas: 8000000
    },
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "4447", // my "ganache " runs with 6000 network_id - configurable
      gas: 8000000,
      from: "0x9689dc4d84b36efa1f02260a90063ae91ef0cbd8"
    },
    test: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*",
      gas: 8000000
    },
    coverage: {
      host: "127.0.0.1",
      network_id: "*", // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          "https://mainnet.infura.io/v3/" + infura_api,
          0,
          10
        );
      },
      network_id: 1,
      skipDryRun: true,
      gas: 8000000,
      gasPrice: 10000000000
    },
    "fuse-mainnet": {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          "https://ropsten.infura.io/v3/" + infura_api,
          0,
          10
        );
      },
      gas: 6000000,
      timeoutBlocks: 4000,
      gasPrice: 2000000000,
      network_id: 3,
      skipDryRun: true
    },
    "staging-mainnet": {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          "https://eth-ropsten.alchemyapi.io/v2/" + alchemy_key,
          // "https://ropsten.infura.io/v3/" + infura_api,
          0,
          10
        );
      },
      gas: 3000000,
      timeoutBlocks: 4000,
      gasPrice: 25000000000,
      network_id: 3,
      skipDryRun: true
    },
    "production-mainnet": {
      provider: () =>
        new HDWalletProvider(
          admin_mnemonic,
          "https://eth-mainnet.alchemyapi.io/v2/" + alchemy_key,
          // 'https://mainnet.infura.io/v3/' + infura_api,
          0,
          10
        ),
      network_id: 1,
      gas: 3000000,
      timeoutBlocks: 500,
      skipDryRun: true,
      gasPrice: 50000000000 //25gwei,
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          "https://kovan.infura.io/v3/" + infura_api,
          0,
          10
        );
      },
      network_id: 42,
      gas: 8000000,
      skipDryRun: true,
      gasPrice: 2000000000 //2 gwei
    },
    fuse: {
      provider: function() {
        return new HDWalletProvider(mnemonic, FUSE_RPC, 0, 10);
      },
      network_id: 122,
      gas: 8500000,
      skipDryRun: true,
      gasPrice: 2000000000 //1 gwei
    },
    staging: {
      provider: function() {
        return new HDWalletProvider(mnemonic, FUSE_RPC, 0, 10);
      },
      network_id: 122,
      gas: 8500000,
      skipDryRun: true,
      gasPrice: 2000000000 //1 gwei
    },
    etoro: {
      provider: function() {
        return new PrivateKeyProvider([privateKey], FUSE_RPC);
      },
      network_id: 122,
      gas: 8500000,
      skipDryRun: true,
      gasPrice: 2000000000 //1 gwei
    },
    production: {
      provider: () => new HDWalletProvider(admin_mnemonic, FUSE_RPC, 0, 10),
      network_id: 122,
      gas: 3000000,
      skipDryRun: true,
      gasPrice: 1000000000 //1 gwei
    },
    celo: {
      network_id: 42220,
      verify: {
        apiUrl: "https://api.celoscan.io/api",
        apiKey: celoscan_key,
        explorerUrl: "https://celoscan.io/address"
      }
    }
  },
  plugins: ["solidity-coverage", "truffle-plugin-verify"],
  mocha: {
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD"
    }
  },
  api_keys: {
    etherscan: "IU57R7ENC6881PG2WN5DRU75DACWYQCXJY"
  },
  verify: {
    preamble: "Support UBI! https://github.com/GoodDollar/GoodContracts"
  },
  compilers: {
    solc: {
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
