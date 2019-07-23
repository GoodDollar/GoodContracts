pragma solidity 0.5.4;

import "../dao/schemes/SchemeGuard.sol";

contract SchemeGuardMock is SchemeGuard {

    constructor(Avatar _avatar) public SchemeGuard(_avatar) {}

    function start() public onlyRegistered returns (bool) {
        return true;
    }

    function end() public onlyNotRegistered returns (bool) {
        return true;
    }    
}