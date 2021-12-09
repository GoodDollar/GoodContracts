// SPDX-License-Identifier: MIT

pragma solidity >=0.6;
pragma experimental ABIEncoderV2;

import "./DAOStackInterfaces.sol";

/* @title Scheme for upgrading an upgradable "uups" contract to new impl
 * see openzeppelin upgradables
 */
contract UpgradeImplSchemeV2 {
	event UpgradedImpl(address indexed proxy, address impl);

	Avatar public avatar;
	Controller public controller;
	address[] public newImpl;
	address[] public proxy;
	bytes[] public callData;

	/* @dev constructor. Sets the factory address. Reverts if given address is null
	 * @param _factory The address of the bridge factory
	 */
	constructor(
		Avatar _avatar,
		address[] memory _newImpl,
		address[] memory _proxy,
		bytes[] memory _callData
	) public {
		newImpl = _newImpl;
		avatar = _avatar;
		proxy = _proxy;
		callData = _callData;
		controller = Controller(avatar.owner());
	}

	/* @dev
	 * calls upgrade on the proxyadmin contract
	 */
	function upgrade() public {
		for (uint256 i = 0; i < newImpl.length; i++) {
			address impl = newImpl[i];
			address prx = proxy[i];
			if (callData[i].length > 0) {
				(bool ok, ) = controller.genericCall(
					prx,
					abi.encodeWithSignature(
						"upgradeToAndCall(address,bytes)",
						impl,
						callData[i]
					),
					avatar,
					0
				);
				require(ok, "Calling upgradeAndCall failed");
			} else {
				(bool ok, ) = controller.genericCall(
					prx,
					abi.encodeWithSignature("upgradeTo(address)", impl),
					avatar,
					0
				);
				require(ok, "Calling upgrade failed");
			}
			emit UpgradedImpl(prx, impl);
		}
		selfdestruct(payable(address(avatar)));
	}
}
