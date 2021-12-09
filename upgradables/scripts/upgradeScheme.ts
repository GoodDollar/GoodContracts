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
    daoAddresses,
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
    ethers.constants.HashZero,
    {
      maxPriorityFeePerGas: 1000000000,
      maxFeePerGas: 75000000000,
      gasLimit: 2000000,
    }
  );

  const proposal = await proposaltx.wait();
  const event = proposal.events.find((_) => _.event === "NewSchemeProposal");
  console.log({ proposal: event });
  const proposalId = event.args._proposalId;

  console.log("proposal", {
    scheme: schemeAddress,
    proposalId,
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
    founders.slice(1).map((f) =>
      absoluteVote
        .connect(f)
        .vote(proposalId, 1, 0, f.address, {
          maxPriorityFeePerGas: 1000000000,
          maxFeePerGas: 75000000000,
          gasLimit: 300000,
        })
        .then((_) => _.wait())
    )
  );
};

const main = async () => {
  const {
    daoAddresses: fuseAddresses,
    mainDaoAddresses: mainnetAddresses,
    modelAddresses,
    upgradableAddresses,
    founders,
  } = await getSettings(networkName);

  const daoAddresses = networkName.includes("mainnet") ? mainnetAddresses : fuseAddresses;

  console.log({ daoAddresses, networkName });
  // const implementation = "0x8141208203C298f07dDcd794b14722E69Aa42549";

  // const deployedProxy = upgradableAddresses.FuseStaking;
  // const upgradeTimeLock = 0;
  // const callData = ethers.utils.toUtf8Bytes(""); //ethers.constants.HashZero;
  // const impl = await (await ethers.getContractFactory("FuseStakingV3")).deploy();
  // await impl.deployed();
  // const implementation = impl.address;
  // console.log("new impl at:", implementation);

  // const factory = await ethers.getContractFactory("UpgradeImplScheme");
  // const scheme = await factory.deploy(
  //   daoAddresses.Avatar,
  //   implementation,
  //   deployedProxy,
  //   upgradableAddresses.ProxyAdmin,
  //   callData,
  //   upgradeTimeLock
  // );

  const avatar = daoAddresses.Avatar;
  const factory = await ethers.getContractFactory("UpgradeImplSchemeV2");
  const impls = ["0x9B09A006a9d9455992Ed1bB70D293eBa20071a74"];
  const proxies = ["0xd356358f2da1018a3733a304E9bb39CF7ED51059"];
  const fixGuardianEncodedFuse =
    "0x7d36b66e000000000000000000000000914da3b2508634998d244059dab5488d9ba1814f";
  const fixGuardianEncodedEth =
    "0x7d36b66e000000000000000000000000f0652a820dd39ec956659e0018da022132f2f40a";
  // (
  //   await ethers.getContractFactory("CompoundVotingMachine")
  // ).interface.encodeFunctionData("fixGuardian", [
  //   "0x914dA3B2508634998d244059dAb5488D9bA1814f", //fuse multisig
  //   //"0xF0652a820dd39EC956659E0018Da022132f2f40a" //ethereum multisig
  // ]);
  // const calldatas = [fixGuardianEncodedEth];
  // const scheme = await factory.deploy(avatar, impls, proxies, calldatas, {
  //   maxPriorityFeePerGas: 1000000000,
  //   maxFeePerGas: 75000000000,
  //   gasLimit: 2000000,
  // });

  let scheme = await ethers.getContractAt(
    "UpgradeImplSchemeV2",
    "0x4A323De87f92c2e24c020551D1E3B24f3AEc744d"
  );

  await scheme.deployed();

  const schemeAddress = scheme.address;

  console.log("upgrade scheme:", schemeAddress);
  // const proposalId = await proposeUpgradeScheme(daoAddresses, schemeAddress);

  const proposalId = "0xc1fe81e11fa85a5e7e2cc493951350759fb3c9325f8998e2a5bc8329b8c751a9";
  console.log("voting upgrade...", { proposalId });
  await voteUpgradeScheme(networkName, daoAddresses, proposalId);
  console.log("vote passed, executing upgrade...");
  const res = await scheme.upgrade();
  console.log({ res });
};

main().catch((e) => console.log(e));
