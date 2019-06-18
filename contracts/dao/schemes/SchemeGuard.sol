pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

/* @dev abstract contract for ensuring that schemes have been registered properly
 * Allows setting zero Avatar in scenarios where Avatar hasn't been created yet 
 */
contract SchemeGuard is Ownable {

    Avatar avatar;
    ControllerInterface controller;

    constructor(Avatar _avatar) public {
        avatar = _avatar;

        if (avatar != Avatar(0)) {
            controller = ControllerInterface(avatar.owner());
        }
    }

    /* @dev checks if scheme is registered
     */
    modifier onlyRegistered() {
        require(controller.isSchemeRegistered(address(this), address(avatar)),
         "Scheme is not registered");
        _;
    }

    /* @dev Checks if scheme is not registered
     */
    modifier onlyNotRegistered() {
        require(!controller.isSchemeRegistered(address(this), address(avatar)),
         "Scheme is not registered");
        _;
    }

    /* @dev Sets a new given avatar and controller for scheme
     * can only be done by owner of scheme
     */
    function setAvatar(Avatar _avatar) public onlyOwner {
        require(_avatar != Avatar(0), "Avatar cannot be zero");
        avatar = _avatar;
        controller = ControllerInterface(avatar.owner());
    }

    /* @dev function to see if an avatar has been set and if scheme is registered
     */
    function isRegistered() public view returns (bool) {
        require(avatar != Avatar(0), "Avatar is not set");
        return controller.isSchemeRegistered(address(this), address(avatar));
    }
}