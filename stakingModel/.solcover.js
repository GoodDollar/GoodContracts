const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function serverReadyHandler(config) {
  // console.log({ config }, config.network);
  console.log(".solcover.js Deploying main project contracts npm run start:main....");
  const { stdout, stderr } = await exec(
    `export NETWORK="${config.network}";npm run start:main`
  );
  console.log({ stderr });
}
module.exports = {
  client: require("ganache-cli"),
  providerOptions: {
    mnemonic:
      "glad notable bullet donkey fall dolphin simple size stone evil slogan dinner",
    default_balance_ether: 1000000
  },
  onServerReady: serverReadyHandler,
  skipFiles: [
    "mocks/BridgeMock.sol",
    "mocks/FirstClaimMock.sol",
    "mocks/IdentityMock.sol",
    "mocks/TransferAndCallMock.sol",
    "mocks/ControllerMock.sol",
    "mocks/FirstClaimPoolMock.sol",
    "mocks/UBISchemeMock.sol",
    "mocks/StakingMock.sol",
    "mocks/cDAILowWorthMock.sol",
    "mocks/cDAINonMintableMock.sol",
    "BancorFormula.sol",
    "Imports.sol",
    "dao/schemes/EndContract.sol",
    "dao/schemes/FundManagerSetReserve.sol",
    "dao/schemes/SetBlockInterval.sol",
    "dao/schemes/SetContributionAddress.sol",
    "dao/schemes/SetMarketMaker.sol"
  ],
  mocha: {
    enableTimeouts: false,
    timeout: 3600000
  }
};
