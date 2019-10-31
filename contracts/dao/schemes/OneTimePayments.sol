pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./FeelessScheme.sol";

import "../../identity/escrow/Escrow.sol";

/* @title One Time payment scheme
 * Scheme that allows address to deposit tokens for any address to withdraw
 *
 * Note that this current implementation suffers from the possibility that
 * Malicious users could frontrun any withdrawal by listening to and then 
 * copying any transaction before it is confirmed and raising gas price
 * to ensure it is picked up first. 
 */
contract OneTimePayments is FeelessScheme, Escrow {
    using SafeMath for uint256;

    uint256 public gasLimit;

    struct Payment {
        bool hasPayment;
        uint256 paymentAmount;
        address paymentSender;
    }

    mapping(bytes32 => Payment) public payments;

    event PaymentDeposit(address indexed from, bytes32 hash, uint256 amount);
    event PaymentCancel(address indexed from, bytes32 hash, uint256 amount);
    event PaymentWithdraw(address indexed from, address indexed to, bytes32 indexed hash, uint256 amount);

    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _gasLimit
    )
        public
        FeelessScheme(_identity, _avatar)
    {
        gasLimit = _gasLimit;
    }
    
    function start()
        public
        onlyRegistered
    {
        addRights();
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

        emit PaymentDeposit(sender, hash, value);

        return true;
    }

    /* @dev Withdrawal function. 
     * allows users with the original string of a hash to
     * withdraw a payment. Currently vulnerable to frontrunning
     * @pram code The string to encode into hash of payment
     */
    function withdraw(string memory code) public onlyRegistered {
        require(gasleft() <= gasLimit, "Cannot exceed gas limit");
        bytes32 hash = keccak256(abi.encodePacked(code));
        uint256 value = payments[hash].paymentAmount;
        address sender = payments[hash].paymentSender;

        _withdraw(hash, value);
        emit PaymentWithdraw(sender, msg.sender, hash, value);
    }

    /* @dev Cancel function
     * allows only creator of payment to withdraw
     * @param code The string to encode into hash of payment 
     */
    function cancel(bytes32 hash) public {

        require(payments[hash].paymentSender == msg.sender, "Can only be called by creator");
        
        uint256 value = payments[hash].paymentAmount;

        _withdraw(hash, value);
        emit PaymentCancel(msg.sender, hash, value);
    }

    /* @dev Internal withdraw function
     * @param hash the hash of the payment
     * @param value the amopunt in the payment
     */
    function _withdraw(bytes32 hash, uint256 value) internal {
        require(payments[hash].hasPayment, "Hash not in use");

        payments[hash].hasPayment = false;

        avatar.nativeToken().transfer(msg.sender, value);
    }

    /* @dev function to check if a payment hash is in use
     * @param hash the given bytes32 hash
     */
    function hasPayment(bytes32 hash) public view returns (bool) {
        return payments[hash].hasPayment;
    }
}
