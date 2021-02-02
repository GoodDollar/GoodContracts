pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

/* @title Scheme for switching to AMB bridge
 */
contract ChangeFirstTimeAward {
	Avatar avatar;

	constructor(Avatar _avatar) public {
		avatar = _avatar;
	}

	/* @dev Adds the bridge address to minters, deploys the home bridge on
	 * current network, and then self-destructs, transferring any ether on the
	 * contract to the avatar. Reverts if scheme is not registered
	 */
	function setAward(address firstClaimPool, uint256 award) public {
		ControllerInterface controller = ControllerInterface(avatar.owner());
		(bool ok, ) =
			controller.genericCall(
				address(firstClaimPool),
				abi.encodeWithSignature("setClaimAmount(uint256)", award),
				avatar,
				0
			);

		require(ok, "setting first claim amount failed");

		selfdestruct(address(avatar));
	}
}
