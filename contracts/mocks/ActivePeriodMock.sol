pragma solidity >0.5.4;

import "../dao/schemes/ActivePeriod.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

contract ActivePeriodMock is ActivePeriod {
    constructor(
        uint256 _periodStart,
        uint256 _periodEnd,
        Avatar _avatar
    ) public ActivePeriod(_periodStart, _periodEnd, _avatar) {}

    function start() public {
        super.start();
    }

    function end() public {
        super.internalEnd(avatar);
    }
}
