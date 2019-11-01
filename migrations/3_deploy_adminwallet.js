const AdminWallet = artifacts.require("./AdminWallet.sol");

module.exports = async function(deployer, network, provider, adminProvider) {

	if( network != 'develop' && network != 'ganache' &&
		network != 'test' && network != 'coverage') {
		const adminWallet = await AdminWallet.deployed();

		web3.setProvider(adminProvider);

		await web3.eth.getAccounts(function(err, res) {
			accounts = res;
		});
		const admins = [accounts[0]];

		await adminWallet.addAdmins(admins);

		web3.setProvider(provider);
	}
}