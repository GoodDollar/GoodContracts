pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme responsible for rewarding reputation for positive actions
 */
contract ReputationReward is IdentityGuard, SchemeGuard {

    address public creator;
    uint256 public reputationReward;

    /* @dev Constructor. Checks that given reward amount is above 0
     * @param _avatar The Avatar of the organization
     * @param _identity The identity contract
     * @param _reputationReward The reward to grant
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _reputationReward
    )
        public
        IdentityGuard(_identity)
        SchemeGuard(_avatar)
    {
        require(_reputationReward > 0, "reputation reward cannot be zero" );

        avatar = _avatar;
        creator = msg.sender;
        reputationReward = _reputationReward;
    }

    /* @dev Rewards a given address with the reward given in the constructor
     * @return true if successful
     */
    function rewardAddress(address _to)
        internal
        requireWhitelisted(_to)
        onlyRegistered
        returns (bool)
    {
        controller.mintReputation(reputationReward, _to, address(avatar));
        return true;
    } 
}