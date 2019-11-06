const Web3 = require("web3");
const AdminWallet = artifacts.require("./AdminWallet.sol");
const settings = require("./deploy-settings.json");
// if (process.env.NODE_ENV !== 'production') { // https://codeburst.io/process-env-what-it-is-and-why-when-how-to-use-it-effectively-505d0b2831e7
require("dotenv").load();
// }

const PrivateKeyProvider = require("truffle-hdwallet-provider-privkey");
const HDWalletProvider = require("truffle-hdwallet-provider");

const admin_mnemonic = process.env.ADMIN_MNEMONIC;
const infura_api = process.env.INFURA_API;

module.exports = async function(deployer, network, accounts) {
  if (network != "ganache" && network != "test" && network != "coverage") {
    const adminWallet = await AdminWallet.deployed();
    const networkSettings = settings[network] || settings["default"];

    let oldProvider = web3.currentProvider;
    let adminProvider;

    const adminWalletBalance = await web3.eth
      .getBalance(adminWallet.address)
      .then(parseInt);
    const adminWalletValue = web3.utils.toWei(
      networkSettings.walletTransfer,
      networkSettings.walletTransferUnits
    );
    console.log({ adminWalletBalance });
    if (adminWalletBalance <= parseInt(adminWalletValue))
      await web3.eth.sendTransaction({
        to: adminWallet.address,
        from: accounts[0],
        value: adminWalletValue
      });

    if (["mainnet", "ropsten", "kovan"].includes("network")) {
      adminProvider = new HDWalletProvider(
        admin_mnemonic,
        "https://" + network + ".infura.io/v3/" + infura_api,
        0,
        50
      );
    } else {
      adminProvider = new HDWalletProvider(
        admin_mnemonic,
        "https://rpc.fusenet.io/",
        0,
        50
      );
    }

    console.log({ adminProvider });
    //web3.setProvider(adminProvider);
    const adminsWeb3 = new Web3(adminProvider);
    const admins = await adminsWeb3.eth.getAccounts();
    console.log({ admins });

    await adminWallet.addAdmins(admins);
    await adminWallet.topAdmins(1);
  }
};
