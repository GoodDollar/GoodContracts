const AdminWallet = artifacts.require("./AdminWallet.sol");
const settings = require("./deploy-settings.json");
// if (process.env.NODE_ENV !== 'production') { // https://codeburst.io/process-env-what-it-is-and-why-when-how-to-use-it-effectively-505d0b2831e7
require("dotenv").load();
// }

const PrivateKeyProvider = require("truffle-hdwallet-provider-privkey");
const HDWalletProvider = require("truffle-hdwallet-provider");

const admin_mnemonic = process.env.ADMIN_MNEMONIC;
const infura_api = process.env.INFURA_API;

module.exports = async function(deployer, network) {

	if( network != 'ganache' && network != 'test'
		&& network != 'coverage') {

		const adminWallet = await AdminWallet.deployed();
		const networkSettings = settings[network] || settings["default"];
		
		let oldProvider = await web3.currentProvider();
		let adminProvider;

		await web3.eth.sendTransaction({
		  to: adminWallet.address,
		  from: accounts[0],
		  value: web3.utils.toWei(networkSettings.walletTransfer, networkSettings.walletTransferUnits)
		});

		switch(network) {
			case 'mainnet' || 'ropsten' || 'kovan':
			  adminProvider = await new HDWalletProvider(admin_mnemonic, "https://" + network + ".infura.io/v3/" + infura_api, 0, 50);
			  break;
			case 'fuse' || 'staging' ||
			  'etoro' || 'production':
			  adminProvider = await new HDWalletProvider(admin_mnemonic, "https://rpc.fusenet.io/", 0, 50);
			  break;
			default:
		}

		web3.setProvider(adminProvider);

		const admins = await web3.eth.getAccounts()
			accounts = res;
		});
		const admins = accounts;

		web3.setProvider(oldProvider);

		await adminWallet.addAdmins(admins);
		await adminWallet.topAdmins(1);
	}
}
