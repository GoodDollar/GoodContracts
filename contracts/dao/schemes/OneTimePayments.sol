pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract OneTimePayments {
    using SafeMath for uint256;

    Avatar public avatar;

    struct Payment {
        bool hasPayment;
        uint256 paymentAmount;
        address paymentSender;
    }

    mapping(bytes32 => Payment) payments;

    event PaymentDeposited(address indexed from, bytes32 hash, uint256 amount);
    event PaymentCancelled(address indexed from, bytes32 hash, uint256 amount);
    event PaymentWithdrawn(address indexed to, bytes32 indexed hash, uint256 amount);

    modifier requireActive() {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        require(controller.isSchemeRegistered(address(this), address(avatar)), "Scheme is not registered");
        _;
    }

    constructor(
        Avatar _avatar
    )
        public
    {
        require(_avatar != Avatar(0), "avatar cannot be zero");
        avatar = _avatar;
    }
    
    function onTokenTransfer(address sender, uint256 value, bytes calldata data)
        external
        requireActive
        returns (bool)
    {
        bytes32 hash = abi.decode(data, (bytes32));

        require(!payments[hash].hasPayment, "Hash already in use");
        require(msg.sender == address(avatar.nativeToken()), "Only callable by this");
        require(value > 0, "cannot deposit nothing");

        payments[hash] = Payment(true, value, sender);

        emit PaymentDeposited(sender, hash, value);
    }

    function withdraw(string memory code) public requireActive {
        bytes32 hash = keccak256(abi.encodePacked(code));

        require(payments[hash].hasPayment, "Hash not in use");

        uint256 value = payments[hash].paymentAmount;
        delete payments[hash];

        avatar.nativeToken().transfer(msg.sender, value);

        emit PaymentWithdrawn(msg.sender, hash, value);
    }

    function hasPayment(bytes32 hash) public view returns (uint256) {
        require(payments[hash].hasPayment, "Hash not in use");

        return payments[hash].paymentAmount;
    }
}
