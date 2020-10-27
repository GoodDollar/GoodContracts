const fse = require("fs-extra");
const settings = require("../migrations/deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const GoodFundsManager = artifacts.require("./GoodFundManager.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");
const UBIScheme = artifacts.require("./UBIScheme.sol");
const Identity = artifacts.require("./Identity.sol");

const nextDay = async () =>
  web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [60 * 60 * 24],
      id: new Date().getTime()
    },
    () => {}
  );

/**
 * helper script to simulate enough days of interest transfer and claiming
 * so we can test fishing of inactive user accounts
 */
const simulate = async function() {
  const network = process.env.NETWORK || "develop";
  const networkSettings = { ...settings["default"], ...settings[network] };
  const accounts = await web3.eth.getAccounts();
  const staking_file = await fse.readFile("releases/deployment.json", "utf8");
  const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);
  const dao_deployment = await JSON.parse(dao_file);

  let staking_mainnet_addresses = staking_deployment[network];
  let dao_addresses = dao_deployment[network];
  const identity = await Identity.at(dao_addresses.Identity);
  await Promise.all(accounts.slice(1).map(a => identity.addWhitelisted(a))).catch(e => e);
  const dai = await DAIMock.at(staking_mainnet_addresses.DAI);
  const cDAI = await cDAIMock.at(staking_mainnet_addresses.cDAI);
  const simpleStaking = await StakingContract.at(staking_mainnet_addresses.DAIStaking);
  const goodReserve = await Reserve.at(staking_mainnet_addresses.Reserve);
  const goodFundManager = await GoodFundsManager.at(
    staking_mainnet_addresses.FundManager
  );

  const ubi = await UBIScheme.at(staking_mainnet_addresses.UBIScheme);

  console.log(await web3.eth.getTransactionCount(accounts[0]));
  for (let day = 0; day < 16; day++) {
    console.log("minting dai and approving day:", { day });
    await dai.allocateTo(accounts[0], web3.utils.toWei("100", "ether"));
    await dai.approve(cDAI.address, web3.utils.toWei("100", "ether"));
    await cDAI.mint(web3.utils.toWei("100", "ether"));
    let ownercDaiBalanceAfter = await cDAI.balanceOf(accounts[0]).then(_ => _.toString());

    await cDAI.transfer(simpleStaking.address, ownercDaiBalanceAfter);
    let stakingBalance = await cDAI
      .balanceOf(simpleStaking.address)
      .then(_ => _.toString());

    let ps = [];
    for (let i = 0; i < networkSettings.blockInterval; ++i)
      ps.push(
        web3.currentProvider.send(
          { jsonrpc: "2.0", method: "evm_mine", id: 123 },
          () => {}
        )
      );

    await Promise.all(ps);
    console.log("collecting interest...");

    await goodFundManager.transferInterest(simpleStaking.address);

    console.log("claiming");
    const slice = accounts.length - 1 > day ? day : accounts.length - 1;
    //forward to next claim day and claim, every day claim with one less account
    await Promise.all(accounts.slice(slice).map(a => ubi.claim({ from: a }))).catch(e =>
      console.log("claiming failed", e)
    );
    await nextDay().catch(e => console.log("nextday failed", e));
  }
};
module.exports = done => {
  simulate()
    .catch(console.log)
    .then(done);
};
