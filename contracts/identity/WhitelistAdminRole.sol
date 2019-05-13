pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract WhitelistAdminRole is Ownable {
    using Roles for Roles.Role;

    event WhitelistAdminAdded(address indexed account);
    event WhitelistAdminRemoved(address indexed account);

    Roles.Role private whitelistAdmins;

    constructor() internal {
        _addWhitelistAdmin(msg.sender);
    }

    modifier onlyWhitelistAdmin() {
        require(isWhitelistAdmin(msg.sender), "not whitelistAdmin");
        _;
    }

    modifier requireWhitelistAdmin(address account) {
        require(isWhitelistAdmin(account), "not whitelistAdmin");
        _;
    }

    /**
     * @dev Checks if account is whitelist dmin
     * @param account Account to check
     * @return Boolean indicating if account is whitelist admin
     */
    function isWhitelistAdmin(address account) public view returns (bool) {
        return whitelistAdmins.has(account);
    }

    /**
     * @dev Adds a whitelist admin account. Is only callable by owner.
     * @param account Address to be added
     */
    function addWhitelistAdmin(address account) public onlyOwner {
        _addWhitelistAdmin(account);
    }

    /**
     * @dev Removes a whitelist admin account. Is only callable by owner.
     * @param account Address to be removed
     */
    function removeWhitelistAdmin(address account) public onlyOwner {
        _removeWhitelistAdmin(account);
    }

    /** @dev Allows a privileged holder to renounce their role */
    function renounceWhitelistAdmin() public {
        _removeWhitelistAdmin(msg.sender);
    }

    /** @dev Internal implementation of addWhitelistAdmin */
    function _addWhitelistAdmin(address account) internal {
        whitelistAdmins.add(account);
        emit WhitelistAdminAdded(account);
    }

    /** @dev Internal implementation of removeWhitelistAdmin */
    function _removeWhitelistAdmin(address account) internal {
        whitelistAdmins.remove(account);
        emit WhitelistAdminRemoved(account);
    }
}