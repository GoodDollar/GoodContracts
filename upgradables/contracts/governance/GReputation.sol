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

		//dont consider rootState as blockchain,  it is a special state hash
		bool isRootState = idHash == keccak256(bytes("rootState"));
		require(
			!isRootState || super.totalSupplyAt(block.number) == 0,
			"rootState already created"
		);

		uint256 i = 0;
		for (; !isRootState && i < activeBlockchains.length; i++) {
			if (activeBlockchains[i] == idHash) break;
		}

		//if new blockchain
		if (!isRootState && i == activeBlockchains.length) {
			activeBlockchains.push(idHash);
		}

		if (isRootState) {
			updateValueAtNow(totalSupplyHistory, totalSupply);
		}

		BlockchainState memory state;
		state.stateHash = _hash;
		state.totalSupply = totalSupply;
		state.blockNumber = block.number;
		blockchainStates[idHash].push(state);
	}

	/**
	 * @dev returns balance in current blockchain (super.balanceOfAt)
	 */
	function balanceOfLocal(address _owner, uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		return super.balanceOfAt(_owner, _blockNumber);
	}

	/**
	 * @dev returns aggregated reputation in all blockchains
	 */
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

	/**
	 * @dev returns total supply in current blockchain (rootState + super.balanceOfAt)
	 */
	function totalSupplyLocal(uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		return super.totalSupplyAt(_blockNumber);
	}

	function totalSupplyAt(uint256 _blockNumber)
		public
		view
		override
		returns (uint256)
	{
		uint256 startingSupply = super.totalSupplyAt(_blockNumber);
		for (uint256 i = 0; i < activeBlockchains.length; i++) {
			startingSupply = startingSupply.add(
				totalySupplyAtBlockchain(activeBlockchains[i], _blockNumber)
			);
		}
		return startingSupply;
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
			if (states[uint256(i)].blockNumber <= _blockNumber) break;
		}
		if (i < 0) return 0;

		BlockchainState memory state = states[uint256(i)];
		return stateHashBalances[state.stateHash][_owner];
	}

	function totalySupplyAtBlockchain(bytes32 _id, uint256 _blockNumber)
		public
		view
		returns (uint256)
	{
		BlockchainState[] memory states = blockchainStates[_id];
		int256 i;
		if (states.length == 0) return 0;
		for (i = int256(states.length - 1); i >= 0; i--) {
			if (states[uint256(i)].blockNumber <= _blockNumber) break;
		}
		if (i < 0) return 0;

		BlockchainState memory state = states[uint256(i)];
		return state.totalSupply;
	}

	function proveBalanceOfAtBlockchain(
		string memory _id,
		address _owner,
		uint256 _balance,
		bytes32[] memory _proof
	) public returns (bool) {
		bytes32 idHash = keccak256(bytes(_id));
		require(
			blockchainStates[idHash].length > 0,
			"no state found for given _id"
		);
		bytes32 stateHash =
			blockchainStates[idHash][blockchainStates[idHash].length - 1]
				.stateHash;

		//this is specifically important for rootState that should update real balance only once
		require(
			stateHashBalances[stateHash][_owner] == 0,
			"stateHash already proved"
		);

		(, bool isProofValid) =
			checkMerkleProof(_owner, _balance, stateHash, _proof);
		require(isProofValid, "invalid merkle proof");

		//if initiial state then set real balance
		if (idHash == keccak256(bytes("rootState"))) {
			updateValueAtNow(balances[_owner], _balance);
		}
		//if proof is valid then set balances
		stateHashBalances[stateHash][_owner] = _balance;
		return true;
	}

	function checkMerkleProof(
		address _owner,
		uint256 _balance,
		bytes32 _root,
		bytes32[] memory _proof
	) internal pure returns (bytes32 leafHash, bool isProofValid) {
		leafHash = keccak256(abi.encode(_owner, _balance));
		isProofValid = MerkleProofUpgradeable.verify(_proof, _root, leafHash);
	}
}
