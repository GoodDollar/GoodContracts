pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

import "./SchemeGuard.sol";

/* @title Fee formula contract
 * GoodDollar token is always initiated with a given fee formula, 
 * whereof getTxFees is the only assumed function
 */
contract AbstractFees is SchemeGuard {
    constructor () public SchemeGuard(Avatar(0)) {}

    function getTxFees(uint256 _value) public view returns (uint256);
}

contract FeeFormula is AbstractFees {
    using SafeMath for uint256;

    /* @dev calculates 1 percentage fee of given value. Must be registered as a scheme.
     * @param _value the value to calculate fees from
     * @return the transactional fee for given value
     */
    function getTxFees(uint256 _value) public view onlyRegistered returns (uint256) {
        return _value.div(100);
    }
}