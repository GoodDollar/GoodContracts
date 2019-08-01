pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./SchemeGuard.sol";

/* @title One Time payment scheme
 * Scheme that allows address to deposit tokens for any address to withdraw
 *
 * Note that this current implementation suffers from the possibility that
 * Malicious users could frontrun any withdrawal by listening to and then 
 * copying any transaction before it is confirmed and raising gas price
 * to ensure it is picked up first. 
 */
contract OneTimePayments is SchemeGuard {
    using SafeMath for uint256;

    uint256 gasLimit;

    struct Payment {
        bool hasPayment;
        uint256 paymentAmount;
        address paymentSender;
    }

    mapping(bytes32 => Payment) payments;

    event PaymentDeposited(address indexed from, bytes32 hash, uint256 amount);
    event PaymentCancelled(address indexed from, bytes32 hash, uint256 amount);
    event PaymentWithdrawn(address indexed to, bytes32 indexed hash, uint256 amount);

    constructor(
        Avatar _avatar,
        uint256 _gasLimit
    )
        public
        SchemeGuard(_avatar)
    {
        gasLimit = _gasLimit;
    }
    
    /* @dev ERC677 on transfer function. When transferAndCall is called, the non-taxed 
     * remainder of the transfer is stored in a payment under a hash of the given data.
     * @param sender the address of the sender
     * @param value the amount to deposit
     * @param data The given hash
     */
    function onTokenTransfer(address sender, uint256 value, bytes calldata data)
        external
        onlyRegistered
        returns (bool)
    {
        bytes32 hash = abi.decode(data, (bytes32));

        require(!payments[hash].hasPayment, "Hash already in use");
        require(msg.sender == address(avatar.nativeToken()), "Only callable by this");

        payments[hash] = Payment(true, value, sender);

        emit PaymentDeposited(sender, hash, value);

        return true;
    }

    /* @dev [WIP] Withdrawal function. 
     * allows users with the original string of a hash to
     * withdraw a payment. Currently vulnerable to frontrunning
     * @pram code The string to encode into hash of payment
     */
    function withdraw(string memory code) public onlyRegistered {
        require(gasleft() < gasLimit, "Cannot exceed gas limit");

        bytes32 hash = keccak256(abi.encodePacked(code));

        require(payments[hash].hasPayment, "Hash not in use");

        uint256 value = payments[hash].paymentAmount;
        payments[hash].hasPayment = false;

        avatar.nativeToken().transfer(msg.sender, value);

        emit PaymentWithdrawn(msg.sender, hash, value);
    }

    /* @dev function to check if a payment hash is in use
     * @param hash the given bytes32 hash
     */
    function hasPayment(bytes32 hash) public view returns (bool) {
        return payments[hash].hasPayment;
    }
}
