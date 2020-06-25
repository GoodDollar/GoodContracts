pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/dao/schemes/ActivePeriod.sol";
import "./GoodReserveCDai.sol";


interface StakingContract {
    function collectUBIInterest(address recipient)
        external
        returns (uint256, uint256, uint256, uint32);
}


/**
 * @title GoodFundManager contract that transfer interest from the staking contract
 * to the reserve contract and transfer the return mintable tokens to the staking
 * contract
 * cDAI support only
 */
contract GoodFundManager is FeelessScheme, ActivePeriod {
    using SafeMath for uint256;

    // The address of cDai
    ERC20 public cDai;

    // The address of the reserve contract
    // which recieves the funds from the
    // staking contract
    GoodReserveCDai public reserve;

    // The address of the bridge contract
    // which transfers in his turn the
    // UBI funds to the given recipient
    // address on the sidechain
    address public bridgeContract;

    // The recipient address on the
    // sidechain. The bridge transfers
    // the funds to the following address
    address public ubiRecipient;

    // Determines how many blocks should
    // be passed before the next
    // execution of `transferInterest`
    uint256 public blockInterval;

    // Last block number which `transferInterest`
    // has been executed in
    uint256 public lastTransferred;

    // Emits when `transferInterest` transfers
    // funds to the staking contract and to
    // the bridge
    event FundsTransferred(
        // The caller address
        address indexed caller,
        // The staking contract address
        address indexed staking,
        // The reserve contract address
        address indexed reserve,
        // Amount of cDai that was transferred
        // from the staking contract to the
        // reserve contract
        uint256 cDAIinterestEarned,
        // How much interest has been donated
        // according to the given donation
        // ratio which determined in the
        // staking contract
        uint256 cDAIinterestDonated,
        // The number of tokens that have been minted
        // by the reserve to the staking contract
        uint256 gdInterest,
        // The number of tokens that have been minted
        // by the reserve to the bridge which in his
        // turn should transfer those funds to the
        // sidechain
        uint256 gdUBI
    );

    modifier reserveHasInitialized {
        require(address(reserve) != address(0), "reserve has not initialized");
        _;
    }

    /**
     * @dev Constructor
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _cDai The address of cDai
     * @param _bridgeContract The address of the bridge contract
     * @param _ubiRecipient The recipient address on the sidechain
     * @param _blockInterval How many blocks should be passed before the next execution of `transferInterest
     */
    constructor(
        Avatar _avatar,
        Identity _identity,
        address _cDai,
        address _bridgeContract,
        address _ubiRecipient,
        uint256 _blockInterval
    )
        public
        FeelessScheme(_identity, _avatar)
        ActivePeriod(now, now * 2, _avatar)
    {
        cDai = ERC20(_cDai);
        bridgeContract = _bridgeContract;
        ubiRecipient = _ubiRecipient;
        blockInterval = _blockInterval;
        lastTransferred = block.number.div(blockInterval);
    }

    /* @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered
     */
    function start() public onlyRegistered {
        addRights();
        super.start();
    }

    /**
     * @dev Sets the whitelisted reserve. Only Avatar
     * can call this method.
     * @param _reserve The new reserve to be whitelisted
     */
    function setReserve(GoodReserveCDai _reserve) public onlyAvatar {
        reserve = _reserve;
    }

    /**
     * @dev sets the token bridge address on mainnet and the recipient of minted UBI (avatar on sidechain)
     * @param _bridgeContract address
     * @param _recipient address
     */

    /**
     * @dev Sets the bridge address on the current network and the recipient
     * address on the sidechain. Only Avatar can call this method.
     * @param _bridgeContract The new bridge address
     * @param _recipient The new recipient address (NOTICE: this address may be a
     * sidechain address)
     */
    function setBridgeAndUBIRecipient(
        address _bridgeContract,
        address _recipient
    )
        public
        onlyAvatar
    {
        bridgeContract = _bridgeContract;
        ubiRecipient = _recipient;
    }

    /**
     * @dev Allows the DAO to change the block interval
     * @param _blockInterval the new interval value
     */
    function setBlockInterval(
        uint256 _blockInterval
    )
        public
        onlyAvatar
    {
        blockInterval = _blockInterval;
    }

    /**
     * @dev Checks if enough time has passed away since the
     * last funds transfer time
     * @return (bool) True if enough time has passed
     */
    function canRun() public view returns(bool)
    {
        return block.number.div(blockInterval) > lastTransferred;
    }

    /**
     * @dev Collects UBI interest in cDai from a given staking contract and transfers
     * that interest to the reserve contract. Then transfers the given gd which
     * received from the reserve contract back to the staking contract and to the
     * bridge, which locks the funds and then the GD tokens are been minted to the
     * given address on the sidechain
     * @param _staking Contract that implements `collectUBIInterest` and transfer cDai to
     * a given address. The given address should be the same whitelisted `reserve`
     * address in the current contract, in case that the given staking contract transfers
     * the funds to another contract, zero GD tokens will be minted by the reserve contract.
     * Emits `FundsTransferred` event in case which interest has been passed to the `reserve`
     */
    function transferInterest(StakingContract _staking)
        public
        requireActive
        reserveHasInitialized
        requireDAOContract(address(_staking))
    {
        require(
            canRun(),
            "Need to wait for the next interval"
        );

        lastTransferred = block.number.div(blockInterval);

        // cDai balance of the reserve contract
        uint256 currentBalance = cDai.balanceOf(address(reserve));

        // Collects the interest from the staking contract and transfers
        // it directly to the reserve contract. `collectUBIInterest` returns
        // (cdaigains, daigains, precission loss, donation ratio)
        (, , , uint32 donationRatio) = _staking.collectUBIInterest(
            address(reserve)
        );

        // Finds the actual transferred cDai
        uint256 interest = cDai.balanceOf(address(reserve)).sub(
            currentBalance
        );

        if (interest > 0) {
            uint256 interestDonated = interest.mul(donationRatio).div(1e6);
            uint256 afterDonation = interest.sub(interestDonated);

            // Mints GD while the interest amount is equal to the transferred amount
            (uint256 gdInterest, uint256 gdUBI) = reserve.mintInterestAndUBI(
                cDai,
                interest,
                afterDonation
            );

            // Transfers the minted tokens to the given staking contract
            GoodDollar token = GoodDollar(address(avatar.nativeToken()));
            if(gdInterest > 0 )
                require(token.transfer(address(_staking), gdInterest),"interest transfer failed");
            if(gdUBI > 0)
                // Transfers UBI to avatar on sidechain via bridge
                require(token.transferAndCall(
                    bridgeContract,
                    gdUBI,
                    abi.encodePacked(ubiRecipient)
                ),"ubi bridge transfer failed");
            emit FundsTransferred(
                msg.sender,
                address(_staking),
                address(reserve),
                interest,
                interestDonated,
                gdInterest,
                gdUBI
            );
        }
    }

    /**
     * @dev Making the contract inactive after it has transferred funds to `_avatar`.
     * Only the avatar can destroy the contract.
     */
    function end() public onlyAvatar {
        // Transfers the remaining amount of cDai and GD to the avatar
        uint256 remainingCDaiReserve = cDai.balanceOf(address(this));
        if (remainingCDaiReserve > 0) {
            require(cDai.transfer(address(avatar), remainingCDaiReserve),"cdai transfer failed");
        }
        GoodDollar token = GoodDollar(address(avatar.nativeToken()));
        uint256 remainingGDReserve = token.balanceOf(address(this));
        if (remainingGDReserve > 0) {
            require(token.transfer(address(avatar), remainingGDReserve),"gd transfer failed");
        }
        super.internalEnd(avatar);
    }
}
