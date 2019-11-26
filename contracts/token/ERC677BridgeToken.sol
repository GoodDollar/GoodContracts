pragma solidity 0.5.4;

import "./ERC677Token.sol";

import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";

contract ERC677BridgeToken is ERC677Token, MinterRole {

    address public bridgeContract;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _cap
    )
        public
        ERC677Token(_name, _symbol, _cap)
    {}

    function setBridgeContract(address _bridgeContract) onlyMinter public {
        require(_bridgeContract != address(0) && isContract(_bridgeContract), "Invalid bridge contract");
        bridgeContract = _bridgeContract;
    }
}