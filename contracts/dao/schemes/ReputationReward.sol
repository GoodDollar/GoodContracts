pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme responsible for rewarding reputation for positive actions
 */
contract ReputationReward is IdentityGuard, SchemeGuard {

    Avatar avatar;

    address public creator;
    uint public reputationReward;

    /* @dev Constructor. Checks that given reward amount is above 0
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint _reputationReward
    )
        public
        IdentityGuard(_identity)
        SchemeGuard(_avatar)
    {
        require(_reputationReward > 0, "reputation reward cannot be equal to or lower than zero" );

        avatar = _avatar;
        creator = msg.sender;
        reputationReward = _reputationReward;
    }

    function rewardAddress(address _to)
        internal
        requireClaimer(_to)
        onlyRegistered
        returns (bool)
    {
        controller.mintReputation(reputationReward, _to, address(avatar));

        return true;
    } 
}