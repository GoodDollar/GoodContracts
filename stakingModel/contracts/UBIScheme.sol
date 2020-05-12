pragma solidity 0.5.4;

import "../../contracts/dao/schemes/UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/* @title Dynamic amount-per-day UBI scheme allowing claim once a day
 */
contract UBIScheme is AbstractUBI {
    using SafeMath for uint256;

    // result of distribution formula
    uint256 public dailyUbi = 0;

    // limits the gas for each iteration at `fishMulti`
    // and in `distribute`
    uint256 public iterationGasLimit = 300000;

    // tracking the active users number. it changes when
    // a new user claim for the first time or when a user
    // has been fished
    uint256 public activeUsersCount = 0;

    // tracking last withdraw day. withdraw occures on
    // the first daily claim or the first daily fish only
    uint256 public lastWithdrawDay = 0;

    // limits the iterations number of multiple claim.
    uint256 public maxDistributeAddresses;

    // after those days the user can be fished
    // (see `fish` notes)
    uint256 public maxInactiveDays;

    struct Funds {
        // marks if the funds for a specific day has
        // withdrawn
        bool hasWithdrawn;
        // the sum of the balance that the contract
        // had before the withdraw and the balance after
        uint256 openAmount;
    }

    // tracking the daily withdraws and the actual amount
    // at the begining of the trading day.
    mapping (uint256 => Funds) public dailyFunds;

    // marks users that have been fished to avoid of
    // double fishing
    mapping (address => bool) public fishedUsersAddresses;

    // emits when a withdraw has been succeded
    event WithdrawFromDao(address indexed caller, uint256 prevBalance, uint256 newBalance);
    // tracking users who claimed for the first time or
    // were inactive. on the first claim the user is
    // activate. from the second claim the user may recieves tokens.
    event AddedToPending(address indexed account, uint256 lastClaimed);
    // emits when a user tries to claim more than one time a day
    event AlreadyClaimed(address indexed account, uint256 lastClaimed);
    // emits when a fish has been succeded
    event UBIFished(address indexed caller, address indexed fished_account, uint256 claimAmount);
    // emits at distribute. tracks the claim requests that have
    // been accomplished
    event UBIDistributed(address indexed caller, uint256 numOfClaimers, uint256 actualClaimed);

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

    /* @dev On a daily basis UBIScheme withdraw tokens from GoodDao.
     * Emits event with caller address and last day balance and the
     * updated balance.
     */
    function _withdrawFromDao() internal
    {
        DAOToken token = avatar.nativeToken();
        uint256 prevBalance = token.balanceOf(address(this));
        uint256 toWithdraw = token.balanceOf(address(avatar));
        controller.genericCall(
            address(token),
            abi.encodeWithSignature("transfer(address,uint256)", address(this), toWithdraw),
            avatar,
            0);
        uint256 newBalance = prevBalance.add(toWithdraw);
        require(newBalance == token.balanceOf(address(this)), "DAO transfer has failed");
        Funds memory funds = dailyFunds[currentDay];
        funds.hasWithdrawn = true;
        funds.openAmount = newBalance;
        dailyFunds[currentDay] = funds;
        lastWithdrawDay = currentDay;
        emit WithdrawFromDao(msg.sender, prevBalance, newBalance);
    }

    /* @dev The claim calculation formula. Divided the daily balance with
     * the sum of the active users.
     * @return the amount of GoodDollar the user can claim
     */
    function distributionFormula(uint256 reserve, address user) internal returns(uint256)
    {
        if(lastWithdrawDay != currentDay && activeUsersCount > 0) { // once in 24 hrs pulls gd from dao
            _withdrawFromDao();
            DAOToken token = avatar.nativeToken();
            uint256 currentBalance = token.balanceOf(address(this));
            dailyUbi = currentBalance.div(activeUsersCount);
        }
        return dailyUbi;
    }

    /* @dev Sets the currentDay variable to amount of days
     * since start of contract. Internal function
     */
    function setDay() internal {
        currentDay = (now.sub(periodStart)) / 1 days;
    }

    /* @dev Checks if the given account has been owned by a registered user.
    * @param account to check
     */
    function isRegistered(address account) public view requireActive returns (bool)
    {
        uint256 lastClaimed = lastClaimed[account];
        if(lastClaimed > 0) { // the sender is not registered
            return true;
        }
        return false;
    }

    /* @dev Checks weather the given address is owned by an active user.
     * A registered user is a user that claimed at least one time. An
     * active user is a user that claimed at least one time but claimed
     * at least one time in the last `maxInactiveDays` days. A user that
     * has not claimed for `maxInactiveDays` is an inactive user.
     * @param account to check
     */
    function isActiveUser(address account) public view requireActive returns (bool)
    {
        uint256 lastClaimed = lastClaimed[account];
        if(isRegistered(account)) {
            uint256 lastClaimedDay = (lastClaimed.sub(periodStart)) / 1 days;
            if (currentDay.sub(lastClaimedDay) < maxInactiveDays) { // active user
                return true;
            }
        }
        return false;
    }

    /* @dev Function for claiming UBI. Requires contract to be active. Calls distributionFormula,
     * calculating the amount the account can claim, and transfers the amount to the account.
     * Emits the address of account and amount claimed.
     * @param claimer account
     * @return A bool indicating if UBI was claimed
     */
    function _claim(address account)
        private
        requireActive
        returns (bool)
    {
        setDay();

        // calculating the formula up today ie on day 0 there are no active users, on day 1 any user
        // (new or active) will trigger the calculation with the active users count of the day before
        // and so on. the new or inactive users that will become active today, will not take into account
        // within the calculation.
        uint256 newDistribution = distributionFormula(0, account);

        // active user which has not claimed today yet, ie user last claimed < today
        if(isRegistered(account) && !fishedUsersAddresses[account] &&
            ((lastClaimed[account].sub(periodStart)) / 1 days) < currentDay) {
            lastClaimed[account] = now;
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
        else if(!isRegistered(account) || fishedUsersAddresses[account]) { // a unregistered or fished user
            activeUsersCount = activeUsersCount.add(1);
            fishedUsersAddresses[account] = false;
            lastClaimed[account] = now; // marks last claimed as today
            emit AddedToPending(account, lastClaimed[account]);
        }
        else {
            emit AlreadyClaimed(account, lastClaimed[account]);
        }
        return false;
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

    /* @dev In order to update users from active to inactive, we give out incentive to people
     * to update the status of inactive users, this action is called "Fishing". Anyone can
     * send a tx to the contract to mark inactive users. The "fisherman" receives a reward
     * equal to the daily UBI (ie instead of the “fished” user). User that “last claimed” > 14
     * can be "fished" and made inactive (reduces active users count by one). Requires
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
        require(isRegistered(account) && !isActiveUser(account), "is not an inactive user");
        require(!fishedUsersAddresses[account], "already fished");
        fishedUsersAddresses[account] = true; // marking the account as fished so it won't refish

        // making sure that the calculation will be with the correct number of active users in case
        // that the fisher is the first to make the calculation today
        uint256 newDistribution = distributionFormula(0, account);
        activeUsersCount = activeUsersCount.sub(1);
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        token.transfer(msg.sender, newDistribution);
        Day memory day = claimDay[currentDay];
        day.amountOfClaimers = day.amountOfClaimers.add(1);
        day.claimAmount = day.claimAmount.add(newDistribution);
        claimDay[currentDay] = day;
        emit UBIFished(msg.sender, account, newDistribution);
        return true;
    }

    /* @dev executes `fish` with multiple addresses
     * @param accounts to fish
     * @return A bool indicating if all the UBIs were fished
     */
    function fishMulti(address[] memory accounts)
        public
        requireActive
        returns (bool)
    {
        require(accounts.length < gasleft().div(iterationGasLimit), "exceeds of gas limitations");
        for(uint256 i = 0; i < accounts.length; ++i) {
            fish(accounts[i]);
        }
        return true;
    }

    /* @dev Function for automate claiming UBI for users. Emits the caller address and the
     * given list length and the actual number of claimers.
     * @param accounts - claimers account list
     * @return A bool indicating if UBI was claimed
     */
    function distribute(address[] memory accounts)
        public
        requireActive
        returns (bool)
    {
        require(accounts.length < gasleft().div(iterationGasLimit), "exceeds of gas limitations");
        uint256 claimers = 0;
        for(uint256 i = 0; i < accounts.length; ++i) {
            if(identity.lastAuthenticated(accounts[i]) && _claim(accounts[i])) {
                    claimers = claimers.add(1);
            }
        }
        emit UBIDistributed(msg.sender, accounts.length, claimers);
        return true;
    }
}
