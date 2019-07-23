pragma solidity 0.5.4;

import "../dao/schemes/ReputationReward.sol";
import "../dao/schemes/ActivePeriod.sol";

contract ReputationMock is ReputationReward, ActivePeriod {

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _reputationReward,
        uint _periodStart,
        uint _periodEnd
    )
        public
        ReputationReward(_avatar, _identity, _reputationReward)
        ActivePeriod(_periodStart, _periodEnd)
    {}

    function start() public returns (bool){
        require(super.start());
        require(super.rewardAddress(creator));
        require(super.rewardAddress(msg.sender));
    }

    function end() public returns (bool) {
        require(super.end());
        require(super.rewardAddress(msg.sender));
    }
}
