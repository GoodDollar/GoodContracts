pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

/* @title Scheme for switching to AMB bridge
 */
contract ChangeAuthPeriod {
	uint256 public newAuthPeriodDays;
	Avatar avatar;
	address identity;

	/* @dev constructor. Sets the factory address. Reverts if given address is null
	 * @param _factory The address of the bridge factory
	 */
	constructor(
		Avatar _avatar,
		address _identity,
		uint256 _authPeriodDays
	) public {
		newAuthPeriodDays = _authPeriodDays;
		avatar = _avatar;
		identity = _identity;
	}

	/* @dev Adds the bridge address to minters, deploys the home bridge on
	 * current network, and then self-destructs, transferring any ether on the
	 * contract to the avatar. Reverts if scheme is not registered
	 */
	function setAuthPeriod() public {
		ControllerInterface controller = ControllerInterface(avatar.owner());
		(bool ok, ) = controller.genericCall(
			identity,
			abi.encodeWithSignature(
				"setAuthenticationPeriod(uint256)",
				newAuthPeriodDays
			),
			avatar,
			0
		);

		require(ok, "setting authentication period failed");

		selfdestruct(address(avatar));
	}
}
