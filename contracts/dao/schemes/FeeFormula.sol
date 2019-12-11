pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

import "./SchemeGuard.sol";

/* @title Fee formula abstract contract
 */
contract AbstractFees is SchemeGuard {
    constructor () public SchemeGuard(Avatar(0)) {}

    function getTxFees(uint256 _value) public view returns (uint256);
}

/* @title Fee formula contract
 * contract that provides a function to calculate
 * fees as a percentage of any given value
 */
contract FeeFormula is AbstractFees {
    using SafeMath for uint256;

    uint256 public percentage;
    
    /* @dev Constructor. Requires the given percentage parameter
     * to be less than 100.
     * @param _percentage the percentage to calculate fees of
     */
    constructor (uint256 _percentage) public {
        require(_percentage<100, "Percentage should be <100");
        percentage = _percentage;
    }

    /* @dev calculates the fee of given value.
     * @param _value the value of the transaction to calculate fees from
     * @return the transactional fee for given value
     */
    function getTxFees(uint256 _value) public view returns (uint256) {
        return _value.div(100).mul(percentage);
    }
}