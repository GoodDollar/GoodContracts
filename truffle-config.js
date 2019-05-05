require("@babel/register")({
  ignore: [/node_modules/]
});
require("@babel/polyfill");

// if (process.env.NODE_ENV !== 'production') { // https://codeburst.io/process-env-what-it-is-and-why-when-how-to-use-it-effectively-505d0b2831e7
require('dotenv').load();
// }
const HDWalletProvider = require("truffle-hdwallet-provider");

const mnemonic = process.env.MNEMONIC
const infura_api = process.env.INFURA_API
console.log({ mnemonic, infura_api })
module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

  networks: {
    'develop': { // used for 'truffle console' command for debugging purpose. https://truffleframework.com/tutorials/debugger-variable-inspection
      host: "127.0.0.1",
      port: 9545, // "truffle develop" runs on 9545
      network_id: "4447", // Match any network id
      // from: '0x244a9ac7012f1b5e6f74f78e1dc69ef69df1dab6' // should be equal to first address in truffle UI list - address[0]

    },
    test: {
      host: "127.0.0.1",
      port: 9545, // my "ganache " runs on 8545 - configurable
      network_id: "4447", // my "ganache " runs with 6000 network_id - configurable
      from: '0x244a9ac7012f1b5e6f74f78e1dc69ef69df1dab6' // should be equal to first address in truffle UI list - address[0]
    },
    ganache: {
      host: "127.0.0.1",
      port: 8545, // my "ganache " runs on 8545 - configurable
      network_id: "*", // my "ganache " runs with 6000 network_id - configurable
      // from: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' // should be equal to first address in ganache UI list - address[0]
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/v3/" + infura_api,0,10)
      },
      network_id: 3,
      gas:2071238
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://kovan.infura.io/v3/" + infura_api,0,10)
      },
      network_id: 42,
      gas:4700000,
      skipDryRun:true,
      gasPrice:2000000000 //2 gwei
    },
    fuse: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rpc.fuse.io/",0,10)
      },
      network_id: 121,
      gas:4500000,
      skipDryRun:true,
      gasPrice:1000000000 //1 gwei
    }
  },
  compilers: {
    solc: {
      version: "0.5.2",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
