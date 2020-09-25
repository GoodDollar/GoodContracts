pragma solidity >0.5.4;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "../DAOStackInterfaces.sol";
import "../Interfaces.sol";

/* @dev abstract contract for ensuring that schemes have been registered properly
 * Allows setting zero Avatar in situations where the Avatar hasn't been created yet
 */
contract USchemeGuard is Initializable {
    Avatar avatar;
    Controller internal controller;

    /** @dev Constructor. only sets controller if given avatar is not null.
     * @param _avatar The avatar of the DAO.
     */
    function initialize(address _avatar) public initializer{
        avatar = Avatar(address(uint160(_avatar)));
        if (avatar != Avatar(0)) {
            controller = Controller(avatar.owner());
        }
    }

    /** @dev modifier to check if caller is avatar
     */
    modifier onlyAvatar() {
        require(address(avatar) == msg.sender, "only Avatar can call this method");
        _;
    }

    /** @dev modifier to check if scheme is registered
     */
    modifier onlyRegistered() {
        require(isRegistered(), "Scheme is not registered");
        _;
    }

    /** @dev modifier to check if scheme is not registered
     */
    modifier onlyNotRegistered() {
        require(!isRegistered(), "Scheme is registered");
        _;
    }

    /** @dev modifier to check if call is a scheme that is registered
     */
    modifier onlyRegisteredCaller() {
        require(isRegistered(msg.sender), "Calling scheme is not registered");
        _;
    }

    /** @dev function to see if an avatar has been set and if this scheme is registered
     * @return true if scheme is registered
     */
    function isRegistered() public view returns (bool) {
        return isRegistered(address(this));
    }

    /** @dev function to see if an avatar has been set and if this scheme is registered
     * @return true if scheme is registered
     */
    function isRegistered(address scheme) public view returns (bool) {
        require(avatar != Avatar(0), "Avatar is not set");

        if (!(controller.isSchemeRegistered(scheme, address(avatar)))) {
            return false;
        }
        return true;
    }
}
