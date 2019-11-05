pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

import "./FeelessScheme.sol";
import "../../identity/escrow/interfaces/IRegistry.sol";

/* @title One Time payment scheme
 * Scheme that allows address to deposit tokens for any address to withdraw
 *
 * Note that this current implementation suffers from the possibility that
 * Malicious users could frontrun any withdrawal by listening to and then 
 * copying any transaction before it is confirmed and raising gas price
 * to ensure it is picked up first. 
 */
contract OneTimePayments is FeelessScheme, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public gasLimit;

    struct Payment {
        bool hasPayment;
        uint256 paymentAmount;
        address paymentSender;
        address identifier;
        uint256 sentIndex;
        uint256 receivedIndex;
        uint256 timestamp;
    }

    mapping(bytes32 => Payment) public payments;

    // Maps receivers' identifiers to a list of received escrowed payment IDs.
    mapping(bytes32 => address[]) public receivedPaymentIds;

    // Maps senders' addresses to a list of sent escrowed payment IDs.
    mapping(address => address[]) public sentPaymentIds;

    IRegistry public registry;
    bytes32 constant ATTESTATIONS_REGISTRY_ID = keccak256(abi.encodePacked("Attestations"));

    event PaymentDeposit(address indexed from, bytes32 hash, uint256 amount, address paymentId, uint256 minAttestations);
    event PaymentCancel(address indexed from, bytes32 hash, uint256 amount, address paymentId);
    event PaymentWithdraw(address indexed from, address indexed to, bytes32 indexed hash, uint256 amount, address paymentId);

    event RegistrySet(address indexed registryAddress);

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
    
    function start(address registryAddress)
        public
        onlyRegistered
    {
        addRights();
        registry = IRegistry(registryAddress);
        emit RegistrySet(registryAddress);
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
        nonReentrant
        returns (bool)
    {
        bytes32 hash;
        address paymentId;
        uint256 minAttestations;
        (hash, paymentId, minAttestations) = abi.decode(data, (bytes32, address, uint256));

        require(!payments[hash].hasPayment, "Hash already in use");
        require(msg.sender == address(avatar.nativeToken()), "Only callable by this");

        uint256 sentIndex = sentPaymentIds[sender].push(paymentId).sub(1);
        uint256 receivedIndex = receivedPaymentIds[hash].push(paymentId).sub(1);

        Payment storage newPayment = payments[hash];
        newPayment.hasPayment = true;
        newPayment.paymentAmount = value;
        newPayment.paymentSender = sender;

        newPayment.sentIndex = sentIndex;
        newPayment.receivedIndex = receivedIndex;
        newPayment.timestamp = now;

        emit PaymentDeposit(sender, hash, value, paymentId, minAttestations);        
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
