// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/cryptography/MerkleProofUpgradeable.sol";

import "./Reputation.sol";
import "../Interfaces.sol";

/**
 * @title InvitesV1 contract that handles invites with pre allocated bounty pool
 * 1.1 adds invitee bonus
 */
contract GReputation is Reputation {
	using SafeMathUpgradeable for uint256;
	struct BlockchainState {
		bytes32 stateHash;
		uint256 hashType;
		uint256 totalSupply;
		uint256 blockNumber;
		uint256[5] __reserevedSpace;
	}

	mapping(bytes32 => BlockchainState[]) public blockchainStates;
	mapping(bytes32 => mapping(address => uint256)) public stateHashBalances;

	bytes32[] public activeBlockchains;

	function setBlockchainStateHash(
		string memory _id,
		bytes32 _hash,
		uint256 totalSupply
	) public onlyOwner {
		bytes32 idHash = keccak256(bytes(_id));
		uint256 i = 0;
		for (; i < activeBlockchains.length; i++) {
			if (activeBlockchains[i] == idHash) break;
		}

		//if new blockchain
		if (i == activeBlockchains.length) {
			activeBlockchains.push(idHash);
		}
		BlockchainState memory state;
		state.stateHash = _hash;
		state.totalSupply = totalSupply;
		state.blockNumber = block.number;
		blockchainStates[idHash].push(state);
	}

	function balanceOfAt(address _owner, uint256 _blockNumber)
		public
		view
		override
		returns (uint256)
	{
		uint256 startingBalance = super.balanceOfAt(_owner, _blockNumber);
		for (uint256 i = 0; i < activeBlockchains.length; i++) {
			startingBalance = startingBalance.add(
				balanceOfAtBlockchain(
					activeBlockchains[i],
					_owner,
					_blockNumber
				)
			);
		}
		return startingBalance;
	}

	function balanceOfAtBlockchain(
		bytes32 _id,
		address _owner,
		uint256 _blockNumber
	) public view returns (uint256) {
		BlockchainState[] memory states = blockchainStates[_id];
		int256 i;
		if (states.length == 0) return 0;
		for (i = int256(states.length - 1); i >= 0; i--) {
			if (states[uint256(i)].blockNumber < _blockNumber) break;
		}
		BlockchainState memory state = states[i >= 0 ? uint256(i) : 0];
		return stateHashBalances[state.stateHash][_owner];
	}

	function proveBalanceOfAtBlockchain(
		string memory _id,
		address _owner,
		uint256 _balance,
		uint256 _stateIdx,
		bytes32[] memory _proof
	) public returns (bool) {
		bytes32 idHash = keccak256(bytes(_id));
		bytes32 stateRoot = blockchainStates[idHash][_stateIdx].stateHash;
		(, bool isProofValid) =
			checkMerkleProof(_owner, _balance, stateRoot, _proof);
		require(isProofValid, "invalid merkle proof");

		//if proof is valid then set balances
		stateHashBalances[stateRoot][_owner] = _balance;
		return true;
	}

	function checkMerkleProof(
		address _owner,
		uint256 _balance,
		bytes32 _root,
		bytes32[] memory _proof
	) public pure returns (bytes32 leafHash, bool isProofValid) {
		leafHash = keccak256(abi.encode(_owner, _balance));
		isProofValid = MerkleProofUpgradeable.verify(_proof, _root, leafHash);
	}
}
