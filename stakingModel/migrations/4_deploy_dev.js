const fse = require("fs-extra");
const settings = require("./deploy-settings.json");
const StakingContract = artifacts.require("./SimpleDAIStaking.sol");
const Reserve = artifacts.require("./GoodReserveCDai.sol");
const DAIMock = artifacts.require("./DAIMock.sol");
const cDAIMock = artifacts.require("./cDAIMock.sol");
const DaiFaucet = artifacts.require("./RopstenDaiFaucetMock.sol");
const AddMinter = artifacts.require("./AddMinter.sol");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const GoodDollar = artifacts.require("./GoodDollar.sol");

const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const DAI_FAUCET_ADDRESS = process.env.DAI_FAUCET_ADDRESS;

module.exports = async function(deployer, network) {
  if (network.indexOf("fuse") < 0 && network.indexOf("staging") < 0) {
    return;
  }  
  await deployer;
  const accounts = await web3.eth.getAccounts();
  const staking_file = await fse.readFile("releases/deployment.json", "utf8");
  const dao_file = await fse.readFile("../releases/deployment.json", "utf8");
  const staking_deployment = await JSON.parse(staking_file);
  const dao_deployment = await JSON.parse(dao_file);
  const staing_mainnet_addresses = staking_deployment["fuse-mainnet"];
  const dao_sidechain_addresses = dao_deployment["fuse"];

  if (network.indexOf("mainnet") < 0) {
    const registrar = await SchemeRegistrar.at(dao_sidechain_addresses.SchemeRegistrar);
    const absoluteVote = await AbsoluteVote.at(dao_sidechain_addresses.AbsoluteVote);
    const goodDollar = await GoodDollar.at(dao_sidechain_addresses.GoodDollar);

    const addMinterSelf = await deployer.deploy(AddMinter, dao_sidechain_addresses.Avatar, accounts[0]);
    
    const p = await registrar.proposeScheme(
      dao_sidechain_addresses.Avatar,
      addMinterSelf.address,
      NULL_HASH,
      "0x00000010",
      NULL_HASH
    )

    let proposalId = p.logs[0].args._proposalId;

    await absoluteVote.vote(proposalId, 1, 0, accounts[0])

    await addMinterSelf.addMinter();

    await goodDollar.mint(accounts[0], "10000000");
  }
  else {
    const faucet = await DaiFaucet.at(DAI_FAUCET_ADDRESS);
    const dai = await DAIMock.at(staing_mainnet_addresses.DAI);
    const cDAI = await cDAIMock.at(staing_mainnet_addresses.cDAI);
    const simpleStaking = await StakingContract.at(staing_mainnet_addresses.DAIStaking);
    const goodReserve = await Reserve.at(staing_mainnet_addresses.Reserve);

    console.log("get dai from faucet");
    await faucet.allocateTo(accounts[0], web3.utils.toWei("100", "ether"));

    const approveStaking = dai.approve(simpleStaking.address, web3.utils.toWei("80", "ether"));
    const approveMinting = dai.approve(cDAI.address, web3.utils.toWei("20", "ether"));
    
    console.log("approving...");
    await Promise.all([approveStaking, approveMinting]);

    let ownercDaiBalanceBefore = await cDAI.balanceOf(accounts[0]);

    const staking = simpleStaking.stakeDAI(web3.utils.toWei("80", "ether"));
    const minting = cDAI.mint(web3.utils.toWei("20", "ether"));

    let ownercDaiBalanceAfter = await cDAI.balanceOf(accounts[0]);
    
    console.log("staking and minting...");
    await Promise.all([staking, minting]);

    let totalMinted = ownercDaiBalanceAfter.sub(ownercDaiBalanceBefore);

    const preloadStaking = cDAI.transfer(
      simpleStaking.address, 
      (floor(totalMinted.div(2))).toString());

    const approveCdai = cDAI.approve(
      goodReserve.address,
      (floor(totalMinted.div(2))).toString());
    
    console.log("preload staking contract and increase the cdai allowance to preload the reserve contract...");
    await Promise.all([preloadStaking, approveCdai]);
    
    console.log("preload reserve with CDAI");
    await goodReserve.buy(cDAI.address, totalMinted.toString(), 0);
  }
};
