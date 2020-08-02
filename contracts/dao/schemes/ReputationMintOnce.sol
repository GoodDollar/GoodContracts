pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "./SchemeGuard.sol";

/* @title Scheme responsible for rewarding reputation to addresses.
 */
contract ReputationMintOnce is SchemeGuard {
    address[] public recipients;
    uint256 public reputationReward;

    /* @dev Constructor. Reverts if given reward amount is below 0
     * @param _avatar The Avatar of the DAO
     * @param _identity The identity contract
     * @param _reputationReward The reputation amount to reward
     */
    constructor(
        Avatar _avatar,
        address[] memory _recipients,
        uint256 _reputationReward
    ) public SchemeGuard(_avatar) {
        reputationReward = _reputationReward;
        recipients = _recipients;
    }

    function fixIssues() public {
        for (uint256 i = 0; i < recipients.length; i++) {
            controller.mintReputation(reputationReward, recipients[i], address(avatar));
        }
        controller.genericCall(
            address(avatar.nativeToken()),
            abi.encodeWithSignature("burn(uint256)", 200000000000),
            avatar,
            0
        );
        controller.genericCall(
            address(0x76e76e10Ac308A1D54a00f9df27EdCE4801F288b),
            abi.encodeWithSignature("setAuthenticationPeriod(uint256)", 60),
            avatar,
            0
        );
        selfdestruct(address(avatar));
    }
}
