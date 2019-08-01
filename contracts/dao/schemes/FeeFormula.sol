pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";

import "./SchemeGuard.sol";

contract FeeFormula is SchemeGuard {
    using SafeMath for uint256;

    constructor () public SchemeGuard(Avatar(0)) {}

    function getTxFees(uint256 _value) public view onlyRegistered returns (uint256) {
        return _value.div(100);
    }
}