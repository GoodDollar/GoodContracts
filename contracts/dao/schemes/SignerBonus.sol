pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/IdentityGuard.sol";

/**
 * @title Sign-on bonus scheme responsible for minting
 * a set amount to any claimer once
 */
contract SignerBonus is IdentityGuard {
    using SafeMath for uint256;

    Avatar public avatar;

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
    {
        require(_avatar != Avatar(0), "avatar cannot be zero");

        avatar = _avatar;
        bonus = _bonus;
    }

    function claim() external onlyClaimer {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        require(controller.isSchemeRegistered(address(this), address(avatar)),
         "scheme is not registered");

        require(!hasClaimed[msg.sender], "has already claimed");
        hasClaimed[msg.sender] = true;

        controller.mintTokens(bonus, msg.sender, address(avatar));

        emit BonusClaimed(msg.sender, bonus);
    }
 }