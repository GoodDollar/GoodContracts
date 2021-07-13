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
    schemeAddress,
    daoAddresses
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

  // const implementation = "0x8141208203C298f07dDcd794b14722E69Aa42549";

  const deployedProxy = upgradableAddresses.FuseStaking;
  const upgradeTimeLock = 0;
  const callData = ethers.utils.toUtf8Bytes(""); //ethers.constants.HashZero;
  const impl = await (await ethers.getContractFactory("FuseStakingV3")).deploy();
  await impl.deployed();
  const implementation = impl.address;
  console.log("new impl at:", implementation);

  const factory = await ethers.getContractFactory("UpgradeImplScheme");

  const scheme = await factory.deploy(
    daoAddresses.Avatar,
    implementation,
    deployedProxy,
    upgradableAddresses.ProxyAdmin,
    callData,
    upgradeTimeLock
  );

  // // let scheme = await ethers.getContractAt(
  // //   "UpgradeImplScheme",
  // //   "0x2888268C99d9a0dDab53013C6D3c070d118958ec"
  // // );

  await scheme.deployed();

  const schemeAddress = scheme.address;

  console.log("upgrade scheme:", schemeAddress);
  const proposalId = await proposeUpgradeScheme(daoAddresses, schemeAddress);

  // const proposalId = "0xda9b0bfa71e0ac696698a16513c18a628cee0a01e85b875c59a8a9c26c23301d";
  console.log("voting upgrade...", { proposalId });
  await voteUpgradeScheme(networkName, daoAddresses, proposalId);
  console.log("vote passed, executing upgrade...");
  const res = await scheme.upgrade();
  console.log({ res });
};

main().catch(e => console.log(e));
