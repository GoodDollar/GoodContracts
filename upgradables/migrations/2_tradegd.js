const fse = require("fs-extra");
const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
// const settings = require("./deploy-settings.json");
const daoAddresses = require("../../releases/deployment.json");
const modelAddresses = require("../../stakingModel/releases/deployment.json");
const TradeGD = artifacts.require("TradeGD.sol");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  if (network === "tdd") return;

  await deployer;

  const homedao = daoAddresses[network];
  const model = modelAddresses[network];

  console.log({ model, network, homedao });

  const trade = await deployProxy(
    TradeGD,
    [homedao.GoodDollar, model.DAI, model.cDAI, model.Reserve],
    {
      deployer
    }
  );
  //   const trade = await upgradeProxy(
  //     "0x7F950cB8B7c0A43243d5A6397b2F09cB45B9A3cb",
  //     TradeGD,
  //     {
  //       deployer
  //     }
  //   );

  let releasedContracts = {
    TradeGD: trade.address
  };

  console.log("2_tradegd: Writing deployment file...\n", { releasedContracts });
  //   await releaser(releasedContracts, network);
};
