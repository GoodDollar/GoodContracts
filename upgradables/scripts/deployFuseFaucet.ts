import { ethers, upgrades, network } from "hardhat";
import { networkNames } from "@openzeppelin/upgrades-core";
import { getSettings, releaser } from "../../scripts/getMigrationSettings";
import { fetchOrDeployProxyFactory } from "./fetchOrDeployProxyFactory";

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

  const FuseFaucet = await ethers.getContractFactory("FuseFaucet");
  const ProxyFactory = await fetchOrDeployProxyFactory();
  let faucet = await upgrades.deployProxy(FuseFaucet, [daoAddresses.Identity], {
    proxyFactory: ProxyFactory
  });

  console.log("FuseFaucet deployed to:", faucet.address);
  releaser({ FuseFaucet: faucet.address }, networkName);
  console.log("Dont forget to top faucet!");
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
  const FuseFaucet = await ethers.getContractFactory("FuseFaucet");
  const faucet = await upgrades.upgradeProxy(upgradableAddresses.FuseStaking, FuseFaucet);
  console.log("FuseFaucet upgraded", { faucet });
}

if (process.env.UPGRADE === "true") upgrade().catch(e => console.log(e));
else main().catch(e => console.log(e));
