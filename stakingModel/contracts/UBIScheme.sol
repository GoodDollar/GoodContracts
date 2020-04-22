pragma solidity 0.5.4;

import "../../contracts/dao/schemes/UBI.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/* @title Dynamic amount-per-day UBI scheme allowing claim once a day
 */
contract UBIScheme is AbstractUBI {
    using SafeMath for uint256;

    uint256 public dailyUbi = 0;

    uint256 public activeUsersCount = 0;

    uint256 public lastWithdrawDay = 0;

    uint256 public maxInactiveDays;

    struct Funds {
        bool hasWithdrawn;
        uint256 openAmount;
    }

    struct PendingUser {
        bool isPending;
        uint256 joinDay;
    }

    mapping (uint256 => Funds) public dailyFunds;

    mapping (address => PendingUser) public pendingUsersAddresses;

    mapping (address => bool) public activeUsersAddresses;

    event WithdrawFromDao(address caller, uint256 prevBalance, uint256 newBalance);
    event UserActivation(address account, bool isNewUser);
    event AddedToPendingList(address account, bool isNewUser);
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
        funds.openAmount = newBalance; // TODO: what if another account transfer gd to the contract
        dailyFunds[currentDay] = funds;
        lastWithdrawDay = currentDay;
        emit WithdrawFromDao(msg.sender, prevBalance, newBalance);
    }

    /* @dev The claim calculation formula. Divided the daily balance with
     * the sum of the active users.
     * @return the amount of GoodDollar the user can claim
     */
    function distributionFormula(uint256 reserve, address user) internal returns(uint256) // TODO CHECK WHAT HAPPENS IN LOWE AMOUNT - CHANGE TO 27 or check if the amount is lower than the number of claimers
    {
        if(lastWithdrawDay != currentDay) { // once in 24 hrs pulls gd from dao
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

    /* @dev Checks if the given account is in the pending list.
    * @param account to check
     */
    function isPendingUser(address account) public view requireActive returns (bool)
    {
        if(pendingUsersAddresses[account].isPending) {
            return true;
        }
        return false;
    }

    /* @dev Checks weather the given address is owned by an active user.
     * Active user is a user which is a user that claimed in the last
     * `maxInactiveDays` days. A new user that has claimed for the first
     * time becomes to an active user after `claim` function has been
     * called for the second time. As well for an inactive user.
     * @param account to check
     */
    function isActiveUser(address account) public view requireActive returns (bool)
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
     * active accounts and accounts that were been added before to
     * the pending list are eligible to claim. Adds inactive users
     * to the pending list even if the user has not been fished.
     * @param account to update
     * @return A bool indicating if the account has the privilege to claim
     */
    function _updateUserStatus(address account)
        private
        requireActive
        returns (bool)
    {
        if(isActiveUser(account)) {
            require(!claimDay[currentDay].hasClaimed[account], "has already claimed");
            return true;
        }
        if(pendingUsersAddresses[account].isPending) { // the user is in the pending list
            if(pendingUsersAddresses[account].joinDay >= currentDay) { //already claimed today
                return false;
            }
            pendingUsersAddresses[account].isPending = false; // remove the user from the pending list
            emit UserActivation(account, isNewUser(account));
            return true;
        }
        else { // add the new or inactive user to the pending list
            activeUsersAddresses[account] = true;
            activeUsersCount = activeUsersCount.add(1);
            PendingUser memory user = pendingUsersAddresses[account];
            user.isPending = true;
            user.joinDay = currentDay;
            pendingUsersAddresses[account] = user;
            emit AddedToPendingList(account, isNewUser(account));
            return false;
        }
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
        if(!_updateUserStatus(account)) {
            return false;
        }
        lastClaimed[account] = now;
        uint256 newDistribution = distributionFormula(0, account);
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
        public // TODO NOT TOO MANY TESTS, NOT CHECKING SO MANY THINGS IN EACH TEST, LOOK AT ETORO X
        requireActive
        returns (bool)
    {
        setDay();
        require(!isNewUser(account), "a new user");
        require(!isPendingUser(account), "a pending user");
        require((!identity.isWhitelisted(account) && activeUsersAddresses[account]) ||
                (identity.isWhitelisted(account) && !isActiveUser(account)), "is active or fished user");
        activeUsersAddresses[account] = false; // marking the account as inactive so it won't refish
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
    function fishingPool(address[] memory accounts)
        public
        requireActive
        returns (bool)
    {
        for(uint256 i = 0; i < accounts.length; ++i) {
            fish(accounts[i]);
        }
        return true;
    }

    /* @dev Function for automate claiming UBI for users having listed in the `dailyActivation`.
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
        for(uint256 i = 0; i < accounts.length && i < activeUsersCount; ++i) {
            if(pendingUsersAddresses[accounts[i]].isPending) {
                if(identity.isWhitelisted(accounts[i])) {
                    if(isActiveUser((accounts[i]))) { // avoids exception
                        uint256 lastClaimedDay = (lastClaimed[accounts[i]].sub(periodStart)) / 1 days;
                        if(currentDay.sub(lastClaimedDay) == 0) {
                            continue;
                        }
                    }
                    require(_claim(accounts[i]), "distributed claim was failed");
                    claimers = claimers.add(1);
                }
                pendingUsersAddresses[accounts[i]].isPending = false;
            }
        }
        emit UBIDistributed(msg.sender, accounts.length, claimers);
        return true;
    }
}
