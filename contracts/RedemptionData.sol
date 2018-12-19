pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract RedemptionData is Ownable {
    mapping(address => uint256) private last_claimed;


    event SetClaim(address indexed Account, uint256 Time);

    constructor() public {
    }

    function getLastClaimed(
        address _account
    ) public view onlyOwner returns(uint256) {
        return last_claimed[_account]; 
    }

    function setLastClaimed(
        address _account
    ) public onlyOwner returns(bool) {
        last_claimed[_account] = now;
        return true;
    }
    
}
