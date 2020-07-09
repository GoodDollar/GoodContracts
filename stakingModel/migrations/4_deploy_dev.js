const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const GoodCompoundStaking = artifacts.require("./GoodCompoundStaking.sol");
const GoodDMMStaking = artifacts.require("./GoodDMMStaking.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const mDAIMock = artifacts.require("./mDAIMock.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");
const UBIScheme = artifacts.require("./UBIScheme.sol");

module.exports = async function(deployer, network) {
  if (
    network.indexOf("tdd") >= 0 ||
    network.indexOf("production") >= 0 ||
    network.indexOf("test") >= 0
  ) {
    return;
  }
  await deployer;
  const networkSettings = { ...settings["default"], ...settings[network] };
  const accounts = await web3.eth.getAccounts();
  const staking_file = await fse.readFile("releases/deployment.json", "utf8");
  const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);
  const dao_deployment = await JSON.parse(dao_file);

  // not mainnet, including develop
  if (network.indexOf("mainnet") < 0) {
    let dao_sidechain_addresses = dao_deployment[network];
    let staking_sidechain_addresses = staking_deployment[network];
    const goodDollar = await GoodDollar.at(dao_sidechain_addresses.GoodDollar);
    const ubi = await UBIScheme.at(staking_sidechain_addresses.UBIScheme);

    await goodDollar.mint(accounts[0], "10000000");
    await goodDollar.transfer(ubi.address, "5000000");
  }

  if (network.indexOf("mainnet") >= 0 || network === "develop") {
    let staking_mainnet_addresses = staking_deployment[network];
    const dai = await DAIMock.at(staking_mainnet_addresses.DAI);
    const cDAI = await cDAIMock.at(staking_mainnet_addresses.cDAI);
    const mDAI = await mDAIMock.at(staking_mainnet_addresses.mDAI);
    const simpleStaking = await GoodCompoundStaking.at(staking_mainnet_addresses.DAICompoundStaking);
    const simpleStakingDMM = await GoodDMMStaking.at(staking_mainnet_addresses.DAIDMMStaking);
    const goodReserve = await Reserve.at(staking_mainnet_addresses.Reserve);

    console.log("minting dai");
    await dai.allocateTo(accounts[0], web3.utils.toWei("200", "ether"));

    const approveStaking = dai.approve(
      simpleStaking.address,
      web3.utils.toWei("80", "ether")
    );
    const approveMinting = dai.approve(cDAI.address, web3.utils.toWei("20", "ether"));

    const approveStakingDMM = dai.approve(
      simpleStakingDMM.address,
      web3.utils.toWei("80", "ether")
    );
    const approveMintingDMM = dai.approve(mDAI.address, web3.utils.toWei("20", "ether"));

    console.log("approving...");
    await Promise.all([approveStaking, approveMinting]);
    await Promise.all([approveStakingDMM, approveMintingDMM]);

    let ownercDaiBalanceBefore = await cDAI.balanceOf(accounts[0]);
    let ownermDaiBalanceBefore = await mDAI.balanceOf(accounts[0]);

    const staking = simpleStaking.stake(web3.utils.toWei("80", "ether"));
    const minting = cDAI.mint(web3.utils.toWei("20", "ether"));

    const stakingDMM = simpleStakingDMM.stake(web3.utils.toWei("80", "ether"));
    const mintingDMM = mDAI.mint(web3.utils.toWei("20", "ether"));

    console.log("staking and minting...");
    await Promise.all([staking, minting]);
    await Promise.all([stakingDMM, mintingDMM]);

    let ownercDaiBalanceAfter = await cDAI.balanceOf(accounts[0]);
    let ownermDaiBalanceAfter = await mDAI.balanceOf(accounts[0]);

    let totalMinted = ownercDaiBalanceAfter.sub(ownercDaiBalanceBefore);
    let totalMintedDMM = ownermDaiBalanceAfter.sub(ownermDaiBalanceBefore);

    const preloadStaking = cDAI.transfer(
      simpleStaking.address,
      Math.floor(totalMinted.toNumber() / 2).toString()
    );

    const preloadStakingDMM = mDAI.transfer(
      simpleStakingDMM.address,
      Math.floor(totalMintedDMM.toNumber() / 2).toString()
    );

    const approveCdai = cDAI.approve(
      goodReserve.address,
      Math.floor(totalMinted.toNumber() / 2).toString()
    );

    const approveMdai = mDAI.approve(
      goodReserve.address,
      Math.floor(totalMintedDMM.toNumber() / 2).toString()
    );

    console.log(
      "preload staking contract and increase the cdai allowance to preload the reserve contract..."
    );
    await Promise.all([preloadStaking, approveCdai]);
    await Promise.all([preloadStakingDMM, approveMdai]);

    console.log("preload reserve with CDAI");
    await goodReserve.buy(
      cDAI.address,
      Math.floor(totalMinted.toNumber() / 2).toString(),
      0
    );

    // await goodReserve.buy(
    //   mDAI.address,
    //   Math.floor(totalMintedDMM.toNumber() / 2).toString(),
    //   0
    // );
  }
};
