pragma solidity 0.5.4;

import "../../contracts/dao/schemes/UBI.sol";
import "./FirstClaimPool.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/* @title Dynamic amount-per-day UBI scheme allowing claim once a day
 */
contract UBIScheme is AbstractUBI {
    using SafeMath for uint256;

    // result of distribution formula calculated each day
    uint256 public dailyUbi = 0;

    // limits the gas for each iteration at `fishMulti`
    uint256 public iterationGasLimit = 150000;

    // tracking the active users number. it changes when
    // a new user claim for the first time or when a user
    // has been fished
    uint256 public activeUsersCount = 0;

    // tracking last withdraw day of funds from avatar. withdraw occures on
    // the first daily claim or the first daily fish only
    uint256 public lastWithdrawDay = 0;

    // how long can a user be inactive
    // after those days the user can be fished
    // (see `fish` notes)
    uint256 public maxInactiveDays;

    //a pool of G$ to give to activated users, since they will enter the UBI pool calculations
    //only in the next day, meaning they can only claim in the next day.
    FirstClaimPool firstClaimPool;
    struct Funds {
        // marks if the funds for a specific day has
        // withdrawn from avatar
        bool hasWithdrawn;
        // total GD held after withdrawing
        uint256 openAmount;
    }

    // tracking the daily withdraws and the actual amount
    // at the begining of the trading day.
    mapping(uint256 => Funds) public dailyUBIHistory;

    // marks users that have been fished to avoid
    // double fishing
    mapping(address => bool) public fishedUsersAddresses;

    // emits when a withdraw has been succeded
    event WithdrawFromDao(uint256 prevBalance, uint256 newBalance);

    // tracking users who claimed for the first time or
    // were inactive. on the first claim the user is
    // activated. from the second claim the user may recieves tokens.
    event ActivatedUser(address indexed account);

    // emits when a fish has been succeded
    event InactiveUserFished(
        address indexed caller,
        address indexed fished_account,
        uint256 claimAmount
    );

    /**
     * @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _firstClaimPool A pool for G$ to give out to activated users
     * @param _periodStart The time from when the contract can start
     * @param _periodEnd The time from when the contract can end
     * @param _maxInactiveDays Days of grace without claiming request
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        FirstClaimPool _firstClaimPool,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _maxInactiveDays
    ) public AbstractUBI(_avatar, _identity, 0, _periodStart, _periodEnd) {
        require(_maxInactiveDays > 0, "Max inactive days cannot be zero");

        maxInactiveDays = _maxInactiveDays;
        firstClaimPool = _firstClaimPool;
    }

    /* @dev On a daily basis UBIScheme withdraw tokens from GoodDao.
     * Emits event with caller address and last day balance and the
     * updated balance.
     */
    function _withdrawFromDao() internal {
        if (lastWithdrawDay != currentDay) {
            DAOToken token = avatar.nativeToken();
            uint256 prevBalance = token.balanceOf(address(this));
            uint256 toWithdraw = token.balanceOf(address(avatar));
            controller.genericCall(
                address(token),
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    address(this),
                    toWithdraw
                ),
                avatar,
                0
            );
            uint256 newBalance = prevBalance.add(toWithdraw);
            require(
                newBalance == token.balanceOf(address(this)),
                "DAO transfer has failed"
            );
            lastWithdrawDay = currentDay;
            emit WithdrawFromDao(prevBalance, newBalance);
        }
    }

    /* @dev The claim calculation formula. Divided the daily balance with
     * the sum of the active users.
     * @return the amount of GoodDollar the user can claim
     */
    function distributionFormula(uint256 reserve, address user)
        internal
        returns (uint256)
    {
        if (activeUsersCount > 0) {
            // once in 24 hrs pulls gd from dao
            if (shouldWithdrawFromDAO) _withdrawFromDao();
            DAOToken token = avatar.nativeToken();
            uint256 currentBalance = token.balanceOf(address(this));
            Funds storage funds = dailyUBIHistory[currentDay];
            funds.hasWithdrawn = shouldWithdrawFromDAO;
            funds.openAmount = currentBalance;
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
    function isNotNewUser(address account) public view returns (bool) {
        uint256 lastClaimed = lastClaimed[account];
        if (lastClaimed > 0) {
            // the sender is not registered
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
    function isActiveUser(address account) public view returns (bool) {
        uint256 lastClaimed = lastClaimed[account];
        if (isNotNewUser(account)) {
            uint256 lastClaimedDay = (lastClaimed.sub(periodStart)) / 1 days;
            if (currentDay.sub(lastClaimedDay) < maxInactiveDays) {
                // active user
                return true;
            }
        }
        return false;
    }

    /* @dev Transfers `amount` dao tokens to `account`. updates stats
     * and emits an event in case of claimed.
     * @param account the account which recieves the funds
     * @param amount the amount to transfer
     * @param isClaimed true for claimed
     */
    function _transferTokens(address account, uint256 amount, bool isClaimed)
        private
        requireActive
    {
        Day storage day = claimDay[currentDay];
        day.amountOfClaimers = day.amountOfClaimers.add(1);
        day.claimAmount = day.claimAmount.add(amount);
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        token.transfer(account, amount);
        if (isClaimed) {
            emit UBIClaimed(account, amount);
        }
    }

    /* @dev Checks amount address is eligible to claim for. regardless if they have been
     * whitelisted or not. In case the user is active, then the current day must be equal
     * to the actual day, i.e. claim or fish has already been executed today.
     * @return The amount of GoodDollar the address can claim.
     */
    function checkEntitlement() public view requireActive returns (uint256) {
        // new user or inactive should recieve the first claim reward
        if (!isNotNewUser(msg.sender) || !isActiveUser(msg.sender)) {
            return firstClaimPool.claimAmount();
        }
        // checks if the user already claimed today
        bool claimedToday = now.sub(lastClaimed[msg.sender]) < 1 days;
        // already claimed today
        if (claimedToday) {
            return 0;
        }
        // current day has already been updated which means
        // that the dailyUbi has been updated
        if (currentDay == (now.sub(periodStart)) / 1 days) {
            return dailyUbi;
        }
        // the current day has not updated yet
        DAOToken token = avatar.nativeToken();
        uint256 currentBalance = token.balanceOf(address(this));
        return currentBalance.div(activeUsersCount);
    }

    /* @dev Function for claiming UBI. Requires contract to be active. Calls distributionFormula,
     * calculating the amount the account can claim, and transfers the amount to the account.
     * Emits the address of account and amount claimed.
     * @param claimer account
     * @return A bool indicating if UBI was claimed
     */
    function _claim(address account) private returns (bool) {
        setDay();

        // calculating the formula up today ie on day 0 there are no active users, on day 1 any user
        // (new or active) will trigger the calculation with the active users count of the day before
        // and so on. the new or inactive users that will become active today, will not take into account
        // within the calculation.
        uint256 newDistribution = distributionFormula(0, account);

        // active user which has not claimed today yet, ie user last claimed < today
        if (
            isNotNewUser(account) &&
            !fishedUsersAddresses[account] &&
            ((lastClaimed[account].sub(periodStart)) / 1 days) < currentDay
        ) {
            lastClaimed[account] = now;
            claimDay[currentDay].hasClaimed[account] = true;
            _transferTokens(account, newDistribution, true);
            return true;
        } else if (!isNotNewUser(account) || fishedUsersAddresses[account]) {
            // a unregistered or fished user
            activeUsersCount = activeUsersCount.add(1);
            fishedUsersAddresses[account] = false;
            lastClaimed[account] = now; // marks last claimed as today
            uint256 awardAmount = firstClaimPool.awardUser(account);
            emit UBIClaimed(account, awardAmount);
            emit ActivatedUser(account);
            return true;
        }
        return false;
    }

    /* @dev Function for claiming UBI. Requires contract to be active and claimer to be whitelisted.
     * Calls distributionFormula, calculating the amount the caller can claim, and transfers the amount
     * to the caller. Emits the address of caller and amount claimed.
     * @return A bool indicating if UBI was claimed
     */
    function claim() public requireActive onlyWhitelisted returns (bool) {
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
    function fish(address account) public requireActive returns (bool) {
        setDay();
        require(
            isNotNewUser(account) && !isActiveUser(account),
            "is not an inactive user"
        );
        require(!fishedUsersAddresses[account], "already fished");
        fishedUsersAddresses[account] = true; // marking the account as fished so it won't refish

        // making sure that the calculation will be with the correct number of active users in case
        // that the fisher is the first to make the calculation today
        uint256 newDistribution = distributionFormula(0, account);
        activeUsersCount = activeUsersCount.sub(1);
        _transferTokens(msg.sender, newDistribution, false);
        emit InactiveUserFished(msg.sender, account, newDistribution);
        return true;
    }

    /* @dev executes `fish` with multiple addresses
     * @param accounts to fish
     * @return A bool indicating if all the UBIs were fished
     */
    function fishMulti(address[] memory accounts) public requireActive returns (uint256) {
        for (uint256 i = 0; i < accounts.length; ++i) {
            if (gasleft() < iterationGasLimit) return i;
            if (
                isNotNewUser(accounts[i]) &&
                !isActiveUser(accounts[i]) &&
                !fishedUsersAddresses[accounts[i]]
            ) {
                fish(accounts[i]);
            }
        }
        return accounts.length - 1;
    }

    /**
     * @dev Start function. Adds this contract to identity as a feeless scheme and
     * adds permissions to FirstClaimPool
     * Can only be called if scheme is registered
     */
    function start() public onlyRegistered {
        controller.genericCall(
            address(firstClaimPool),
            abi.encodeWithSignature("setUBIScheme(address)", address(this)),
            avatar,
            0
        );
        super.start();
    }
}
