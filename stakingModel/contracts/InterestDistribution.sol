pragma solidity 0.5.4;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library InterestDistribution {
    using SafeMath for uint256;

    /**
     * @dev Structure to store Interest details.
     * It contains total amount of tokens staked and total amount of interest generated.
     */

    struct InterestData {
        uint256 globalTotalStaked;
        uint256 globalGDYieldPerToken; // after donations, Precision points = 27 + 2 (G$ decimal) - (token Decimal)
        uint256 globalTotalEffectiveStake; //stake whose interest is  not donated
        uint256 gdInterestEarnedToDate;
        uint256 interestTokenEarnedToDate;
        mapping(address => Staker) stakers;
        uint256 globalGDYieldPerTokenUpdatedBlock; //keep track when we last updated yield, required for requireUpdate modifier
    }

    /**
     * @dev Structure to store staking details.
     * It contains amount of tokens staked and blocknumber at which last staked.
     */
    struct Staker {
        uint256 totalStaked;
        uint256 totalEffectiveStake; // stake after donation
        uint256 lastStake;
        uint256 withdrawnToDate;
        uint256 stakeBuyinRate;  // Precision points = 27 + 2 (G$ decimal) = 29
    }

    // 10^27
    uint256 constant DECIMAL1e27 = 10**27;

    // Calculating updateGlobalGDYieldPerTokenUpdated is required before each action
    // because the staker still has no part in the interest generated until this block.
    // Updating globalGDYieldPerToken for every stake.
    modifier requireUpdate(InterestData memory _interestData) {
        require(
            _interestData.globalGDYieldPerTokenUpdatedBlock == block.number,
            "must call updateGlobalGDYieldPerTokenUpdated before staking operations"
        );
        _;
    }

    /**
     * @dev Updates InterestData and Staker data while staking.
     * must call update globalGDYieldPerToken before this operation
     * @param _interestData           Interest data
     * @param _staker                 Staker's address
     * @param _stake                  Amount of stake
     * @param _donationPer            Percentage will to donate.
     *
     */
    function stake(
        InterestData storage _interestData,
        address _staker,
        uint256 _stake,
        uint256 _donationPer
    ) internal requireUpdate(_interestData) {
        Staker storage _stakerData = _interestData.stakers[_staker];

        uint256 currentStake = _stakerData.totalStaked;
        _stakerData.totalStaked = currentStake.add(_stake);

        uint256 effectiveStake = _stake.mul(uint256(100).sub(_donationPer)).div(
            uint256(100)
        );
        //calculate stake after donation
        _stakerData.totalEffectiveStake = _stakerData.totalEffectiveStake.add(
            effectiveStake
        );

        updateStakeBuyinRate(
            _stakerData,
            _interestData.globalGDYieldPerToken,
            effectiveStake
        );

        _interestData.globalTotalEffectiveStake = _interestData
            .globalTotalEffectiveStake
            .add(effectiveStake);

        _stakerData.lastStake = block.number;
        _interestData.globalTotalStaked = _interestData.globalTotalStaked.add(_stake);
    }

    /**
     * @dev Updates InterestData and Staker data while withdrawing stake.
     *
     * @param _interestData           Interest data
     * @param _staker                 Staker address
     * @param _amount                 Amount of stake to withdraw
     *
     * @return amount of G$ to be sent to user with same precision point as G$.
     */
    function withdrawStakeAndInterest(
        InterestData storage _interestData,
        address _staker,
        uint256 _amount
    ) internal requireUpdate(_interestData) returns (uint256) {
        Staker storage _stakerData = _interestData.stakers[_staker];

        //earned gd must be fully withdrawn on any stake withdraw
        uint256 gdInterestEarned = withdrawGDInterest(_interestData, _staker);

        uint256 avgEffectivePerStake = _stakerData.totalEffectiveStake.mul(_amount).div(
            _stakerData.totalStaked
        );
        _stakerData.totalEffectiveStake = _stakerData.totalEffectiveStake.sub(
            avgEffectivePerStake
        );

        _interestData.globalTotalEffectiveStake = _interestData
            .globalTotalEffectiveStake
            .sub(avgEffectivePerStake);

        _interestData.globalTotalStaked = _interestData.globalTotalStaked.sub(_amount);
        _stakerData.totalStaked = _stakerData.totalStaked.sub(_amount);

        return gdInterestEarned;
    }

    /**
     * @dev Updates withdrawnToDate of staker.
     *
     * @param _interestData             Interest Data
     * @param _staker                   Staker's address
     *
     * @return amount of G$ to be sent to user with same precision point as G$.
     */
    function withdrawGDInterest(InterestData storage _interestData, address _staker)
        internal
        requireUpdate(_interestData)
        returns (uint256)
    {
        Staker storage stakerData = _interestData.stakers[_staker];
        uint256 amount = calculateGDInterest(_staker, _interestData);
        stakerData.withdrawnToDate = stakerData.withdrawnToDate.add(amount);
        return amount;
    }

    /**
     * @dev Calculates GD Interest for staker for their stake.
     *
     * Formula:
     * EarnedGDInterest = MAX[TotalEfectiveStaked x AccumulatedYieldPerDAI - (StakeBuyinRate + WithdrawnToDate), 0]
     *
     * @param _staker                     Staker's address
     * @param _interestData               Interest Data
     *
     * @return _earnedGDInterest The amount of G$ credit for the staker with same precision as G$.
     */
    function calculateGDInterest(address _staker, InterestData storage _interestData)
        internal
        view
        returns (uint256 _earnedGDInterest)
    {
        Staker storage stakerData = _interestData.stakers[_staker];

        // Precision point = G$ precision = 2
        uint256 _withdrawnToDate = stakerData.withdrawnToDate;

        // Precision point = precision points of totalEffectiveStake(token decimal) 
        // + precision points of globalGDYieldPerToken[27 + 2 (G$ decimal) - (token Decimal)] = 29
        uint256 intermediateInterest = stakerData
            .totalEffectiveStake
            .mul(_interestData.globalGDYieldPerToken);

        // Multiplying DECIMAL1e27 to make _withdrawnToDate in same format as stakeBuyinRate ie., 29
        uint256 intermediateVal = _withdrawnToDate.mul(DECIMAL1e27).add(
            stakerData.stakeBuyinRate
        );

        // will lead to -ve value
        if (intermediateVal > intermediateInterest) {
            return 0;
        }

        // To reduce it to 2 precision of G$, we originally multiplied globalGDYieldPerToken by DECIMAL1e27
        _earnedGDInterest = (intermediateInterest.sub(intermediateVal)).div(
            DECIMAL1e27
        );

        return _earnedGDInterest;
    }

    /**
     * @dev Calculates and updates new accrued amount per token since last update.
     *
     * Formula:
     * AccumulatedYieldPerToken = AccumulatedYieldPerToken(P) + GDEarnedInterest/GlobalTotalEffectiveStake.
     *
     * @param _interestData              Interest Data
     * @param _blockGDInterest           Interest earned in G$ in  exchange for _blockInterestTokenEarned (after donations)
     * @param _blockInterestTokenEarned  Interest token earned (before donations)
     *
     * @return  new yield since last update with precision: 27 + 2 (G$ decimal) - (token Decimal).
     */
    function updateGlobalGDYieldPerToken(
        InterestData storage _interestData,
        uint256 _blockGDInterest,
        uint256 _blockInterestTokenEarned
    ) internal {
        //mark that it was updated
        _interestData.globalGDYieldPerTokenUpdatedBlock = block.number;
        if (_interestData.globalTotalEffectiveStake == 0) return;

         // Precision points = 27 + 2 (G$ decimal) - (token Decimal)
        _interestData.globalGDYieldPerToken = _interestData.globalGDYieldPerToken.add(
            _blockGDInterest
                .mul(DECIMAL1e27) //increase precision of G$
                .div(_interestData.globalTotalEffectiveStake) //earnings are after donations so we divide by effective stake
        );
        _interestData.interestTokenEarnedToDate = _interestData
            .interestTokenEarnedToDate
            .add(_blockInterestTokenEarned);
        _interestData.gdInterestEarnedToDate = _interestData.gdInterestEarnedToDate.add(
            _blockGDInterest
        );
    }

    /**
     * @dev Calculates and updates the GD yield rate in which the staker has entered
     * a staker may stake multiple times, so we calculate his cumulative rate his earning will be calculated based on GlobalGDYield and StakeBuyinRate
     * Formula:
     * StakeBuyinRate = [StakeBuyinRate(P) + (AccumulatedYieldPerToken(P) x EffectiveStake)]
     *
     * @param _stakerData                  Staker's Data
     * @param _globalGDYieldPerToken       Total yielding amount per token (Precision: 27 + 2 (G$ decimal) - (token Decimal))
     * @param _effectiveStake              Amount staked after donation
     *
     * @return  increase in yielding rate since last update with precision points 29.
     */
    function updateStakeBuyinRate(
        Staker storage _stakerData,
        uint256 _globalGDYieldPerToken,
        uint256 _effectiveStake
    ) internal {

      // Precision points = precision points of _globalGDYieldPerToken[27 + 2 (G$ decimal) - (token Decimal)]
      // + precision points of _effectiveStake (token Decimal) = 29
        _stakerData.stakeBuyinRate = _stakerData.stakeBuyinRate.add(
            _globalGDYieldPerToken.mul(_effectiveStake)
        );
    }
}
