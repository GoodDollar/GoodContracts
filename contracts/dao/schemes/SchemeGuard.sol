pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

/* @dev abstract contract for ensuring that schemes have been registered properly
 * Allows setting zero Avatar in situations where the Avatar hasn't been created yet
 */
contract SchemeGuard is Ownable {

    Avatar avatar;
    ControllerInterface controller = ControllerInterface(0);

    /* @dev Constructor. only sets controller if given avatar is not null.
     * @param _avatar The avatar of the DAO.
     */
    constructor(Avatar _avatar) public {
        avatar = _avatar;

        if (avatar != Avatar(0)) {
            controller = ControllerInterface(avatar.owner());
        }
    }

    /* @dev modifier to check if scheme is registered
     */
    modifier onlyRegistered() {
        require(isRegistered(), "Scheme is not registered");
        _;
    }

    /* @dev modifier to check if scheme is not registered
     */
    modifier onlyNotRegistered() {
        require(!isRegistered(), "Scheme is registered");
        _;
    }

    /* @dev Function to set a new avatar and controller for scheme
     * can only be done by owner of scheme
     */
    function setAvatar(Avatar _avatar) public onlyOwner {
        avatar = _avatar;
        controller = ControllerInterface(avatar.owner());
    }

    /* @dev function to see if an avatar has been set and if this scheme is registered
     * @returns true if scheme is registered
     */
    function isRegistered() public view returns(bool) {
        require(avatar != Avatar(0), "Avatar is not set");

        if (!(controller.isSchemeRegistered(address(this), address(avatar)))) {
            return false;
        }
        return true;
    }
}