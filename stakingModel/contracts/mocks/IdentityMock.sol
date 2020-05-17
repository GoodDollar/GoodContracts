pragma solidity 0.5.4;

import "../../../contracts/identity/Identity.sol";

/**
 * @title A Identity mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
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