module.exports = {
  providerOptions: {
    mnemonic:
      "glad notable bullet donkey fall dolphin simple size stone evil slogan dinner",
    default_balance_ether: 1000000
  },
  skipFiles: [
    "UpgradeImplScheme.sol",
    "staking/FuseStaking.sol",
    "staking/FuseStakingV2.sol",
    "utils/DSMath.sol"
  ],
  mocha: {
    grep: /gas/,
    invert: true,
    enableTimeouts: false,
    timeout: 3600000
  }
};
