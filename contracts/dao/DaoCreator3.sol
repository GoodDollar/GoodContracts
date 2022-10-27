pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Controller.sol";
import "@daostack/infra/contracts/Reputation.sol";

import "../token/GoodDollar.sol";
import "../identity/IdentityGuard.sol";
import "../dao/schemes/FeeFormula.sol";
import "./DaoCreator.sol";

interface INativeToken {
	function addMinter(address) external;

	function addPauser(address) external;

	function setFeeRecipient(address) external;

	function transferOwnership(address) external;

	function mint(address, uint256) external returns (bool);

	function renounceMinter() external;
}

/**
 * @title Genesis Scheme that creates organizations. Taken and modified from @daostack.
 */
contract DaoCreatorGoodDollarWithTokens {
	Avatar public avatar;
	address public lock;

	event NewOrg(address _avatar);
	event InitialSchemesSet(address _avatar);

	constructor() public {}

	/**
	 * @dev Create a new organization
	 * @param _nativeToken The token associated with the organization, need to have ownership + minting assigned to this contract
	 * @param _founders An array with the addresses of the founders of the organization
	 * @param _avatarTokenAmount Amount of tokens that the avatar receive in the new organization
	 * @param _foundersReputationAmount An array of amount of reputation that the
	 *   founders receive in the new organization
	 * @return The address of the avatar of the controller
	 */
	function forgeOrg(
		INativeToken _nativeToken,
		Reputation _reputation,
		address[] calldata _founders,
		uint256 _avatarTokenAmount,
		uint256[] calldata _foundersReputationAmount
	) external returns (address) {
		//The call for the private function is needed to bypass a deep stack issues
		return
			_forgeOrg(
				_nativeToken,
				_reputation,
				_founders,
				_avatarTokenAmount,
				_foundersReputationAmount
			);
	}

	/**
	 * @dev Set initial schemes for the organization.
	 * @param _avatar organization avatar (returns from forgeOrg)
	 * @param _schemes the schemes to register for the organization
	 * @param _params the schemes parameters
	 * @param _permissions the schemes permissions.
	 * @param _metaData dao meta data hash
	 */
	function setSchemes(
		Avatar _avatar,
		address[] calldata _schemes,
		bytes32[] calldata _params,
		bytes4[] calldata _permissions,
		string calldata _metaData
	) external {
		// this action can only be executed by the account that holds the lock
		// for this controller
		require(lock == msg.sender, "Message sender is not lock");
		// register initial schemes:
		ControllerInterface controller = ControllerInterface(_avatar.owner());
		for (uint256 i = 0; i < _schemes.length; i++) {
			controller.registerScheme(
				_schemes[i],
				_params[i],
				_permissions[i],
				address(_avatar)
			);
		}
		controller.metaData(_metaData, _avatar);
		// Unregister self:
		controller.unregisterScheme(address(this), address(_avatar));
		// Remove lock:
		lock = address(0);
		emit InitialSchemesSet(address(_avatar));
		selfdestruct(address(0));
	}

	/**
	 * @dev Create a new organization
	 * @param _founders An array with the addresses of the founders of the organization
	 * @param _avatarTokenAmount Amount of tokens that the avatar receive on startup
	 * @param _foundersReputationAmount An array of amount of reputation that the
	 *   founders receive in the new organization
	 * @return The address of the avatar of the controller
	 */
	function _forgeOrg(
		INativeToken nativeToken,
		Reputation _nativeReputation,
		address[] memory _founders,
		uint256 _avatarTokenAmount,
		uint256[] memory _foundersReputationAmount
	) private returns (address) {
		// Create Token, Reputation and Avatar:
		require(lock == address(0), "Lock already exists");
		require(
			_founders.length == _foundersReputationAmount.length,
			"Founder reputation missing"
		);
		// require(_founders.length > 0, "Must have at least one founder");

		avatar = addFounders(
			nativeToken,
			_nativeReputation,
			msg.sender,
			_founders,
			_avatarTokenAmount,
			_foundersReputationAmount
		);

		lock = msg.sender;

		emit NewOrg(address(avatar));
		return (address(avatar));
	}

	/**
	 * @param _founders An array with the addresses of the founders of the organization
	 * @param _avatarTokenAmount Amount of tokens that the avatar receive on new organization
	 * @param _foundersReputationAmount An array of amount of reputation that the
	 *   founders receive in the new organization
	 */
	function addFounders(
		INativeToken nativeToken,
		Reputation nativeReputation,
		address _sender,
		address[] memory _founders,
		uint256 _avatarTokenAmount,
		uint256[] memory _foundersReputationAmount
	) public returns (Avatar) {
		avatar = new Avatar(
			"GoodDollar",
			DAOToken(address(nativeToken)),
			nativeReputation
		);

		//mint token to avatar

		nativeToken.addMinter(address(this));

		if (_avatarTokenAmount > 0) {
			nativeToken.mint(address(this), _avatarTokenAmount);
		}

		// Mint reputation for founders:
		for (uint256 i = 0; i < _founders.length; i++) {
			require(
				_founders[i] != address(0),
				"Founder cannot be zero address"
			);
			if (_foundersReputationAmount[i] > 0) {
				nativeReputation.mint(
					_founders[i],
					_foundersReputationAmount[i]
				);
			}
		}
		// Create Controller:
		ControllerInterface controller = ControllerInterface(
			new Controller(avatar)
		);

		// Set fee recipient and Transfer ownership:
		nativeToken.setFeeRecipient(address(avatar));

		avatar.transferOwnership(address(controller));
		// nativeReputation.transferOwnership(address(controller)); //GReputation doesnt have ownership

		// Add minters
		nativeToken.addMinter(_sender);
		nativeToken.addMinter(address(avatar));
		nativeToken.addMinter(address(controller));
		nativeToken.addPauser(address(avatar));

		nativeToken.renounceMinter();
		nativeToken.transferOwnership(address(avatar));

		return (avatar);
	}
}
