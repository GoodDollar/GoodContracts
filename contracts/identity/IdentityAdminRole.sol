pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/** @title Contract managing the whitelist admin role */
contract IdentityAdminRole is Ownable {
    using Roles for Roles.Role;

    event IdentityAdminAdded(address indexed account);
    event IdentityAdminRemoved(address indexed account);

    Roles.Role private IdentityAdmins;

    constructor() internal {
        _addIdentityAdmin(msg.sender);
    }

    modifier onlyIdentityAdmin() {
        require(isIdentityAdmin(msg.sender), "not IdentityAdmin");
        _;
    }

    modifier requireIdentityAdmin(address account) {
        require(isIdentityAdmin(account), "not IdentityAdmin");
        _;
    }

    /**
     * @dev Checks if account is whitelist admin
     * @param account Account to check
     * @return Boolean indicating if account is whitelist admin
     */
    function isIdentityAdmin(address account) public view returns (bool) {
        return IdentityAdmins.has(account);
    }

    /**
     * @dev Adds a whitelist admin account. Is only callable by owner.
     * @param account Address to be added
     */
    function addIdentityAdmin(address account) public onlyOwner {
        _addIdentityAdmin(account);
    }

    /**
     * @dev Removes a whitelist admin account. Is only callable by owner.
     * @param account Address to be removed
     */
    function removeIdentityAdmin(address account) public onlyOwner requireIdentityAdmin(account) {
        _removeIdentityAdmin(account);
    }

    /** @dev Allows a privileged holder to renounce their role */
    function renounceIdentityAdmin() public {
        _removeIdentityAdmin(msg.sender);
    }

    /** @dev Internal implementation of addIdentityAdmin */
    function _addIdentityAdmin(address account) internal {
        IdentityAdmins.add(account);
        emit IdentityAdminAdded(account);
    }

    /** @dev Internal implementation of removeIdentityAdmin */
    function _removeIdentityAdmin(address account) internal {
        IdentityAdmins.remove(account);
        emit IdentityAdminRemoved(account);
    }
}