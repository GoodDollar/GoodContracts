pragma solidity 0.5.4;

import "../dao/schemes/ActivePeriod.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

contract ActivePeriodMock is ActivePeriod {

    constructor( uint256 _periodStart, uint256 _periodEnd) public ActivePeriod(_periodStart, _periodEnd) {}

    function start() public {
        super.start();
    }

    function end(Avatar _avatar) public {
        super.internalEnd(_avatar);
    }
}