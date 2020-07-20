pragma solidity >0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./FeeFormula.sol";

/* @title Contract in charge of setting registered fee formula schemes to contract
 */
contract FormulaHolder is Ownable {
    AbstractFees public formula;

    /* @dev Constructor. Requires that given formula is a valid contract.
     * @param _formula The fee formula contract.
     */
    constructor(AbstractFees _formula) public {
        require(_formula != AbstractFees(0), "Supplied formula is null");
        formula = _formula;
    }

    /* @dev Sets the given fee formula contract. Is only callable by owner.
     * Reverts if formula has not been registered by DAO.
     * @param _formula the new fee formula scheme
     */
    function setFormula(AbstractFees _formula) public onlyOwner {
        _formula.isRegistered();
        formula = _formula;
    }
}
