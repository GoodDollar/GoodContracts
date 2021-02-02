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
const SafeHDWalletProvider = require("truffle-safe-hdwallet-provider");
const HttpProvider = require("web3-providers-http");
const mnemonic = process.env.MNEMONIC;
const privateKey = process.env.PRIVATE_KEY;

const infura_api = process.env.INFURA_API;
const alchemy_key = process.env.ALCHEMY_KEY;

const admin_mnemonic = process.env.ADMIN_MNEMONIC;
const admin_password = process.env.ADMIN_PASSWORD;
const FUSE_RPC = "https://rpc.fuse.io/";
const ropsten_settings = {
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
};

console.log({ mnemonic, admin_mnemonic, privateKey, infura_api, alchemy_key });

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

  networks: {
    develop: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://localhost:9545/", 0, 10);
      },
      // used for 'truffle console' command for debugging purpose. https://truffleframework.com/tutorials/debugger-variable-inspection
      host: "127.0.0.1",
      port: 9545, // "truffle develop" runs on 9545
      network_id: "4447", // Match any network id,
      gas: 9000000,
      gasPrice: 1000000000 //1 gwei
      // from: '0x8ae536FAcb8C89163A0c5A5817Aaa75F65F1bcA6' // should be equal to first address in truffle UI list - address[0]
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
      gas: 9000000,
      gasPrice: 1000000000 //1 gwei
    },
    tdd: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*",
      gas: 9000000,
      gasPrice: 1000000000 //1 gwei
    },
    coverage: {
      host: "127.0.0.1",
      network_id: "*", // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    ropsten: ropsten_settings,
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
    "fuse-mainnet": ropsten_settings,
    "staging-mainnet": ropsten_settings,
    "production-mainnet": {
      provider: () =>
        new HDWalletProvider(
          admin_mnemonic,
          // "https://eth-mainnet.alchemyapi.io/v2/" + alchemy_key,
          // "wss://mainnet.infura.io/ws",
          "https://mainnet.infura.io/v3/" + infura_api,
          0,
          10
        ),
      gas: 2000000,
      timeoutBlocks: 400,
      gasPrice: 51000000000,
      network_id: 1,
      skipDryRun: true,
      networkCheckTimeout: 10000
    },
    "production-admin": {
      provider: () =>
        new SafeHDWalletProvider(admin_mnemonic, FUSE_RPC, 0, 10, admin_password),
      gas: 3000000,
      timeoutBlocks: 400,
      gasPrice: 51000000000,
      network_id: 122,
      skipDryRun: true,
      networkCheckTimeout: 5000
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
      gas: 8500000,
      skipDryRun: true,
      gasPrice: 1000000000 //1 gwei
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
  // test_file_extension_regexp: /.*\.test\.(ts|.js)$/
};
