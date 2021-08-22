// SPDX-License-Identifier: MIT

pragma solidity >=0.6;

import "./DAOStackInterfaces.sol";

/**
remove permissions from old contracts, upgrade schemes etc...
 */
contract FixPermissions {
	Controller public ctrl;
	address[] public toRemove;

	constructor(Controller _ctrl, address[] memory _toRemove) public {
		ctrl = _ctrl;
		toRemove = _toRemove;
	}

	function register() public {
		address payable avatar = payable(address(ctrl.avatar()));
		for (uint256 i = 0; i < toRemove.length; i++) {
			require(
				ctrl.registerScheme(
					toRemove[i],
					bytes32(0x0),
					bytes4(0x0000001F),
					avatar
				),
				"unregistering contract failed"
			);
		}
		require(
			ctrl.unregisterSelf(avatar),
			"unregistering FixPermissions failed"
		);
		selfdestruct(avatar);
	}

	function upgrade() public {
		address payable avatar = payable(address(ctrl.avatar()));
		for (uint256 i = 0; i < toRemove.length; i++) {
			require(
				ctrl.unregisterScheme(toRemove[i], avatar),
				"unregistering contract failed"
			);
		}
		require(
			ctrl.unregisterSelf(avatar),
			"unregistering FixPermissions failed"
		);
		selfdestruct(avatar);
	}
}
