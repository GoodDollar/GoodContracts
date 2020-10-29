const { admin, deployProxy, prepareUpgrade } = require("@openzeppelin/truffle-upgrades");
const {
  getVersion,
  getImplementationAddress,
  getAdminAddress,
  toEip1967Hash
} = require("@openzeppelin/upgrades-core");
const { getFounders } = require("../../scripts/getMigrationSettings");
const { toChecksumAddress } = require("web3-utils");
const UpgradeScheme = artifacts.require("UpgradeImplScheme");
const AbsoluteVote = artifacts.require("IntVoteInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function parseAddress(storage) {
  const buf = Buffer.from(storage.replace(/^0x/, ""), "hex");
  if (storage.length === 42 && storage.startsWith("0x"))
    return toChecksumAddress(storage);

  if (!buf.slice(0, 12).equals(Buffer.alloc(12, 0))) {
    throw new Error(
      `Value in storage is not an address (${storage}) value:${buf.toString()}`
    );
  }
  const address = "0x" + buf.toString("hex", 12, 32); // grab the last 20 bytes
  return toChecksumAddress(address);
}

export const proposeUpgradeScheme = async (
  deployer,
  daoAddresses,
  impl,
  proxy,
  proxyAdmin,
  callData,
  timeLock
) => {
  console.log("proposing conntract upgrade to DAO", {
    impl,
    proxy,
    proxyAdmin,
    timeLock
  });

  const scheme = await deployer.deploy(
    UpgradeScheme,
    daoAddresses.Avatar,
    impl,
    proxy,
    proxyAdmin,
    callData || "0x",
    timeLock
  );

  const schemeRegistrar = await SchemeRegistrar.at(daoAddresses.SchemeRegistrar);

  const proposal = await schemeRegistrar.proposeScheme(
    daoAddresses.Avatar,
    scheme.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = proposal.logs[0].args._proposalId;

  console.log("proposal", { scheme: scheme.address, proposalId });
  return { proposalId, scheme };
};

export const voteUpgradeScheme = async (network, daoAddresses, proposalId) => {
  const absoluteVote = await AbsoluteVote.at(daoAddresses.AbsoluteVote);
  const founders = await getFounders(AbsoluteVote.web3, network);
  console.log("voteUpgradeScheme", { absoluteVote: absoluteVote.address, founders });
  await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId, 1, 0, f, { from: f, gas: 300000 }))
  );
};

export const deployOrDAOUpgrade = async (
  network,
  web3,
  deployer,
  daoAddresses,
  Contract,
  initParams,
  upgradeCallData,
  deployedProxy,
  upgradeTimeLock,
  contractKey, //key in output json of addresses
  allowUnsafe
) => {
  //get the owner address from the proxy contract storage
  let proxyAdmin =
    deployedProxy &&
    (await web3.eth
      .getStorageAt(
        deployedProxy,
        "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
      )
      .then(parseAddress)
      .catch(e => null));

  console.log("checking deployed version", { proxyAdmin, deployedProxy });

  if (proxyAdmin == null || proxyAdmin == "0x0") {
    const instance = await deployProxy(Contract, initParams, {
      deployer,
      unsafeAllowCustomTypes: allowUnsafe
    });

    //get the owner address from the proxy contract storage
    proxyAdmin = await web3.eth
      .getStorageAt(instance.address, toEip1967Hash("eip1967.proxy.admin"))
      .then(parseAddress);

    const adminTransfer = await admin
      .transferProxyAdminOwnership(daoAddresses.Avatar)
      .catch(e => {
        console.warn("ProxyAdmin ownership transfer failed. not owner?", e.message);
      });

    console.log("Deployed DonationsStaking and transfered proxy admin ownership", {
      address: instance.address,
      proxyAdmin
    });

    let releasedContracts = {
      ProxyAdmin: proxyAdmin,
      [contractKey || Contract.contractName]: instance.address
    };

    return releasedContracts;
  } else {
    console.log("skipping already deployed, trying to upgrade");
    const upgraded = await prepareUpgrade(deployedProxy, Contract, {
      deployer,
      unsafeAllowCustomTypes: allowUnsafe
    });

    //get the owner address from the proxy contract storage
    const curImpl = await web3.eth
      .getStorageAt(
        deployedProxy,
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
      )
      .then(parseAddress);
    // const curImpl = await getImplementationAddress(web3, deployedProxy);
    console.log("prepared upgrade:", {
      curImpl,
      upgraded,
      version: getVersion(Contract.bytecode)
    });

    if (curImpl.toLowerCase() != upgraded.toLowerCase()) {
      console.log("contract changed, creating upgrade scheme...");
      const { proposalId, scheme } = await proposeUpgradeScheme(
        deployer,
        daoAddresses,
        upgraded,
        deployedProxy,
        proxyAdmin,
        null,
        upgradeTimeLock
      );

      console.log("voting upgrade...", { proposalId });
      await voteUpgradeScheme(network, daoAddresses, proposalId);
      console.log("vote passed, executing upgrade...");
      const res = await scheme.upgrade();
      console.log({ res });
      return {};
    } else {
      console.log("no changes, quiting...");
    }
  }
};
