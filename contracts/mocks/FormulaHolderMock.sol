pragma solidity 0.5.4;

import "../dao/schemes/FormulaHolder.sol";
import "../dao/schemes/FeeFormula.sol";

contract FormulaHolderMock is FormulaHolder {

    constructor() public FormulaHolder(FeeFormula(0)) {}
}