pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the reserve
 * in fundmanager contract
 */
contract FundManagerSetReserve is SchemeGuard {
    address public fundmanager;
    address public reserve;

    constructor(
        Avatar _avatar,
        address _fundmanager,
        address _reserve
    ) public SchemeGuard(_avatar) {
        require(_reserve != address(0), "reserve cannot be null address");
        fundmanager = _fundmanager;
        reserve = _reserve;
    }

    function setReserve() public onlyRegistered {
        controller.genericCall(
            fundmanager,
            abi.encodeWithSignature("setReserve(address)", reserve),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
