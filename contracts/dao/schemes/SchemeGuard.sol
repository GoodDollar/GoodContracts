pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../AvatarGuard.sol";

/* @dev abstract contract for ensuring that schemes have been registered properly
 * Allows setting zero Avatar in scenarios where Avatar hasn't been created yet 
 */
contract SchemeGuard is AvatarGuard {

    Avatar avatar;
    ControllerInterface controller = ControllerInterface(0);

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
         "Scheme is registered");
        _;
    }

    /* @dev Sets a new given avatar and controller for scheme
     * can only be done by owner of scheme
     */
    function setAvatar(Avatar _avatar) public onlyOwnerOrAvatar(_avatar) {
        avatar = _avatar;
        controller = ControllerInterface(avatar.owner());
    }

    /* @dev function to see if an avatar has been set and if scheme is registered
     */
    function isRegistered() public view {
        require(avatar != Avatar(0), "Avatar is not set");
        require(controller.isSchemeRegistered(address(this), address(avatar)), "Scheme is not registered");
    }
}