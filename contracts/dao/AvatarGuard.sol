pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

/* @title Avatar guard contract restricting scheme access to contract owner
 * or the DAO avatar if the DAO controller owns the contract
 */
contract AvatarGuard is Ownable {

    modifier onlyOwnerOrAvatar(Avatar _avatar) {
        require(
            (msg.sender == address(_avatar) && address(_avatar.owner()) == this.owner())
            || msg.sender == this.owner(),
            "Only callable by avatar of owner or owner");
        _;
    }
}