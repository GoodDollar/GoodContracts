pragma solidity >0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title Contract managing the identity admin role
 */
contract IdentityAdminRole is Ownable {
    using Roles for Roles.Role;

    event IdentityAdminAdded(address indexed account);
    event IdentityAdminRemoved(address indexed account);

    Roles.Role private IdentityAdmins;

    /* @dev constructor. Adds caller as an admin
     */
    constructor() internal {
        _addIdentityAdmin(msg.sender);
    }

    /* @dev Modifier to check if caller is an admin
     */
    modifier onlyIdentityAdmin() {
        require(isIdentityAdmin(msg.sender), "not IdentityAdmin");
        _;
    }

    /**
     * @dev Checks if account is identity admin
     * @param account Account to check
     * @return Boolean indicating if account is identity admin
     */
    function isIdentityAdmin(address account) public view returns (bool) {
        return IdentityAdmins.has(account);
    }

    /**
     * @dev Adds a identity admin account. Is only callable by owner.
     * @param account Address to be added
     * @return true if successful
     */
    function addIdentityAdmin(address account) public onlyOwner returns (bool) {
        _addIdentityAdmin(account);
        return true;
    }

    /**
     * @dev Removes a identity admin account. Is only callable by owner.
     * @param account Address to be removed
     * @return true if successful
     */
    function removeIdentityAdmin(address account) public onlyOwner returns (bool) {
        _removeIdentityAdmin(account);
        return true;
    }

    /**
     * @dev Allows an admin to renounce their role
     */
    function renounceIdentityAdmin() public {
        _removeIdentityAdmin(msg.sender);
    }

    /**
     * @dev Internal implementation of addIdentityAdmin
     */
    function _addIdentityAdmin(address account) internal {
        IdentityAdmins.add(account);
        emit IdentityAdminAdded(account);
    }

    /**
     * @dev Internal implementation of removeIdentityAdmin
     */
    function _removeIdentityAdmin(address account) internal {
        IdentityAdmins.remove(account);
        emit IdentityAdminRemoved(account);
    }
}
