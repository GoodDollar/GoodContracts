// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

import "../governance/Reputation.sol";

contract ReputationTestHelper {
	Reputation public reputation;

	constructor(Reputation _reputation) public {
		reputation = _reputation;
	}

	function multipleMint(
		address _user,
		uint256 _amount,
		uint256 _numberOfMint
	) public returns (uint256) {
		uint256 i;
		for (i = 0; i < _numberOfMint; i++) {
			reputation.mint(_user, _amount);
		}
	}

	function multipleBurn(
		address _user,
		uint256 _amount,
		uint256 _numberOfBurn
	) public returns (uint256) {
		uint256 i;
		for (i = 0; i < _numberOfBurn; i++) {
			reputation.burn(_user, _amount);
		}
	}
}
