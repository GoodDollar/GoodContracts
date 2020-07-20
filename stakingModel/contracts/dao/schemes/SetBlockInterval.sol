pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the block interval
 * in reserve contract
 */
contract SetBlockInterval is SchemeGuard {
    address public reserve;
    uint256 public blockInterval;

    constructor(
        Avatar _avatar,
        address _reserve,
        uint256 _blockInterval
    ) public SchemeGuard(_avatar) {
        reserve = _reserve;
        blockInterval = _blockInterval;
    }

    function setBlockInterval() public onlyRegistered {
        controller.genericCall(
            reserve,
            abi.encodeWithSignature("setBlockInterval(uint256)", blockInterval),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
