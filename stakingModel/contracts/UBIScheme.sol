pragma solidity 0.5.4;

import "../../contracts/dao/schemes/UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/* @title Fixed amount-per-day UBI scheme allowing multiple claims
 * during a longer period
 */
contract UBIScheme is AbstractUBI {
    using SafeMath for uint256;

    uint256 public dailyClaimersCount = 0;

    uint256 public activeUsersCount = 0;

    uint256 public lastWithdrawDay = 0;

    uint256 public maxInactiveDays;

    struct Funds {
        bool hasWithdrawn;
        uint256 openAmount;
    }

    struct Distributed {
        bool isEntitled;
        bool isCompleted;
    }

    mapping (uint256 => Funds) dailyFunds;

    mapping (uint256 => uint256) fishermanCount;

    mapping (uint256 => uint256) nextDayDistributionCount;

    mapping (uint256 => mapping (address => Distributed)) nextDayDistributionAddresses;

    mapping (address => bool) activeUsersAddresses;

    event WithdrawFromDao(address caller, uint256 lastDayBalance, uint256 updatedBalance);
    event UserActivation(address account, bool isNewUser);
    event AddedToNextDay(address account, bool isNewUser);
    event UBIFished(address caller, address fished_account, uint256 claimAmount);
    event UBIDistributed(address caller, uint256 numOfClaimers, uint256 actualClaimed);

    /* @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _initialReserve The initial amount to transfer to this contract
     * @param _periodStart The time from when the contract can start
     * @param _periodEnd The time from when the contract can end
     * @param _maxInactiveDays Days of grace without claiming request
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        uint256 _initialReserve,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _maxInactiveDays
    )
        public
        AbstractUBI(_avatar, _identity, _initialReserve, _periodStart, _periodEnd)
    {
        require(_maxInactiveDays > 0, "Max inactive days cannot be zero");

        maxInactiveDays = _maxInactiveDays;
    }

    function start() public onlyRegistered {
        super.start();
        setDay();
        _withdrawFromDao();
        DAOToken token = avatar.nativeToken();
        emit UBIStarted(token.balanceOf(address(this)), now);
    }

    /* @dev On a daily basis UBIScheme withdraw tokens from GoodDao.
     * Emits event with caller address and last day balance and the
     * updated balance.
     */
    function _withdrawFromDao() internal
    {
        DAOToken token = avatar.nativeToken();
        uint256 lastDayBalance = (dailyFunds[currentDay.sub(1)].openAmount).sub(claimDay[currentDay.sub(1)].claimAmount);
        require(lastDayBalance == token.balanceOf(address(this)), "Balance does not match with stats");
        uint256 toWithdraw = token.balanceOf(address(avatar));
        controller.genericCall(
            address(token),
            abi.encodeWithSignature("transfer(address,uint256)", address(this), toWithdraw),
            avatar,
            0);
        uint256 balance = lastDayBalance.add(toWithdraw);
        require(balance == token.balanceOf(address(this)), "DAO transfer has failed");
        Funds memory funds = dailyFunds[currentDay];
        funds.hasWithdrawn = true;
        funds.openAmount = balance;
        dailyFunds[currentDay] = funds;
        lastWithdrawDay = currentDay;
        emit WithdrawFromDao(msg.sender, lastDayBalance, balance);
    }

    /* @dev The claim calculation formula. Divided the daily balance with
     * the sum of the active users and today distribution list and with
     * today fishermen count.
     * @return the amount of GoodDollar the user can claim
     */
    function distributionFormula() internal returns(uint256)
    {
        if(lastWithdrawDay != currentDay) { // once in 24 hrs pulls gd from dao
            _withdrawFromDao();
        }
        uint256 dailyDistribution = nextDayDistributionCount[currentDay]; // starts from second day which is 1
        uint256 dailyUbi = dailyFunds[currentDay].openAmount.div(activeUsersCount.add(dailyDistribution).add(fishermanCount[currentDay]));

        return dailyUbi;
    }

    /* @dev Sets the currentDay variable to amount of days
     * since start of contract. Internal function
     */
    function setDay() internal {
        currentDay = (now.sub(periodStart)) / 1 days;
    }

    function checkNextDayCompleted(address account) public view requireActive returns (bool) {
        if(nextDayDistributionAddresses[currentDay][account].isCompleted) { // the user claimed yesterday and could become active
            return true;
        }
        return false;
    }

    /* @dev Checks if the given address has entitled to become
     * to active.
     * @param account to check
     * @return Weather the address is entitled or not
     */
    function checkNextDayEntitlement(address account) public view requireActive returns (bool) {
        if(nextDayDistributionAddresses[currentDay][account].isEntitled) { // the user claimed yesterday and could become active
            return true;
        }
        return false;
    }

    /* @dev Checks if the given account has been owned by a new user.
    * @param account to check
     */
    function isNewUser(address account) public view requireActive returns (bool)
    {
        uint256 lastClaimed = lastClaimed[account];
        if(lastClaimed > 0) { // the sender is not a new user
            return false;
        }
        return true;
    }

    /* @dev Checks weather the given address is owned by an active user.
     * Active user is a user which is a user that claimed in the last
     * `maxInactiveDays` days. A new user that has claimed for the first
     * time becomes to an active user after `claim` function has been
     * called for the second time.
     * @param account to check
     */
    function checkActiveEntitlement(address account) public view requireActive returns (bool)
    {
        uint256 lastClaimed = lastClaimed[account];
        if(!isNewUser(account)) {
            uint256 lastClaimedDay = (lastClaimed.sub(periodStart)) / 1 days;
            if (currentDay.sub(lastClaimedDay) < maxInactiveDays) { // active user
                return true;
            }
        }
        return false;
    }

    /* @dev Checks if the account has the privilege to claim. Only
     * active accounts and new accounts that were been added the day
     * before to the distribution list are eligible to claim.
     * @param account to update
     * @return A bool indicating if the account has the privilege to claim
     */
    function _checkEntitlement(address account)
        private
        requireActive
        onlyWhitelisted
        returns (bool)
    {
        if(!checkActiveEntitlement(account)) { // the user is not active
            if(checkNextDayEntitlement(account)) { // the user become to active
                nextDayDistributionCount[currentDay] = nextDayDistributionCount[currentDay].sub(1);
                activeUsersCount = activeUsersCount.add(1);
                activeUsersAddresses[account] = true; // could not be fished
                emit UserActivation(account, isNewUser(account)); // account and new or inactive
            }
            else { // the user has not last day entitlement
                require(!nextDayDistributionAddresses[currentDay.add(1)][account].isEntitled, "has already added to the next day");
                nextDayDistributionCount[currentDay.add(1)] = nextDayDistributionCount[currentDay.add(1)].add(1);
                nextDayDistributionAddresses[currentDay.add(1)][account].isEntitled = true; // append the user to the next day distribution list
                emit AddedToNextDay(account, isNewUser(account)); // account and new or inactive
                return false;
            }
        }
        require(!claimDay[currentDay].hasClaimed[account], "has already claimed");
        return true;
    }

    /* @dev Function for claiming UBI. Requires contract to be active and claimer to be whitelisted.
     * Calls distributionFormula, calculating the amount the account can claim, and transfers the amount
     * to the account. Emits the address of account and amount claimed.
     * @param claimer account
     * @return A bool indicating if UBI was claimed
     */
    function _claim(address account)
        private
        requireActive
        onlyWhitelisted
        returns (bool)
    {
        setDay();
        if(!_checkEntitlement(account)) {
            return false;
        }
        lastClaimed[account] = now;
        uint256 newDistribution = distributionFormula();
        claimDay[currentDay].hasClaimed[account] = true;
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        token.transfer(account, newDistribution);
        Day memory day = claimDay[currentDay];
        day.amountOfClaimers = day.amountOfClaimers.add(1);
        day.claimAmount = day.claimAmount.add(newDistribution);
        claimDay[currentDay] = day;
        emit UBIClaimed(account, newDistribution);
        return true;
    }

    /* @dev Function for claiming UBI. Requires contract to be active and claimer to be whitelisted.
     * Calls distributionFormula, calculating the amount the caller can claim, and transfers the amount
     * to the caller. Emits the address of caller and amount claimed.
     * @return A bool indicating if UBI was claimed
     */
    function claim()
        public
        requireActive
        onlyWhitelisted
        returns (bool)
    {
        return _claim(msg.sender);
    }

    /* @dev In Order to update users from active to inactive, we give out incentive to people
     * to update the status of inactive users, this action is called “Fishing”. Anyone can
     * send a tx to the contract to mark inactive users. The “fisherman” receives a reward
     * equal to the daily UBI (ie instead of the “fished” user). User that “last claimed” > 14
     * can be “fished” and made inactive (reduces active users count by one). Requires
     * contract to be active.
     * @param account to fish
     * @return A bool indicating if UBI was fished
     */
    function fish(address account)
        public
        requireActive
        returns (bool)
    {
        setDay();
        require(identity.isWhitelisted(account), "is not whitelisted");
        require(!isNewUser(account), "a new user");
        require(checkActiveEntitlement(account), "an active user");
        require(activeUsersAddresses[account], "has already fished");
        activeUsersAddresses[account] = false; // marking the account as inactive so it won't refish
        activeUsersCount = activeUsersCount.sub(1);
        fishermanCount[currentDay] = fishermanCount[currentDay].add(1);
        uint256 newDistribution = distributionFormula();
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        token.transfer(msg.sender, newDistribution);
        Day memory day = claimDay[currentDay];
        day.amountOfClaimers = day.amountOfClaimers.add(1);
        day.claimAmount = day.claimAmount.add(newDistribution);
        claimDay[currentDay] = day;
        emit UBIFished(msg.sender, account, newDistribution);
        return true;
    }


    /* @dev Function for automate claiming UBI for users having listed in the `nextDayDistribution`.
     * Emits the caller address and the given list length and the actual number of claimers.
     * @param accounts - claimers account list
     * @return A bool indicating if UBI was claimed
     */
    function distribute(address[] memory accounts)
        public
        requireActive
        returns (bool)
    {
        uint256 claimers = 0;
        for(uint256 i = 0; i < accounts.length && i < nextDayDistributionCount[currentDay]; ++i) {
            if (nextDayDistributionAddresses[currentDay][accounts[i]].isEntitled &&
                !nextDayDistributionAddresses[currentDay][accounts[i]].isCompleted) { // avoiding of double claiming
                nextDayDistributionAddresses[currentDay][accounts[i]].isCompleted = true;
                require(_claim(accounts[i]), "distributed claim was failed");
                claimers = claimers.add(1);
            }
        }
        emit UBIDistributed(msg.sender, accounts.length, claimers);
        return true;
    }
}
