// SPDX-License-Identifier: MIT
pragma solidity >=0.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "../DAOStackInterfaces.sol";

contract CompoundVotingMachine {
	using SafeMathUpgradeable for uint256;
	/// @notice The name of this contract
	string public constant name = "GoodDAO Voting Machine";

	/// @notice the number of blocks a proposal is open for voting (before passing quorum)
	uint256 public votingPeriodBlocks;

	/// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
	function quorumVotes() public view returns (uint256) {
		return rep.totalSupply().mul(3).div(100);
	} //3%

	/// @notice The number of votes required in order for a voter to become a proposer
	function proposalThreshold(uint256 blockNumber)
		public
		view
		returns (uint256)
	{
		return rep.totalSupplyAt(blockNumber).mul(1).div(100);
	} // 1%

	/// @notice The maximum number of actions that can be included in a proposal
	function proposalMaxOperations() public pure returns (uint256) {
		return 10;
	} // 10 actions

	/// @notice The delay before voting on a proposal may take place, once proposed
	function votingDelay() public pure returns (uint256) {
		return 1;
	} // 1 block

	/// @notice The duration of voting on a proposal, in blocks
	function votingPeriod() public view returns (uint256) {
		return votingPeriodBlocks;
	} // ~14 days in blocks (assuming 15s blocks)

	/// @notice The duration of time after proposal passed thershold before it can be expected
	function queuePeriod() public pure returns (uint256) {
		return 2 days;
	} // 2 days

	/// @notice During the queue period if vote decision has changed, we extend queue period so
	/// that at least gameChangerPeriod is left
	function gameChangerPeriod() public pure returns (uint256) {
		return 1 days;
	} // 1 day

	/// @notice the time a succeeded proposal has to be executed on the blockchain
	function gracePeriod() public pure returns (uint256) {
		return 3 days;
	} //3 days

	/// @notice The address of the DAO controller
	Controller public controller;

	/// @notice The address of the DAO reputation token
	ReputationInterface public rep;

	/// @notice The address of the Governor Guardian
	address public guardian;

	/// @notice The total number of proposals
	uint256 public proposalCount;

	struct Proposal {
		/// @notice Unique id for looking up a proposal
		uint256 id;
		/// @notice Creator of the proposal
		address proposer;
		/// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
		uint256 eta;
		/// @notice the ordered list of target addresses for calls to be made
		address[] targets;
		/// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
		uint256[] values;
		/// @notice The ordered list of function signatures to be called
		string[] signatures;
		/// @notice The ordered list of calldata to be passed to each call
		bytes[] calldatas;
		/// @notice The block at which voting begins: holders must delegate their votes prior to this block
		uint256 startBlock;
		/// @notice The block at which voting ends: votes must be cast prior to this block
		uint256 endBlock;
		/// @notice Current number of votes in favor of this proposal
		uint256 forVotes;
		/// @notice Current number of votes in opposition to this proposal
		uint256 againstVotes;
		/// @notice Flag marking whether the proposal has been canceled
		bool canceled;
		/// @notice Flag marking whether the proposal has been executed
		bool executed;
		/// @notice Receipts of ballots for the entire set of voters
		mapping(address => Receipt) receipts;
		/// @notice quorom required at time of proposing
		uint256 quoromRequired;
	}

	/// @notice Ballot receipt record for a voter
	struct Receipt {
		/// @notice Whether or not a vote has been cast
		bool hasVoted;
		/// @notice Whether or not the voter supports the proposal
		bool support;
		/// @notice The number of votes the voter had, which were cast
		uint256 votes;
	}

	/// @notice Possible states that a proposal may be in
	enum ProposalState {
		Pending,
		Active,
		ActiveTimelock, // passed quorom, time lock of 2 days activated, still open for voting
		Canceled,
		Defeated,
		Succeeded,
		// Queued, we dont have queued status, we use game changer period instead
		Expired,
		Executed
	}

	/// @notice The official record of all proposals ever proposed
	mapping(uint256 => Proposal) public proposals;

	/// @notice The latest proposal for each proposer
	mapping(address => uint256) public latestProposalIds;

	/// @notice The EIP-712 typehash for the contract's domain
	bytes32 public constant DOMAIN_TYPEHASH =
		keccak256(
			"EIP712Domain(string name,uint256 chainId,address verifyingContract)"
		);

	/// @notice The EIP-712 typehash for the ballot struct used by the contract
	bytes32 public constant BALLOT_TYPEHASH =
		keccak256("Ballot(uint256 proposalId,bool support)");

	/// @notice An event emitted when a new proposal is created
	event ProposalCreated(
		uint256 id,
		address proposer,
		address[] targets,
		uint256[] values,
		string[] signatures,
		bytes[] calldatas,
		uint256 startBlock,
		uint256 endBlock,
		string description
	);

	/// @notice An event emitted when a vote has been cast on a proposal
	event VoteCast(
		address voter,
		uint256 proposalId,
		bool support,
		uint256 votes
	);

	/// @notice An event emitted when a proposal has been canceled
	event ProposalCanceled(uint256 id);

	/// @notice An event emitted when a proposal has been queued
	event ProposalQueued(uint256 id, uint256 eta);

	/// @notice An event emitted when a proposal has been executed
	event ProposalExecuted(uint256 id);

	constructor(
		Avatar avatar_, // the DAO avatar
		address rep_, // address reputation
		uint256 votingPeriodBlocks_ //number of blocks a proposal is open for voting before expiring
	) public {
		controller = Controller(avatar_.owner());
		rep = ReputationInterface(rep_);
		votingPeriodBlocks = votingPeriodBlocks_;
	}

	/// @notice make a proposal to be voted on
	/// @param targets list of contracts to be excuted on
	/// @param values list of eth value to be used in each contract call
	/// @param signatures the list of functions to execute
	/// @param calldatas the list of parameters to pass to each function
	/// @return uint256 proposal id
	function propose(
		address[] memory targets,
		uint256[] memory values,
		string[] memory signatures,
		bytes[] memory calldatas,
		string memory description
	) public returns (uint256) {
		require(
			rep.getVotesAt(msg.sender, true, block.number.sub(1)) >
				proposalThreshold(block.number.sub(1)),
			"CompoundVotingMachine::propose: proposer votes below proposal threshold"
		);
		require(
			targets.length == values.length &&
				targets.length == signatures.length &&
				targets.length == calldatas.length,
			"CompoundVotingMachine::propose: proposal function information arity mismatch"
		);
		require(
			targets.length != 0,
			"CompoundVotingMachine::propose: must provide actions"
		);
		require(
			targets.length <= proposalMaxOperations(),
			"CompoundVotingMachine::propose: too many actions"
		);

		uint256 latestProposalId = latestProposalIds[msg.sender];

		if (latestProposalId != 0) {
			ProposalState proposersLatestProposalState =
				state(latestProposalId);
			require(
				proposersLatestProposalState != ProposalState.Active &&
					proposersLatestProposalState !=
					ProposalState.ActiveTimelock,
				"CompoundVotingMachine::propose: one live proposal per proposer, found an already active proposal"
			);
			require(
				proposersLatestProposalState != ProposalState.Pending,
				"CompoundVotingMachine::propose: one live proposal per proposer, found an already pending proposal"
			);
		}

		uint256 startBlock = block.number.add(votingDelay());
		uint256 endBlock = startBlock.add(votingPeriod());

		proposalCount++;
		Proposal memory newProposal =
			Proposal({
				id: proposalCount,
				proposer: msg.sender,
				eta: 0,
				targets: targets,
				values: values,
				signatures: signatures,
				calldatas: calldatas,
				startBlock: startBlock,
				endBlock: endBlock,
				forVotes: 0,
				againstVotes: 0,
				canceled: false,
				executed: false,
				quoromRequired: quorumVotes()
			});

		proposals[newProposal.id] = newProposal;
		latestProposalIds[newProposal.proposer] = newProposal.id;

		emit ProposalCreated(
			newProposal.id,
			msg.sender,
			targets,
			values,
			signatures,
			calldatas,
			startBlock,
			endBlock,
			description
		);
		return newProposal.id;
	}

	/// @notice helper to set the effective time of a proposal that passed quorom
	/// @dev also extends the ETA in case of a game changer in vote decision
	/// @param proposal the proposal to set the eta
	/// @param hasVoteChanged did the current vote changed the decision
	function _updateETA(Proposal storage proposal, bool hasVoteChanged)
		internal
	{
		//if absolute majority allow to execute immediately
		if (proposal.forVotes > rep.totalSupplyAt(proposal.startBlock).div(2)) {
			proposal.eta = now;
		}
		//first time we have a quorom we ask for a no change in decision period
		else if (proposal.eta == 0) {
			proposal.eta = block.timestamp.add(queuePeriod());
		}
		//if we have a gamechanger then we extend current eta to have at least gameChangerPeriod left
		else if (hasVoteChanged) {
			uint256 timeLeft = proposal.eta.sub(block.timestamp);
			proposal.eta = proposal.eta.add(
				timeLeft > gameChangerPeriod()
					? 0
					: gameChangerPeriod().sub(timeLeft)
			);
		} else {
			return;
		}
		emit ProposalQueued(proposal.id, proposal.eta);
	}

	/// @notice execute the proposal list of transactions
	/// @dev anyone can call this once its ETA has arrived
	function execute(uint256 proposalId) public payable {
		require(
			state(proposalId) == ProposalState.Succeeded,
			"CompoundVotingMachine::execute: proposal can only be executed if it is succeeded"
		);
		require(
			proposals[proposalId].eta <= block.timestamp,
			"CompoundVotingMachine::execute: proposal can only be executed if no game changers"
		);
		Proposal storage proposal = proposals[proposalId];
		proposal.executed = true;
		for (uint256 i = 0; i < proposal.targets.length; i++) {
			_executeTransaction(
				proposal.targets[i],
				proposal.values[i],
				proposal.signatures[i],
				proposal.calldatas[i],
				proposal.eta
			);
		}
		emit ProposalExecuted(proposalId);
	}

	/// @notice internal helper to execute a single transaction of a proposal
	/// @dev special execution is done if target is a method in the DAO controller
	function _executeTransaction(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data,
		uint256 eta
	) internal returns (bytes memory) {
		bytes memory callData;

		if (bytes(signature).length == 0) {
			callData = data;
		} else {
			callData = abi.encodePacked(
				bytes4(keccak256(bytes(signature))),
				data
			);
		}

		bool ok;
		bytes memory result;

		if (target == address(controller)) {
			(ok, result) = target.call{ value: value }(callData);
		} else {
			payable(address(controller.avatar())).transfer(value); //make sure avatar have the funds to pay
			(ok, result) = controller.genericCall(
				target,
				callData,
				controller.avatar(),
				value
			);
		}
		require(
			ok,
			"CompoundVotingMachine::executeTransaction: Transaction execution reverted."
		);

		//TODO: event with tx result
		return result;
	}

	/// @notice cancel a proposal in case proposer no longer holds the votes that were required to propose
	/// @dev could be cheating trying to bypass the single proposal per address by delegating to another address
	/// or when delegators do not concur with the proposal done in their name, they can withdraw
	function cancel(uint256 proposalId) public {
		ProposalState state = state(proposalId);
		require(
			state != ProposalState.Executed,
			"CompoundVotingMachine::cancel: cannot cancel executed proposal"
		);

		Proposal storage proposal = proposals[proposalId];
		require(
			rep.getVotesAt(proposal.proposer, true, block.number.sub(1)) <
				proposalThreshold(proposal.startBlock),
			"CompoundVotingMachine::cancel: proposer above threshold"
		);

		proposal.canceled = true;

		emit ProposalCanceled(proposalId);
	}

	/// @notice get the actions to be done in a proposal
	function getActions(uint256 proposalId)
		public
		view
		returns (
			address[] memory targets,
			uint256[] memory values,
			string[] memory signatures,
			bytes[] memory calldatas
		)
	{
		Proposal storage p = proposals[proposalId];
		return (p.targets, p.values, p.signatures, p.calldatas);
	}

	/// @notice get the receipt of a single voter in a proposal
	function getReceipt(uint256 proposalId, address voter)
		public
		view
		returns (Receipt memory)
	{
		return proposals[proposalId].receipts[voter];
	}

	/// @notice get the current status of a proposal
	function state(uint256 proposalId) public view returns (ProposalState) {
		require(
			proposalCount >= proposalId && proposalId > 0,
			"CompoundVotingMachine::state: invalid proposal id"
		);

		Proposal storage proposal = proposals[proposalId];

		if (proposal.canceled) {
			return ProposalState.Canceled;
		} else if (block.number <= proposal.startBlock) {
			return ProposalState.Pending;
		} else if (proposal.executed) {
			return ProposalState.Executed;
		} else if (
			proposal.eta > 0 && block.timestamp < proposal.eta //passed quorum but not executed yet, in time lock
		) {
			return ProposalState.ActiveTimelock;
		} else if (
			//regular voting period
			proposal.eta == 0 && block.number <= proposal.endBlock
		) {
			//proposal is active if we are in the gameChanger period (eta) or no decision yet and in voting period
			return ProposalState.Active;
		} else if (
			proposal.forVotes <= proposal.againstVotes ||
			proposal.forVotes < proposal.quoromRequired
		) {
			return ProposalState.Defeated;
		} else if (
			proposal.eta > 0 &&
			block.timestamp >= proposal.eta.add(gracePeriod())
		) {
			//expired if not executed gracePeriod after eta
			return ProposalState.Expired;
		} else {
			return ProposalState.Succeeded;
		}
	}

	/// @notice cast your vote on a proposal
	/// @param proposalId the proposal to vote on
	/// @param support for or against
	function castVote(uint256 proposalId, bool support) public {
		//get all votes in all blockchains including delegated
		Proposal storage proposal = proposals[proposalId];
		uint256 votes = rep.getVotesAt(msg.sender, true, proposal.startBlock);
		return _castVote(msg.sender, proposal, support, votes);
	}

	struct VoteSig {
		bool support;
		uint8 v;
		bytes32 r;
		bytes32 s;
	}

	// function ecRecoverTest(
	// 	uint256 proposalId,
	// 	VoteSig[] memory votesFor,
	// 	VoteSig[] memory votesAgainst
	// ) public {
	// 	bytes32 domainSeparator =
	// 		keccak256(
	// 			abi.encode(
	// 				DOMAIN_TYPEHASH,
	// 				keccak256(bytes(name)),
	// 				getChainId(),
	// 				address(this)
	// 			)
	// 		);
	// 	bytes32 structHashFor =
	// 		keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, true));
	// 	bytes32 structHashAgainst =
	// 		keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, false));
	// 	bytes32 digestFor =
	// 		keccak256(
	// 			abi.encodePacked("\x19\x01", domainSeparator, structHashFor)
	// 		);
	// 	bytes32 digestAgainst =
	// 		keccak256(
	// 			abi.encodePacked("\x19\x01", domainSeparator, structHashAgainst)
	// 		);

	// 	Proposal storage proposal = proposals[proposalId];

	// 	uint256 total;
	// 	for (uint32 i = 0; i < votesFor.length; i++) {
	// 		bytes32 digest = digestFor;

	// 		address signatory =
	// 			ecrecover(digest, votesFor[i].v, votesFor[i].r, votesFor[i].s);
	// 		require(
	// 			signatory != address(0),
	// 			"CompoundVotingMachine::castVoteBySig: invalid signature"
	// 		);
	// 		require(
	// 			votesFor[i].support == true,
	// 			"CompoundVotingMachine::castVoteBySig: invalid support value in for batch"
	// 		);
	// 		total += rep.getVotesAt(signatory, true, proposal.startBlock);
	// 		Receipt storage receipt = proposal.receipts[signatory];
	// 		receipt.hasVoted = true;
	// 		receipt.support = true;
	// 	}
	// 	if (votesFor.length > 0) {
	// 		address voteAddressHash =
	// 			address(uint160(uint256(keccak256(abi.encode(votesFor)))));
	// 		_castVote(voteAddressHash, proposalId, true, total);
	// 	}

	// 	total = 0;
	// 	for (uint32 i = 0; i < votesAgainst.length; i++) {
	// 		bytes32 digest = digestAgainst;

	// 		address signatory =
	// 			ecrecover(
	// 				digest,
	// 				votesAgainst[i].v,
	// 				votesAgainst[i].r,
	// 				votesAgainst[i].s
	// 			);
	// 		require(
	// 			signatory != address(0),
	// 			"CompoundVotingMachine::castVoteBySig: invalid signature"
	// 		);
	// 		require(
	// 			votesAgainst[i].support == false,
	// 			"CompoundVotingMachine::castVoteBySig: invalid support value in against batch"
	// 		);
	// 		total += rep.getVotesAt(signatory, true, proposal.startBlock);
	// 		Receipt storage receipt = proposal.receipts[signatory];
	// 		receipt.hasVoted = true;
	// 		receipt.support = true;
	// 	}
	// 	if (votesAgainst.length > 0) {
	// 		address voteAddressHash =
	// 			address(uint160(uint256(keccak256(abi.encode(votesAgainst)))));
	// 		_castVote(voteAddressHash, proposalId, false, total);
	// 	}
	// }

	/// @notice helper to cast a vote for someone else by using eip712 signatures
	function castVoteBySig(
		uint256 proposalId,
		bool support,
		uint8 v,
		bytes32 r,
		bytes32 s
	) public {
		bytes32 domainSeparator =
			keccak256(
				abi.encode(
					DOMAIN_TYPEHASH,
					keccak256(bytes(name)),
					getChainId(),
					address(this)
				)
			);
		bytes32 structHash =
			keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
		bytes32 digest =
			keccak256(
				abi.encodePacked("\x19\x01", domainSeparator, structHash)
			);
		address signatory = ecrecover(digest, v, r, s);
		require(
			signatory != address(0),
			"CompoundVotingMachine::castVoteBySig: invalid signature"
		);

		//get all votes in all blockchains including delegated
		Proposal storage proposal = proposals[proposalId];
		uint256 votes = rep.getVotesAt(signatory, true, proposal.startBlock);
		return _castVote(signatory, proposal, support, votes);
	}

	/// @notice internal helper to cast a vote
	function _castVote(
		address voter,
		Proposal storage proposal,
		bool support,
		uint256 votes
	) internal {
		uint256 proposalId = proposal.id;
		require(
			state(proposalId) == ProposalState.Active ||
				state(proposalId) == ProposalState.ActiveTimelock,
			"CompoundVotingMachine::_castVote: voting is closed"
		);

		Receipt storage receipt = proposal.receipts[voter];
		require(
			receipt.hasVoted == false,
			"CompoundVotingMachine::_castVote: voter already voted"
		);

		bool hasChanged = proposal.forVotes > proposal.againstVotes;
		if (support) {
			proposal.forVotes = proposal.forVotes.add(votes);
		} else {
			proposal.againstVotes = proposal.againstVotes.add(votes);
		}

		hasChanged = hasChanged != (proposal.forVotes > proposal.againstVotes);
		receipt.hasVoted = true;
		receipt.support = support;
		receipt.votes = votes;

		// if quorom passed then start the queue period
		if (
			proposal.forVotes >= proposal.quoromRequired ||
			proposal.againstVotes >= proposal.quoromRequired
		) _updateETA(proposal, hasChanged);
		emit VoteCast(voter, proposalId, support, votes);
	}

	// function __acceptAdmin() public {
	// 	require(
	// 		msg.sender == guardian,
	// 		"CompoundVotingMachine::__acceptAdmin: sender must be gov guardian"
	// 	);
	// 	timelock.acceptAdmin();
	// }

	// function __abdicate() public {
	// 	require(
	// 		msg.sender == guardian,
	// 		"CompoundVotingMachine::__abdicate: sender must be gov guardian"
	// 	);
	// 	guardian = address(0);
	// }

	// function __queueSetTimelockPendingAdmin(
	// 	address newPendingAdmin,
	// 	uint256 eta
	// ) public {
	// 	require(
	// 		msg.sender == guardian,
	// 		"CompoundVotingMachine::__queueSetTimelockPendingAdmin: sender must be gov guardian"
	// 	);
	// 	timelock.queueTransaction(
	// 		address(timelock),
	// 		0,
	// 		"setPendingAdmin(address)",
	// 		abi.encode(newPendingAdmin),
	// 		eta
	// 	);
	// }

	// function __executeSetTimelockPendingAdmin(
	// 	address newPendingAdmin,
	// 	uint256 eta
	// ) public {
	// 	require(
	// 		msg.sender == guardian,
	// 		"CompoundVotingMachine::__executeSetTimelockPendingAdmin: sender must be gov guardian"
	// 	);
	// 	timelock.executeTransaction(
	// 		address(timelock),
	// 		0,
	// 		"setPendingAdmin(address)",
	// 		abi.encode(newPendingAdmin),
	// 		eta
	// 	);
	// }

	function getChainId() public pure returns (uint256) {
		uint256 chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}
}
