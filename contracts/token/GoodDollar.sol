pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../identity/IdentityGuard.sol";

contract GoodDollar is ERC20Detailed, ERC20Mintable, IdentityGuard, Ownable {

    Identity _identity;

    address _feeRecipient;
    uint256 _txFees;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        Identity identity,
        address feeRecipient
    ) 
        public
        ERC20Detailed(name, symbol, decimals)
    {
        _identity = identity;
        _feeRecipient = feeRecipient;
        addMinter(feeRecipient);
    }

    function transfer(address to, uint256 value)
        public
        onlyWhitelisted
        requireWhitelisted(to)
        returns (bool)
    {
        value = processFees(msg.sender, value);
        return super.transfer(to, value);
    }

    function approve(
        address spender, 
        uint256 value
    )
        public
        onlyWhitelisted
        requireWhitelisted(spender)
        returns (bool)
    {
        return super.approve(spender, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    )
        public
        onlyWhitelisted
        requireWhitelisted(from)
        requireWhitelisted(to)
        returns (bool)
    {

        value = processFees(from, value);
        return super.transferFrom(from, to, value);
    }

    function mint(address to, uint256 value) 
        public
        onlyMinter
        requireWhitelisted(to)
        returns (bool)
    {
        return super.mint(to, value);
    }

    function increaseAllowance(address spender, uint256 addedValue) 
        public
        onlyWhitelisted
        requireWhitelisted(spender)
        returns (bool)
    {
        return super.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) 
        public
        onlyWhitelisted
        requireWhitelisted(spender)
        returns (bool)
    {
        return super.decreaseAllowance(spender, subtractedValue);
    }

    function setFees(uint256 txFees) 
        private
        onlyOwner
    {
        _txFees = txFees;
    }
    
    function getFees() 
        public
        view
        returns (uint256)
    {
        return _txFees;
    }


    function processFees(address account, uint256 value) 
        internal
        returns (uint256)
    {
        if (account == msg.sender) {
            super.transfer(_feeRecipient, getFees());
        } else {
            super.transferFrom(account, _feeRecipient, getFees());            
        }
        return value.sub(getFees());
    }
}