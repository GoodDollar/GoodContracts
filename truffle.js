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

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

  networks: {
    'development': { // used for 'truffle console' command for debugging purpose. https://truffleframework.com/tutorials/debugger-variable-inspection
      host: "127.0.0.1",
      port: 9545, // "truffle develop" runs on 9545
      network_id: "6000", // Match any network id
      from: '0x244a9ac7012f1b5e6f74f78e1dc69ef69df1dab6' // should be equal to first address in truffle UI list - address[0]

    },
    test: {
      host: "127.0.0.1",
      port: 9545, // my "ganache " runs on 8545 - configurable
      network_id: "6000", // my "ganache " runs with 6000 network_id - configurable
      from: '0x967c5155b22fd296b66d0f2f48cd7afe854adea8' // should be equal to first address in truffle UI list - address[0]
    },

    'ganache': {
      host: "127.0.0.1",
      port: 8545, // my "ganache " runs on 8545 - configurable
      network_id: "6000", // my "ganache " runs with 6000 network_id - configurable
      from: '0x9b36dEa68d42668Bed85c91b990BD306a18310C6' // should be equal to first address in ganache UI list - address[0]

    },

    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/" + infura_api)
      },
      network_id: 3,
      gas:2071238
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://kovan.infura.io/" + infura_api)
      },
      network_id: 42,
      gas:4700000,
      skipDryRun:true,
      gasPrice:2000000000 //2 gwei
    }
  },
  compilers: {
    solc: {
      version: "0.5.0",  
      settings: {
        optimizer: {
          enabled: true, 
          runs: 200    
        }
      }
    }
  }
};
