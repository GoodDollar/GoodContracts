pragma solidity 0.5.4;

import "../dao/schemes/FeeGuard.sol";
import "../dao/schemes/FeeFormula.sol";

contract FeeGuardMock is FeeGuard {

    constructor() public FeeGuard(FeeFormula(0)) {}
}