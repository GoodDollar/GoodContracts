pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../../identity/Identity.sol";

contract OneTimePayments {
    using SafeMath for uint256;

    Avatar public avatar;
    Identity public identity;
    DAOToken private token;

    mapping(bytes32 => uint256) public paymentAmount;
    mapping(bytes32 => bool) public hashUsed;
    mapping(bytes32 => address) public paymentSender;

    event PaymentDeposited(address indexed from, bytes32 hash, uint256 amount);
    event PaymentCancelled(address indexed from, bytes32 hash, uint256 amount);
    event PaymentWithdrawn(address indexed from, address indexed to, bytes32 indexed hash, uint256 amount);

    modifier requireActive() {
        ControllerInterface controller = ControllerInterface(avatar.owner());
        require(controller.isSchemeRegistered(address(this), address(avatar)), "Scheme is not registered");
        _;
    }

    constructor(
        Avatar _avatar,
        Identity _identity
    )
        public
    {
        require(_avatar != Avatar(0), "avatar cannot be zero");
        avatar = _avatar;
        identity = _identity;
        token = avatar.nativeToken();
    }
    
    function onTokenTransfer(address sender, uint256 value, bytes calldata data)
        external
        requireActive
        returns (bool)
    {
        bytes32 hash = abi.decode(data, (bytes32));

        require(hashUsed[hash] == false, "Hash already in use");
        require(msg.sender == address(token), "Only callable by this");
        require(value > 0, "cannot deposit nothing");

        hashUsed[hash] = true;
        
        paymentAmount[hash] = value;
        paymentSender[hash] = sender;

        emit PaymentDeposited(sender, hash, value);
    }

    function withdraw(string memory code) public requireActive {
        bytes32 hash = keccak256(abi.encodePacked(code));

        require(hashUsed[hash] == true, "Hash not in use");
        require(msg.sender != address(this), 'Cannot withdraw to this');

        hashUsed[hash] = false;
        
        token.transfer(msg.sender, paymentAmount[hash]);

        emit PaymentWithdrawn(paymentSender[hash], msg.sender, hash, paymentAmount[hash]);

        paymentAmount[hash] = 0;
        paymentSender[hash] = address(0);
    }

    function hasPayment(bytes32 hash) public view returns (uint256) {
        require(hashUsed[hash] == true, "Hash not in use");

        return paymentAmount[hash];
    }
}