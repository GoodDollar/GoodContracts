import { ethers, upgrades, network } from "hardhat";
import { networkNames } from "@openzeppelin/upgrades-core";
import { getSettings, releaser } from "../../scripts/getMigrationSettings";

console.log({ networkNames, network: network.name, upgrade: process.env.UPGRADE });
const { name: networkName } = network;
networkNames[1] = networkName;
networkNames[122] = networkName;
networkNames[3] = networkName;

async function deploy() {
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
  console.log("Fusestaking upgraded", { staking: staking.address });
  await staking.upgrade3();
}

async function upgradeByAvatar() {
  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    founders
  } = await getSettings(networkName);
  const FStakingV3 = await ethers.getContractFactory("FuseStakingV3");
  const impl = await FStakingV3.deploy();
  console.log("new impl at:", impl.address);
  const upgradeScheme = await (
    await ethers.getContractFactory("UpgradeImplScheme.sol")
  ).deploy(
    daoAddresses.Avatar,
    impl.address,
    upgradableAddresses.FuseStaking,
    "0x57179b2A8eB019157b0C3E761cdB26c82C982a3B",
    "",
    0
  );
  console.log("scheme at:", upgradeScheme.address);
}
async function main() {
  const { upgradableAddresses } = await getSettings(networkName);
  if (process.env.FORCE === "true" || upgradableAddresses.FuseStaking == null) {
    return deploy();
  } else return upgrade();
}

main().catch(e => console.log(e));
