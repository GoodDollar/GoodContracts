import { ethers, upgrades, network } from "hardhat";
import { networkNames } from "@openzeppelin/upgrades-core";
import { getSettings, releaser } from "../../scripts/getMigrationSettings";

console.log({ networkNames, network: network.name, upgrade: process.env.UPGRADE });
const { name: networkName } = network;
networkNames[1] = networkName;
networkNames[122] = networkName;
networkNames[3] = networkName;

async function main() {
  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    founders
  } = await getSettings(networkName);

  const FStaking = await ethers.getContractFactory("FuseStakingV3");
  const fstaking = await upgrades.deployProxy(FStaking, []);
  const deployed = await fstaking.deployed();
  console.log("FuseStakig deployed to:", fstaking.address);
  releaser({ FuseStaking: fstaking.address }, networkName);
  console.log("setting defaults...", {
    gd: daoAddresses.GoodDollar,
    ubi: modelAddresses.UBIScheme
  });
  await deployed.upgrade1(
    daoAddresses.GoodDollar,
    modelAddresses.UBIScheme,
    "0x0000000000000000000000000000000000000000"
  );
}

async function upgrade() {
  console.log("Upgrading...");
  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    founders
  } = await getSettings(networkName);
  console.log({ daoAddresses, modelAddresses, upgradableAddresses, founders });
  const FStakingV3 = await ethers.getContractFactory("FuseStakingV3");
  const staking = await upgrades.upgradeProxy(
    upgradableAddresses.FuseStaking,
    FStakingV3
  );
  // staking.upgrade1(daoAddresses.GoodDollar, modelAddresses.UBIScheme);
  console.log("Fusestaking upgraded", { staking });
}

if (process.env.UPGRADE === "true") upgrade().catch(e => console.log(e));
else main().catch(e => console.log(e));
