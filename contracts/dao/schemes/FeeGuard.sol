pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./FeeFormula.sol";

contract FeeGuard is Ownable{

    FeeFormula public formula;

    /* @dev Constructor. Checks if identity is a zero address
     * @param _identity The identity contract.
     */
    constructor(FeeFormula _formula) public {
        require(_formula != FeeFormula(0), "Supplied formula is null");
        formula = _formula;
    }

    modifier onlyOwnerOrAvatar(Avatar _avatar) {
        require(
            (msg.sender == address(_avatar) && address(_avatar.owner()) == this.owner())
            || msg.sender == this.owner(),
            "Only callable by avatar of owner or owner");
        _;
    }

    function setFormula(FeeFormula _formula, Avatar _avatar) public onlyOwnerOrAvatar(_avatar) {
        _formula.isRegistered();
        formula = _formula;
    }
}