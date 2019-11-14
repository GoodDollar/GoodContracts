
pragma solidity ^0.5.4;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../identity/Identity.sol";
import "../dao/schemes/SignUpBonus.sol";

/* @title Admin wallet contract allowing whitelisting and topping up of
 * addresses
 */
contract AdminWallet is Ownable {
    using Roles for Roles.Role;
    using SafeMath for uint256;

    Roles.Role private admins;

    address payable[] adminlist;

    Identity identity;

    SignUpBonus bonus = SignUpBonus(0);

    uint256 public toppingAmount;
    
    uint public toppingTimes;
    uint public lastCalc;

    mapping(uint => mapping(address => uint)) toppings;

    event AdminsAdded(address payable[] indexed admins);
    event AdminsRemoved(address[] indexed admins);
    event WalletTopped(address indexed user);

    constructor (
        address payable[] memory _admins,
        uint256 _toppingAmount,
        uint _toppingTimes,
        Identity _identity
    )
        public 
    {
        identity = _identity;

        toppingAmount = _toppingAmount;
        toppingTimes = _toppingTimes;

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
        if (msg.sender.balance <= toppingAmount.div(4)) { 
            toppings[lastCalc][msg.sender] += 1;
            msg.sender.transfer(toppingAmount.sub(msg.sender.balance));
        }
    }

    function () external payable {}

    /* @dev Internal function that sets current day
     */
    function setDay() internal {
        uint dayDiff = now.sub(lastCalc) / 1 days;
        
        if (dayDiff >= 1) {
            lastCalc = now;
        }
    }

    function setBonusContract(SignUpBonus _bonus) public onlyOwner {
        bonus = _bonus;
    }

    /* @dev Function to add list of addresses to admins
     * can only be called by creator of contract
     * @param _admins the list of addresses to add
     */
    function addAdmins(address payable[] memory _admins) public onlyOwner {
        for (uint i = 0; i < _admins.length; i++) {
            admins.add(_admins[i]);
            
            adminlist.push(_admins[i]);
        }
        emit AdminsAdded(_admins);
    }

    /* @dev Function to remove list of addresses to admins
     * can only be called byu creator of contract
     * @param _admins the list of addresses to remove
     */
    function removeAdmins(address[] memory _admins) public onlyOwner {
        for (uint i = 0; i < _admins.length; i++) {
            admins.remove(_admins[i]);
        }
        emit AdminsRemoved(_admins);
    }

    /* @dev top the first 50 admins
     */
    function topAdmins(uint256 startIndex) public onlyOwner {
        require(adminlist.length > startIndex, "Admin list is empty");
        for (uint i = startIndex; (i < adminlist.length && i < startIndex + 50); i++) {
            if (adminlist[i].balance <= toppingAmount.div(4)) {
                _topWallet(adminlist[i]);
            }
        }
    }

    /* @dev Function to check if given address is an admin
     * @param _user the address to check
     * @returns A bool indicating if user is an admin 
     */
    function isAdmin(address _user) public view returns(bool) {
        return admins.has(_user);
    }

    /* @dev Function to add given address to whitelist of identity contract
     * can only be done by admins of wallet and if wallet is an IdentityAdmin
     */
    function whitelist(address _user) public onlyAdmin reimburseGas {
        identity.addWhitelisted(_user);
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
        require(toppings[lastCalc][_user] < toppingTimes, "User wallet has been topped too many times today");
        require(address(_user).balance <= toppingAmount.div(4), "User balance too high");

        _topWallet(_user);
    }

    function _topWallet(address payable _wallet) internal {
        toppings[lastCalc][_wallet] += 1;
        _wallet.transfer(toppingAmount.sub(address(_wallet).balance));
        emit WalletTopped(_wallet);
    }

    /* @dev Function to whitelist user and also award him pending bonuses, it can be used also later
     * when user is already whitelisted to just award pending bonuses
     * can only be done by admin
     * @param _user The address to transfer to and whitelist
     * @param _amount the bonus amount to give 
     */
    function whitelistAndAwardUser(address _user, uint256 _amount) public onlyAdmin reimburseGas {
        require(bonus != SignUpBonus(0), "SignUp bonus has not been set yet");

        if(identity.isWhitelisted(_user) == false) {
            whitelist(_user);
        }
        
        if(_amount > 0) {
            bonus.awardUser(_user, _amount);
        }
    }
}
