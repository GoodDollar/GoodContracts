pragma solidity 0.5.4;

import "../AvatarGuard.sol";
import "./FeeFormula.sol";

/* @title Fee guard contract in charge of setting registered fee formula schemes to contract
 */
contract FormulaHolder is AvatarGuard {

    FeeFormula public formula;

    /* @dev Constructor. Checks if formula is a zero address
     * @param _formula The fee formula contract.
     */
    constructor(FeeFormula _formula) public {
        require(_formula != FeeFormula(0), "Supplied formula is null");
        formula = _formula;
    }

    /* @dev Sets the given fee formula contract. Reverts if formula has not been registered by DAO.
     * Is only callable by owner or given avatar if contract is owned by controller of avatar
     * @param _formula the new fee formula scheme
     * @param _avatar the avatar to call with
     */
    function setFormula(FeeFormula _formula, Avatar _avatar) public onlyOwnerOrAvatar(_avatar) {
        _formula.isRegistered();
        formula = _formula;
    }
}