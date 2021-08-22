/**
 * 1. deploy votingmachine  +  reputation
 * 2. give reputation ownership to controllerCreator
 * 3. register votingmachine as scheme with all permissions
 *  - test permissions + voting
 * 4. remove permissions from old absolute voting machine via new voting machine
 */

import { ethers, upgrades, network } from "hardhat";
import { networkNames } from "@openzeppelin/upgrades-core";
import { getSettings, releaser } from "../../../scripts/getMigrationSettings";
import { GReputation, SchemeRegistrar, CompoundVotingMachine } from "../../types";
import { getFounders } from "../getFounders";
import { fetchOrDeployProxyFactory } from "../fetchOrDeployProxyFactory";

console.log({ networkNames, network: network.name, upgrade: process.env.UPGRADE });
const { name: networkName } = network;
networkNames[1] = networkName;
networkNames[122] = networkName;
networkNames[3] = networkName;

const main = async () => {
  const {
    daoAddresses,
    mainDaoAddresses,
    modelAddresses,
    upgradableAddresses,
    upgradableSettings
  } = await getSettings(networkName);

  let [root] = await ethers.getSigners();
  const dao = networkName.includes("mainnet") ? mainDaoAddresses : daoAddresses;
  let avatar = dao.Avatar;
  let controller = dao.Controller;
  let repStateId = networkName.includes("mainnet") ? "fuse" : "rootState";
  let oldVotingMachine = dao.SchemeRegistrar;

  let grep: GReputation, vm: CompoundVotingMachine;
  const founders = await getFounders(networkName);

  const deployContracts = async () => {
    if (upgradableAddresses.GReputation) {
      console.log(
        "GReputation already deployed at:",
        upgradableAddresses.GReputation,
        "upgrading:",
        !!process.env.UPGRADE
      );
      if (process.env.UPGRADE) {
        grep = (await upgrades.upgradeProxy(
          upgradableAddresses.GReputation,
          await ethers.getContractFactory("GReputation"),
          {
            unsafeAllowCustomTypes: true
          }
        )) as GReputation;
        console.log("GReputation Upgraded", upgradableAddresses.GReputation);
      } else {
        grep = (await ethers.getContractAt(
          "GReputation",
          upgradableAddresses.GReputation
        )) as GReputation;
      }
    } else {
      const GReputation = await ethers.getContractFactory("GReputation");
      const ProxyFactory = await fetchOrDeployProxyFactory();
      grep = (await upgrades.deployProxy(GReputation, [root.address], {
        unsafeAllowCustomTypes: true,
        kind: "transparent"
      })) as GReputation;

      console.log("Reputation deployed to:", grep.address);

      console.log("setting initial reputation state....", {
        avatar,
        repStateId,
        controller,
        upgradableSettings
      });

      //set the reputation hash
      await grep
        .setBlockchainStateHash(
          repStateId,
          upgradableSettings.governance.stateHash,
          upgradableSettings.governance.totalRep
        )
        .then(_ => _.wait());

      //move ownership to DAO
      console.log("transfering reputation owner to DAO...");
      await grep.transferOwnership(avatar).then(_ => _.wait());
    }

    console.log("deploying voting machine...");
    if (upgradableAddresses.CompoundVotingMachine) {
      console.log(
        "CompoundVotingMachine already deployed at:",
        upgradableAddresses.CompoundVotingMachine
      );
      vm = (await ethers.getContractAt(
        "CompoundVotingMachine",
        upgradableAddresses.CompoundVotingMachine
      )) as CompoundVotingMachine;
    } else {
      //deploy voting machine
      vm = (await (await ethers.getContractFactory("CompoundVotingMachine")).deploy(
        avatar,
        grep.address,
        upgradableSettings.governance.votingPeriod
      )) as CompoundVotingMachine;
      console.log("voting machiine deployed at:", vm.address);
    }

    await releaser(
      { CompoundVotingMachine: vm.address, GReputation: grep.address },
      networkName
    );
  };

  const voteNewContracts = async (proposalId = null) => {
    console.log("approve new voting scheme in dao...");
    const schemeRegistrar: SchemeRegistrar = (await ethers.getContractAt(
      "SchemeRegistrar",
      dao.SchemeRegistrar
    )) as SchemeRegistrar;

    if (!proposalId) {
      const proposal = await (
        await schemeRegistrar.proposeScheme(
          avatar,
          vm.address,
          ethers.constants.HashZero,
          "0x0000001F",
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CompoundVotingMachine"))
        )
      ).wait();

      console.log("proposal tx:", proposal.transactionHash);
      proposalId = proposal.events.find(_ => _.event === "NewSchemeProposal").args
        ._proposalId;
    }
    console.log("proposal", { scheme: vm.address, proposalId });

    console.log("voting...");

    const absoluteVote = await ethers.getContractAt(
      ["function vote(bytes32,uint,uint,address) returns (bool)"],
      dao.AbsoluteVote
    );

    console.log("voteUpgradeScheme", { absoluteVote: absoluteVote.address, founders });
    await Promise.all(
      founders.slice(0, Math.ceil(founders.length / 2)).map(f =>
        absoluteVote
          .connect(f)
          .vote(proposalId, 1, 0, f.address, { gasLimit: 300000 })
          .then(_ => _.wait())
          .catch(e => console.log("founder vote failed:", f.address, e.message))
      )
    );
  };

  const proveNewRep = async () => {
    console.log("prooving new rep...");
    if (networkName.includes("production") === false) {
      const proofs = [
        [
          "0x23d8bd1cdfa398986bb91927d3011fb1ded1425b6ae3ff794e497235481fe57f",
          "0xe4ac4e67088f036e8dc535fee10a3ad42065e444d2b0bd3668e0df21e1590db3"
        ],
        ["0x4c01c2c86a047dc65fc8ff0a1d9ac11842597af9a363711e4db7dcabcfda307b"],
        [
          "0x235dc3126b01e763befb96ead059e3f19d0380e65e477e6ebb95c1d9fc90e0b7",
          "0xe4ac4e67088f036e8dc535fee10a3ad42065e444d2b0bd3668e0df21e1590db3"
        ]
      ];
      let proofResults = await Promise.all(
        founders.map((f, idx) =>
          grep
            .connect(f)
            .proveBalanceOfAtBlockchain(repStateId, f.address, 100, proofs[idx])
            .then(_ => _.wait())
        )
      );
      console.log(
        "proofs:",
        proofResults.map(_ => _.events)
      );
    } else {
      //prove foundation multi sig account
      const proof = [];
      const foundationAddress = upgradableSettings.governance.foundationAddress;
      let proofResult = await grep
        .proveBalanceOfAtBlockchain(repStateId, foundationAddress, 12000000, proof)
        .then(_ => _.wait());

      console.log("proofs:", proofResult.events);
    }
  };

  const proposeRemoveOldSchemes = async () => {
    console.log("propose to remove old SchemeRegistrar & UpgradeScheme...");
    const revokeTx = await (
      await vm.propose(
        [controller, controller],
        ["0", "0"],
        ["unregisterScheme(address,address)", "unregisterScheme(address,address)"],
        [
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address"],
            [dao.SchemeRegistrar, avatar]
          ),
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address"],
            [dao.UpgradeScheme, avatar]
          )
        ],
        "revoke previous gov contracts permissions"
      )
    ).wait();

    console.log(
      "created revoke proposal:",
      revokeTx.transactionHash,
      revokeTx.events,
      revokeTx.events[0].args.id.toString()
    );
  };

  const voteToRevoke = async () => {
    if (networkName.includes("production") === false) {
      let voteResults = await Promise.all(
        founders.slice(0, Math.ceil(founders.length / 2)).map(f =>
          vm
            .connect(f)
            .castVote(1, true)
            .then(_ => _.wait())
            .catch(e => console.log("voteToRevoke failed for:", f.address, e.message))
        )
      );
      console.log(
        "vote results:",
        voteResults.map(_ => _ && _.events)
      );

      console.log("executing...");

      const executeTx = await (await vm.execute(1)).wait();
      console.log(
        "revoke proposal executed:",
        executeTx.transactionHash,
        executeTx.events
      );
    }
  };

  const voteNewGovernance = async (newGov, oldGov) => {
    console.log("propose to remove old CompoundVotingMachine and replace with new");
    const oldVM = await ethers.getContractAt("CompoundVotingMachine", oldGov);
    const revokeTx = await (
      await oldVM.propose(
        [controller, controller],
        ["0", "0"],
        ["registerScheme(address,bytes32,bytes4,address)", "unregisterSelf(address)"],
        [
          ethers.utils.defaultAbiCoder.encode(
            ["address", "bytes32", "bytes4", "address"],
            [newGov, ethers.constants.HashZero, "0x0000001F", avatar]
          ),
          ethers.utils.defaultAbiCoder.encode(["address"], [avatar])
        ],
        "revoke previous gov contracts permissions"
      )
    ).wait();

    console.log(
      "created revoke proposal:",
      revokeTx.transactionHash,
      revokeTx.events,
      revokeTx.events[0].args.id.toString()
    );
    const proposalId = revokeTx.events[0].args.id.toNumber();
    await new Promise((res, rej) => setTimeout(res, 5000));
    let voteResults = await Promise.all(
      founders.slice(0, Math.ceil(founders.length / 2)).map(f =>
        oldVM
          .connect(f)
          .castVote(proposalId, true)
          .then(_ => _.wait())
          .catch(e => console.log("voteToRevoke failed for:", f.address, e.message))
      )
    );
    console.log(
      "vote results:",
      voteResults.map(_ => _ && _.events)
    );
    await new Promise((res, rej) => setTimeout(res, 5000));

    console.log("executing...");

    const executeTx = await (await oldVM.execute(1)).wait();
    console.log("revoke proposal executed:", executeTx.transactionHash, executeTx.events);
  };

  await deployContracts();
  await voteNewContracts();
  await proveNewRep();
  await proposeRemoveOldSchemes();
  await voteToRevoke();
  //   voteNewGovernance(vm.address, "0x07FFf2171d99792f3eE692B6EA04F674888BA496");
};

main().catch(console.log);
