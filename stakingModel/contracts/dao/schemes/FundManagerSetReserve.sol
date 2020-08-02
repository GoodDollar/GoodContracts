pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the reserve
 * in fundmanager contract
 */
contract FundManagerSetReserve {
    address public fundmanager;
    address public reserve;
    Avatar avatar;

    constructor(
        Avatar _avatar,
        address _fundmanager,
        address _reserve
    ) public {
        require(_reserve != address(0), "reserve cannot be null address");
        fundmanager = _fundmanager;
        reserve = _reserve;
        avatar = _avatar;
    }

    function setReserve() public {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        controller.genericCall(
            fundmanager,
            abi.encodeWithSignature("setReserve(address)", reserve),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
