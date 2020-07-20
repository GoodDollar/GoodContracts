pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Controller.sol";

/**
 * @title A Controller mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract ControllerMock is Controller {
    constructor(Avatar _avatar) public Controller(_avatar) {}

    function genericCall(
        address _contract,
        bytes calldata _data,
        Avatar _avatar,
        uint256 _value
    ) external returns (bool, bytes memory) {
        return avatar.genericCall(_contract, _data, _value);
    }

    function isSchemeRegistered(address _scheme, address _avatar)
        external
        view
        returns (bool)
    {
        return true;
    }
}
