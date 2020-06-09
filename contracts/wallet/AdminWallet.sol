pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../identity/IdentityGuard.sol";
import "../dao/schemes/SignUpBonus.sol";


/* @title Admin wallet contract allowing whitelisting and topping up of
 * addresses
 */
contract AdminWallet is IdentityGuard {
    using Roles for Roles.Role;
    using SafeMath for uint256;

    Roles.Role private admins;

    address payable[] adminlist;

    SignUpBonus bonus = SignUpBonus(0);

    uint256 public toppingAmount;
    uint256 public adminToppingAmount;

    uint256 public toppingTimes;
    uint256 public currentDay;
    uint256 public periodStart;

    mapping(uint256 => mapping(address => uint256)) toppings;

    event AdminsAdded(address payable[] indexed admins);
    event AdminsRemoved(address[] indexed admins);
    event WalletTopped(address indexed user, uint256 amount);
    event GenericCall(
        address indexed _contract,
        bytes _data,
        uint256 _value,
        bool _success
    );

    constructor(
        address payable[] memory _admins,
        uint256 _toppingAmount,
        uint256 _toppingTimes,
        Identity _identity
    ) public IdentityGuard(_identity) {
        toppingAmount = _toppingAmount;
        adminToppingAmount = 1e9 * 9e6; //1gwei gas price * 9000000 gas limit
        toppingTimes = _toppingTimes;
        periodStart = now;

        if (_admins.length > 0) {
            addAdmins(_admins);
        }
    }

    /* @dev Modifier that checks if caller is admin of wallet
     */
    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "Caller is not admin");
        _;
    }

    modifier reimburseGas() {
        _;
        if (msg.sender.balance <= adminToppingAmount.div(2) && isAdmin(msg.sender)) {
            _topWallet(msg.sender);
        }
    }

    function() external payable {}

    /* @dev Internal function that sets current day
     */
    function setDay() internal {
        currentDay = (now.sub(periodStart)) / 1 days;
    }

    function setBonusContract(SignUpBonus _bonus) public onlyOwner {
        bonus = _bonus;
    }

    /* @dev Function to add list of addresses to admins
     * can only be called by creator of contract
     * @param _admins the list of addresses to add
     */
    function addAdmins(address payable[] memory _admins) public onlyOwner {
        for (uint256 i = 0; i < _admins.length; i++) {
            admins.add(_admins[i]);

            adminlist.push(_admins[i]);
        }
        emit AdminsAdded(_admins);
    }

    /* @dev Function to remove list of addresses to admins
     * can only be called by creator of contract
     * @param _admins the list of addresses to remove
     */
    function removeAdmins(address[] memory _admins) public onlyOwner {
        for (uint256 i = 0; i < _admins.length; i++) {
            admins.remove(_admins[i]);
        }
        emit AdminsRemoved(_admins);
    }

    /**
     * @dev top admins
     */
    function topAdmins(uint256 startIndex, uint256 endIndex) public reimburseGas {
        require(adminlist.length > startIndex, "Admin list is empty");
        for (uint256 i = startIndex; (i < adminlist.length && i < endIndex); i++) {
            if (adminlist[i].balance <= adminToppingAmount.div(2)) {
                _topWallet(adminlist[i]);
            }
        }
    }

    /* @dev top the first 50 admins
     */
    function topAdmins(uint256 startIndex) public reimburseGas {
        topAdmins(startIndex, startIndex + 50);
    }

    /**
     * @dev Function to check if given address is an admin
     * @param _user the address to check
     * @return A bool indicating if user is an admin
     */
    function isAdmin(address _user) public view returns (bool) {
        return admins.has(_user);
    }

    /* @dev Function to add given address to whitelist of identity contract
     * can only be done by admins of wallet and if wallet is an IdentityAdmin
     */
    function whitelist(address _user, string memory _did) public onlyAdmin reimburseGas {
        identity.addWhitelistedWithDID(_user, _did);
    }

    /* @dev Function to remove given address from whitelist of identity contract
     * can only be done by admins of wallet and if wallet is an IdentityAdmin
     */
    function removeWhitelist(address _user) public onlyAdmin reimburseGas {
        identity.removeWhitelisted(_user);
    }

    /* @dev Function to add given address to blacklist of identity contract
     * can only be done by admins of wallet and if wallet is an IdentityAdmin
     */
    function blacklist(address _user) public onlyAdmin reimburseGas {
        identity.addBlacklisted(_user);
    }

    /* @dev Function to remove given address from blacklist of identity contract
     * can only be done by admins of wallet and if wallet is an IdentityAdmin
     */
    function removeBlacklist(address _user) public onlyAdmin reimburseGas {
        identity.removeBlacklisted(_user);
    }

    /* @dev Function to top given address with amount of G$ given in constructor
     * can only be done by admin the amount of times specified in constructor per day
     * @param _user The address to transfer to
     */
    function topWallet(address payable _user) public onlyAdmin reimburseGas {
        setDay();
        require(
            toppings[currentDay][_user] < toppingTimes,
            "User wallet has been topped too many times today"
        );
        if (address(_user).balance >= toppingAmount.div(4)) return;

        _topWallet(_user);
    }

    function _topWallet(address payable _wallet) internal {
        toppings[currentDay][_wallet] += 1;
        uint256 amount = isAdmin(_wallet) ? adminToppingAmount : toppingAmount;
        uint256 toTop = amount.sub(address(_wallet).balance);
        _wallet.transfer(toTop);
        emit WalletTopped(_wallet, toTop);
    }

    /* @dev Function to whitelist user and also award him pending bonuses, it can be used also later
     * when user is already whitelisted to just award pending bonuses
     * can only be done by admin
     * @param _user The address to transfer to and whitelist
     * @param _amount the bonus amount to give
     * @param _did decentralized id of user, pointer to some profile
     */
    function whitelistAndAwardUser(
        address _user,
        uint256 _amount,
        string memory _did
    ) public onlyAdmin reimburseGas {
        require(bonus != SignUpBonus(0), "SignUp bonus has not been set yet");

        if (identity.isWhitelisted(_user) == false) {
            whitelist(_user, _did);
        }

        if (_amount > 0) {
            bonus.awardUser(_user, _amount);
        }
    }

    /**
     * @dev Function to award user with pending bonuses,
     * can only be done by admin
     * @param _user The address to transfer to and whitelist
     * @param _amount the bonus amount to give
     */
    function awardUser(address _user, uint256 _amount) public onlyAdmin reimburseGas {
        require(bonus != SignUpBonus(0), "SignUp bonus has not been set yet");
        if (_amount > 0) {
            bonus.awardUser(_user, _amount);
        }
    }

    /**
     * @dev perform a generic call to an arbitrary contract
     * @param _contract  the contract's address to call
     * @param _data ABI-encoded contract call to call `_contract` address.
     * @param _value value (ETH) to transfer with the transaction
     * @return bool    success or fail
     *         bytes - the return bytes of the called contract's function.
     */
    function genericCall(
        address _contract,
        bytes memory _data,
        uint256 _value
    ) public onlyAdmin reimburseGas returns (bool success, bytes memory returnValue) {
        // solhint-disable-next-line avoid-call-value
        (success, returnValue) = _contract.call.value(_value)(_data);
        emit GenericCall(_contract, _data, _value, success);
    }

    /**
     * @dev destroy wallet and return funds to owner
     */
    function destroy() public onlyOwner {
        selfdestruct(msg.sender);
    }
}
