pragma solidity 0.5.4;

import "../../../contracts/identity/Identity.sol";


/**
 * @title A Identity mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract IdentityMock is Identity {
    constructor() public Identity() {}

    mapping(address => bool) public contracts;

    function addWhitelisted(address account) public {
        _addWhitelisted(account);
    }

    function removeWhitelisted(address account) public {
        _removeWhitelisted(account);
    }

    function removeContract(address account) public {}

    function addContract(address account) public {
        contracts[account] = true;
    }

    function isDAOContract(address account) public view returns (bool) {
        return contracts[account];
    }

    function authenticate(address account) public {
        dateAuthenticated[account] = now;
    }
}
