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

    function start() public {
        super.start();
        super.rewardAddress(creator);
        super.rewardAddress(msg.sender);
    }

    function end(Avatar _avatar) public {
        super.rewardAddress(msg.sender);

        super.end(_avatar);
    }
}
