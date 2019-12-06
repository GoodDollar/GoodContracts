pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Scheme responsible for rewarding reputation to addresses.
 */
contract ReputationReward is IdentityGuard, SchemeGuard {

    address public creator;
    uint256 public reputationReward;

    /* @dev Constructor. Reverts if given reward amount is below 0
     * @param _avatar The Avatar of the DAO
     * @param _identity The identity contract
     * @param _reputationReward The reputation amount to reward
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

        creator = msg.sender;
        reputationReward = _reputationReward;
    }

    /* @dev Internal function to reward a given address with the rewarding amount.
     * @param _to the address to reward
     * Reverts if given address isn't whitelisted or scheme isn't registered
     * @return true if amount was minted
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