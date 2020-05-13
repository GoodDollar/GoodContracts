pragma solidity 0.5.4;

import "../../../contracts/identity/Identity.sol";

contract IdentityMock is Identity {

    constructor() public Identity() {}

    function addWhitelisted(address account)
        public
    {
        _addWhitelisted(account);
    }

    function removeWhitelisted(address account)
        public
    {
        _removeWhitelisted(account);
    }
}