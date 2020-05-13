pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract DAIMock is ERC20Detailed, ERC20Mintable, Ownable {
    constructor() public ERC20Detailed("DaiToken", "DAI", 18) {}
    function mint(uint256 amount) public returns (uint256) {
        _mint(msg.sender, amount);
        return 0;
    }
}
