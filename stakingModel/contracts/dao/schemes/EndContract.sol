pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the market maker
 * in reserve contract
 */
contract EndContract is SchemeGuard {

    address public contractAddress;

    constructor(
        Avatar _avatar,
        address _contractAddress
    )
        public
        SchemeGuard(_avatar)
    {
        require(_contractAddress != address(0), "contractAddress cannot be null address");
        contractAddress = _contractAddress;
    }

    function end() public onlyRegistered {
        controller.genericCall(
            contractAddress,
            abi.encodeWithSignature("end()"),
            avatar,
            0);

        selfdestruct(address(avatar));
    }
}
