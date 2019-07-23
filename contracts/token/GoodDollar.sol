pragma solidity ^0.5.2;

import "../identity/IdentityGuard.sol";
import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";
import "./ERC677Token.sol";

/** @title The GoodDollar contract */
contract GoodDollar is ERC677Token, IdentityGuard, MinterRole {

    address _feeRecipient;
    uint256 _txFees;

    /**
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param cap the cap of the token. no cap if 0
     * @param identity the identity contract
     * @param feeRecipient the address that recieves transaction fees
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 cap,
        Identity identity,
        address feeRecipient,
        uint256 txFees
    )
        public
        ERC677Token(name, symbol, cap)
        IdentityGuard(identity)
    {
        _feeRecipient = feeRecipient;
        _txFees = txFees;
    }

    /**
     * @dev Processes fees from given value and sends
     * remainder to given address
     * @param to the address to be sent to
     * @param value the value to be processed and then
     * transferred
     * @return a boolean that indicates if the operation was successful
     */
    function transfer(address to, uint256 value)
        public
        onlyNotBlacklisted
        requireNotBlacklisted(to)
        returns (bool)
    {
        uint256 bruttoValue = processFees(msg.sender, value);
        return super.transfer(to, bruttoValue);
    }

    /**
     * @dev Approve the passed address to spend the specified
     * amount of tokens on behalf of msg.sender
     * @param spender The address which will spend the funds
     * @param value The amount of tokens to be spent
     * @return a boolean that indicates if the operation was successful
     */
    function approve(
        address spender,
        uint256 value
    )
        public
        onlyNotBlacklisted
        requireNotBlacklisted(spender)
        returns (bool)
    {
        return super.approve(spender, value);
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param from The address which you want to send tokens from
     * @param to The address which you want to transfer to
     * @param value the amount of tokens to be transferred
     * @return a boolean that indicates if the operation was successful
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    )
        public
        onlyNotBlacklisted
        requireNotBlacklisted(from)
        requireNotBlacklisted(to)
        returns (bool)
    {
        uint256 bruttoValue = processFees(from, value);
        return super.transferFrom(from, to, bruttoValue);
    }

    function transferAndCall(address to, uint value, bytes calldata data)
        external
        onlyNotBlacklisted
        requireNotBlacklisted(to)
        returns (bool)
    {
        uint256 bruttoValue = processFees(msg.sender, value);
        return super._transferAndCall(to, bruttoValue, data);
    }

    /**
     * @dev Minting function
     * @param to the address that will receive the minted tokens
     * @param value the amount of tokens to mint
     * @return a boolean that indicated if the operation was successful
     */
    function mint(address to, uint256 value)
        public
        onlyMinter
        requireNotBlacklisted(to)
        returns (bool)
    {
        if (cap > 0)
            require(totalSupply().add(value) <= cap, "Cannot increase supply beyond cap");
        super._mint(to, value);
        return true;
    }

    /**
     * @dev Burns a specific amount of tokens.
     * @param value The amount of token to be burned.
     */
    function burn(uint256 value) public onlyNotBlacklisted {
        super.burn(value);
    }

    /**
     * @dev Burns a specific amount of tokens from the target address and decrements allowance
     * @param from address The address which you want to send tokens from
     * @param value uint256 The amount of token to be burned
     */
    function burnFrom(address from, uint256 value)
        public
        onlyNotBlacklisted
        requireNotBlacklisted(from)
    {
        super.burnFrom(from, value);
    }

    /**
     * @dev Increase the amount of tokens that an owner allows a spender
     * @param spender The address which will spend the funds
     * @param addedValue The amount of tokens to increase the allowance by
     * @return a boolean that indicated if the operation was successful
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        onlyNotBlacklisted
        requireNotBlacklisted(spender)
        returns (bool)
    {
        return super.increaseAllowance(spender, addedValue);
    }

    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender
     * @param spender The address which will spend the funds
     * @param subtractedValue The amount of tokens to decrease the allowance by
     * @return a boolean that indicated if the operation was successful
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        onlyNotBlacklisted
        requireNotBlacklisted(spender)
        returns (bool)
    {
        return super.decreaseAllowance(spender, subtractedValue);
    }

    /**
     * @dev Sets the transaction fees for transfers
     * @param txFees the value to set
     */
    function setFees(uint256 txFees)
        public
        onlyOwner
    {
        _txFees = txFees;
    }

    /**
     * @dev Gets the current transaction fees
     * @return an uint256 that represents
     * the current transaction fees
     */
    function getFees()
        public
        view
        returns (uint256)
    {
        return _txFees;
    }

    /**
     * @dev Sets the address that receives the transactional fees
     * @param feeRecipient The new address to receive transactional fees
     */
    function setFeeRecipient(address feeRecipient)
        public
        onlyOwner
    {
        _feeRecipient = feeRecipient;
    }

    /**
     * @dev Sends transactional fees to _feeRecipient address from given address
     * @param account The account that sends the fees
     * @param value The amount to subtract fees from
     * @return an uint256 that represents the given value minus the transactional fees
     */
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