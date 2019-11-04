const AdminWallet = artifacts.require("./AdminWallet.sol");

// if (process.env.NODE_ENV !== 'production') { // https://codeburst.io/process-env-what-it-is-and-why-when-how-to-use-it-effectively-505d0b2831e7
require("dotenv").load();
// }

const PrivateKeyProvider = require("truffle-hdwallet-provider-privkey");
const HDWalletProvider = require("truffle-hdwallet-provider");

const admin_mnemonic = process.env.ADMIN_MNEMONIC;
const infura_api = process.env.INFURA_API;

module.exports = async function(deployer, network, provider) {

	if( network != 'ganache' && network != 'test'
		&& network != 'coverage') {
		const adminWallet = await AdminWallet.deployed();

		let adminProvider;

		await web3.eth.getAccounts(function(err, res) {
			accounts = res;
		});

		await web3.eth.sendTransaction({
		  to: adminWallet.address,
		  from: accounts[0],
		  value: web3.utils.toWei("2")
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

		await web3.setProvider(adminProvider);

		await web3.eth.getAccounts(function(err, res) {
			accounts = res;
		});
		const admins = accounts;

		await adminWallet.addAdmins(admins);
		await adminWallet.topAdmins();

		await web3.setProvider(provider);
	}
}