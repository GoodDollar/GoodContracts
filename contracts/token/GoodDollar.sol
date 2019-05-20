pragma solidity ^0.5.2;

import "@daostack/arc/contracts/controller/DAOToken.sol";
import "../identity/IdentityGuard.sol";
import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";

contract GoodDollar is DAOToken, IdentityGuard, MinterRole {

    Identity _identity;

    address _feeRecipient;
    uint256 _txFees;

    constructor(
        string memory name,
        string memory symbol,
        uint256 cap,
        Identity identity,
        address feeRecipient
    ) 
        public
        DAOToken(name, symbol, cap)
        IdentityGuard(identity)
    {
        _identity = identity;
        _feeRecipient = feeRecipient;
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
        public
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

    function setFeeRecipient(address feeRecipient)
        public
        onlyOwner
    {
        _feeRecipient = feeRecipient;
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