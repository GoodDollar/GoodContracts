pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract Identity is Ownable {
    mapping(address => bool) private white_listed;

    uint8 public whiteListedUserCount;


    constructor() public {
        whiteListedUserCount = 1;
        white_listed[msg.sender] = true;
    }

    modifier whiteListed() {
        bool check = checkUser(msg.sender);
        require(check);
        _;
    }   
    
    function checkUser(
        address _account
    ) public view returns(bool) {
        return white_listed[_account];
    }

    /*
        whitelisted users can white list others.
    */
    function whiteListUser(
        address _account
    ) public whiteListed returns(bool) {
        white_listed[_account] = true;
        whiteListedUserCount = whiteListedUserCount + 1;
        return true;
    }

     
}
