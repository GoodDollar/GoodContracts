pragma solidity >0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "../../../../contracts/dao/schemes/SchemeGuard.sol";

/* @title Scheme contract responsible for setting the market maker
 * in reserve contract
 */
contract SetMarketMaker is SchemeGuard {
    address public reserve;
    address public marketMaker;

    constructor(
        Avatar _avatar,
        address _reserve,
        address _marketMaker
    ) public SchemeGuard(_avatar) {
        require(_marketMaker != address(0), "marketMaker cannot be null address");
        require(_reserve != address(0), "reserve cannot be null address");
        reserve = _reserve;
        marketMaker = _marketMaker;
    }

    function setMarketMaker() public onlyRegistered {
        controller.genericCall(
            reserve,
            abi.encodeWithSignature("setMarketMaker(address)", marketMaker),
            avatar,
            0
        );

        selfdestruct(address(avatar));
    }
}
