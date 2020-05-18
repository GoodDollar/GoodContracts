module.exports = {
  client: require("ganache-cli"),
  providerOptions: {
    mnemonic:
      "glad notable bullet donkey fall dolphin simple size stone evil slogan dinner",
    default_balance_ether: 1000000
  },
  skipFiles: [
    "dao/schemes/GoodUBI.sol",
    "dao/schemes/GoodUBI/BancorFormula.sol",
    "dao/schemes/GoodUBI/ExpArray.sol",
    "dao/schemes/GoodUBI/Math.sol",
    "mocks/AvatarMock.sol",
    "mocks/DAIMock.sol",
    "mocks/cDAIMock.sol",
    "DSMath.sol"
  ]
};
