import { ethers, upgrades, network } from "hardhat";
import { networkNames } from "@openzeppelin/upgrades-core";
import { getSettings, releaser } from "../../scripts/getMigrationSettings";
import { SchemeRegistrar } from "../types";
import { getFounders } from "./getFounders";

console.log({ networkNames, network: network.name, upgrade: process.env.UPGRADE });
const { name: networkName } = network;
networkNames[1] = networkName;
networkNames[122] = networkName;
networkNames[3] = networkName;

export const proposeUpgradeScheme = async (daoAddresses, schemeAddress) => {
  console.log("proposing conntract upgrade to DAO", {
    schemeAddress
  });

  const schemeRegistrar = (await ethers.getContractAt(
    "SchemeRegistrar",
    daoAddresses.SchemeRegistrar
  )) as SchemeRegistrar;

  const proposaltx = await schemeRegistrar.proposeScheme(
    daoAddresses.Avatar,
    schemeAddress,
    ethers.constants.HashZero,
    "0x00000010",
    ethers.constants.HashZero
  );

  const proposal = await proposaltx.wait();
  const event = proposal.events.find(_ => _.event === "NewSchemeProposal");
  console.log({ proposal: event });
  const proposalId = event.args._proposalId;

  console.log("proposal", {
    scheme: schemeAddress,
    proposalId
  });
  return proposalId;
};

export const voteUpgradeScheme = async (network, daoAddresses, proposalId) => {
  const absoluteVote = await ethers.getContractAt(
    "IntVoteInterface",
    daoAddresses.AbsoluteVote
  );

  const founders = await getFounders(network);
  console.log("voteUpgradeScheme", { absoluteVote: absoluteVote.address, founders });
  await Promise.all(
    founders.slice(0, Math.ceil(founders.length / 2)).map(f =>
      absoluteVote
        .connect(f)
        .vote(proposalId, 1, 0, f.address)
        .then(_ => _.wait())
    )
  );
};

const main = async () => {
  const {
    daoAddresses,
    modelAddresses,
    upgradableAddresses,
    founders
  } = await getSettings(networkName);

  // const implementation = "0x7fca2b3e1047291f65c2c914083d970c027f4290";
  // const deployedProxy = upgradableAddresses.FuseStaking;
  // const upgradeTimeLock = 0;
  // const callData = ethers.utils.toUtf8Bytes(""); //ethers.constants.HashZero;

  const factory = await ethers.getContractFactory("UpgradeImplScheme");

  const scheme = await factory.deploy(
    daoAddresses.Avatar,
    implementation,
    deployedProxy,
    upgradableAddresses.ProxyAdmin,
    callData,
    upgradeTimeLock
  );

  //   const scheme = await ethers.getContractAt(
  //     "UpgradeImplScheme",
  //     "0x2591E81be398ddEDb8a5A68c1420b7B84C0F39d2"
  //   );

  const schemeAddress = scheme.address;

  const proposalId = await proposeUpgradeScheme(daoAddresses, schemeAddress);

  //   const proposalId = "0x67dc1fb651ef33c7943b7a504906b1e45bf0715d35e27a3e562c9d2b49d43586";
  console.log("voting upgrade...", { proposalId });
  await voteUpgradeScheme(networkName, daoAddresses, proposalId);
  console.log("vote passed, executing upgrade...");
  const res = await scheme.upgrade();
  console.log({ res });
};

main().catch(e => console.log(e));
