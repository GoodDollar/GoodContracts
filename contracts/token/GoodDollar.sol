pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";

import "./ERC20.sol";
import "../identity/Identity.sol";
import "../DAO.sol";

contract GoodDollar is ERC20, MinterRole, Identity {

    Identity _identity;
    DAO _dao;

    uint256 txFees;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        Identity identity,
        DAO dao
    ) 
        public
        ERC20(name, symbol, decimals)
    {
        _identity = identity;
        _dao = dao;
        addMinter(address(_dao));
    }

    function name() public view returns (string memory)
    {
        return super._name();
    }

    function symbol() public view returns (string memory)
    {
        return super._symbol();
    }

    function decimals() public view returns (uint8)
    {
        return super._decimals();
    }

    function totalSupply() public view returns (uint256)
    {
        return super._totalSupply();
    }

    function balanceOf(address account)
        public
        view
        returns (uint256)
    {
        return super._balanceOf(account);
    }

    function allowance(address owner, address spender)
        public
        view
        returns (uint256)
    {
        return super._allowance(owner, spender);
    }

    function transfer(address to, uint256 value)
        public
        onlyWhitelisted
        requireWhitelisted(to)
        returns (bool)
    {
        value = processFees(msg.sender, value);
        return super._transfer(msg.sender, to, value);
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
        return super._approve(msg.sender, spender, value);
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
        return super._transferFrom(msg.sender, from, to, value);
    }

    function mint(address to, uint256 value) 
        public
        onlyMinter
        returns (bool)
    {
        return super._mint(to, value);
    }

    function burn(uint256 value)
        public
        returns (bool)
    {
        return super._burn(msg.sender, value);
    }

    function burnFrom(address account, uint256 value)
        public
        returns (bool)
    {
        return super._burnFrom(msg.sender, account, value);
    }

    function increaseAllowance(address spender, uint256 addedValue) 
        public
        onlyWhitelisted
        requireWhitelisted(spender)
        returns (bool)
    {
        return super._increaseAllowance(msg.sender, spender, addedValue);
    }

    function DecreaseAllowance(address spender, uint256 subtractedValue) 
        public
        onlyWhitelisted
        requireWhitelisted(spender)
        returns (bool)
    {
        return super._decreaseAllowance(msg.sender, spender, subtractedValue);
    }

    function setFees(uint256 value) 
        private
        onlyMinter
    {
        txFees = value;
    }
    
    function getFees() 
        public
        view
        returns (uint256)
    {
        return txFees;
    }


    function processFees(address account, uint256 value) 
        internal
        returns (uint256)
    {
        if (account == msg.sender) {
            super._transfer(msg.sender, address(_dao), getFees());
        } else {
            super._transferFrom(msg.sender, account, address(_dao), getFees());            
        }
        return value.sub(getFees());
    }

}