pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";
import "./SchemeGuard.sol";

/* @title Sign-Up bonus scheme responsible for minting
 * a given amount to any claimer once per claimer
 */
contract SignUpBonus is IdentityGuard, SchemeGuard {
    using SafeMath for uint256;

    uint256 public bonus;
    mapping (address => bool) hasClaimed;

    event BonusClaimed(address indexed account, uint256 amount);

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _bonus
    )
        public
        IdentityGuard(_identity)
        SchemeGuard(_avatar)
    {
        bonus = _bonus;
    }

    /* @dev bonus claiming function. Allows only registered claimers to receive
     */
    function claim() external onlyClaimer onlyRegistered {
        require(!hasClaimed[msg.sender], "has already claimed");
        hasClaimed[msg.sender] = true;

        controller.mintTokens(bonus, msg.sender, address(avatar));

        emit BonusClaimed(msg.sender, bonus);
    }
 }