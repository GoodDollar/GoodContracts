pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "@daostack/arc/contracts/controller/Avatar.sol";
import "../../contracts/dao/schemes/FeelessScheme.sol";
import "../../contracts/dao/schemes/ActivePeriod.sol";
import "../../contracts/DSMath.sol";
import "../../contracts/token/GoodDollar.sol";
import "./GoodMarketMaker.sol";

interface cERC20 {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 mintAmount) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}

interface ContributionCalc {
    function calculateContribution(
        GoodMarketMaker _marketMaker,
        GoodReserveCDai _reserve,
        address _contributer,
        ERC20 _token,
        uint256 _gdAmount
    ) external view returns (uint256);
}

/**
@title Reserve based on cDAI and dynamic reserve ratio market maker
*/
contract GoodReserveCDai is DSMath, FeelessScheme, ActivePeriod {
    using SafeMath for uint256;

    // DAI token address
    ERC20 public dai;

    // cDAI token address
    cERC20 public cDai;

    // The address of the market maker contract
    // which makes the calculations and holds
    // the token and accounts info
    GoodMarketMaker public marketMaker;

    // The fund manager receives the minted tokens
    // when executing `mintInterestAndUBI`
    address public fundManager;

    // The block interval defines the number of
    // blocks that shall be passed before the
    // next execution of `mintInterestAndUBI`
    uint256 public blockInterval;

    // The last block number which
    // `mintInterestAndUBI` has been executed in
    uint256 public lastMinted;

    // The contribution contract is responsible
    // for calculates the contribution amount
    // when selling GD
    ContributionCalc public contribution;

    modifier onlyFundManager {
        require(msg.sender == fundManager, "Only FundManager can call this method");
        _;
    }

    modifier onlyActiveToken(ERC20 _token) {
        (, , uint256 gdSupply) = marketMaker.reserveTokens(address(_token));
        require(gdSupply > 0, "Only active tokens are supported");
        _;
    }

    // Emits when GD tokens are purchased
    event TokenPurchased(
        // The initiate of the action
        address indexed caller,
        // The convertible token address
        // which the GD tokens were
        // purchased with
        address indexed reserveToken,
        // Reserve tokens amount
        uint256 reserveAmount,
        // Minimal GD return that was
        // permitted by the caller
        uint256 minReturn,
        // Actual return after the
        // conversion
        uint256 actualReturn
    );

    // Emits when GD tokens are sold
    event TokenSold(
        // The initiate of the action
        address indexed caller,
        // The convertible token address
        // which the GD tokens were
        // sold to
        address indexed reserveToken,
        // GD tokens amount
        uint256 gdAmount,
        // The amount of GD tokens that
        // was contributed during the
        // conversion
        uint256 contributionAmount,
        // Minimal reserve tokens return
        // that was permitted by the caller
        uint256 minReturn,
        // Actual return after the
        // conversion
        uint256 actualReturn
    );

    // Emits when the contribution contract
    // address is updated
    event ContributionAddressUpdated(
        // The initiate of the action
        address indexed caller,
        // Previous contribution
        // contract address
        address prevAddress,
        // The updated contribution
        // contract address
        address newAddress
    );

    // Emits when new GD tokens minted
    event UBIMinted(
        //epoch of UBI
        uint256 indexed day,
        //the token paid as interest
        address indexed interestToken,
        //wei amount of interest paid in interestToken
        uint256 interestReceived,
        // Amount of GD tokens that was
        // added to the supply as a result
        // of `mintInterest`
        uint256 gdInterestMinted,
        // Amount of GD tokens that was
        // added to the supply as a result
        // of `mintExpansion`
        uint256 gdExpansionMinted,
        // Amount of GD tokens that was
        // minted to the `interestCollector`
        uint256 gdInterestTransferred,
        // Amount of GD tokens that was
        // minted to the `ubiCollector`
        uint256 gdUbiTransferred
    );

    /**
     * @dev Constructor
     * @param _dai The address of DAI
     * @param _cDai The address of cDAI
     * @param _fundManager The address of the fund manager contract
     * @param _avatar The avatar of the DAO
     * @param _identity The identity contract
     * @param _marketMaker The address of the market maker contract
     * @param _contribution The address of the contribution contract
     * @param _blockInterval How many blocks should be passed before the next execution of `mintInterestAndUBI`
     */
    constructor(
        ERC20 _dai,
        cERC20 _cDai,
        address _fundManager,
        Avatar _avatar,
        Identity _identity,
        address _marketMaker,
        ContributionCalc _contribution,
        uint256 _blockInterval
    ) public FeelessScheme(_identity, _avatar) ActivePeriod(now, now * 2, _avatar) {
        dai = _dai;
        cDai = _cDai;
        fundManager = _fundManager;
        marketMaker = GoodMarketMaker(_marketMaker);
        blockInterval = _blockInterval;
        lastMinted = block.number.div(blockInterval);
        contribution = _contribution;
    }

    /**
     * @dev Start function. Adds this contract to identity as a feeless scheme.
     * Can only be called if scheme is registered
     */
    function start() public onlyRegistered {
        addRights();

        // Adds the reserve as a minter of the GD token
        controller.genericCall(
            address(avatar.nativeToken()),
            abi.encodeWithSignature("addMinter(address)", address(this)),
            avatar,
            0
        );
        super.start();
    }

    /**
     * @dev Allows the DAO to change the market maker contract
     * @param _marketMaker address of the new contract
     */
    function setMarketMaker(address _marketMaker) public onlyAvatar {
        marketMaker = GoodMarketMaker(_marketMaker);
    }

    /**
     * @dev Allows the DAO to change the fund manager contract
     * @param _fundManager address of the new contract
     */
    function setFundManager(address _fundManager) public onlyAvatar {
        fundManager = _fundManager;
    }

    /**
     * @dev Allows the DAO to change the block interval
     * @param _blockInterval the new value
     */
    function setBlockInterval(uint256 _blockInterval) public onlyAvatar {
        blockInterval = _blockInterval;
    }

    /**
     * @dev Allows the DAO to change the contribution formula contract
     * @param _contribution address of the new contribution contract
     */
    function setContributionAddress(address _contribution) public onlyAvatar {
        address prevAddress = address(contribution);
        contribution = ContributionCalc(_contribution);
        emit ContributionAddressUpdated(msg.sender, prevAddress, _contribution);
    }

    /**
     * @dev Converts `buyWith` tokens to GD tokens and updates the bonding curve params.
     * `buy` occurs only if the GD return is above the given minimum. It is possible
     * to buy only with cDAI and when the contract is set to active. MUST call to
     * `buyWith` `approve` prior this action to allow this contract to accomplish the
     * conversion.
     * @param _buyWith The tokens that should be converted to GD tokens
     * @param _tokenAmount The amount of `buyWith` tokens that should be converted to GD tokens
     * @param _minReturn The minimum allowed return in GD tokens
     * @return (gdReturn) How much GD tokens were transferred
     */
    function buy(
        ERC20 _buyWith,
        uint256 _tokenAmount,
        uint256 _minReturn
    ) public requireActive onlyActiveToken(_buyWith) returns (uint256) {
        require(
            _buyWith.allowance(msg.sender, address(this)) >= _tokenAmount,
            "You need to approve token transfer first"
        );
        require(
            _buyWith.transferFrom(msg.sender, address(this), _tokenAmount) == true,
            "transferFrom failed, make sure you approved token transfer"
        );
        uint256 gdReturn = marketMaker.buy(_buyWith, _tokenAmount);
        require(gdReturn >= _minReturn, "GD return must be above the minReturn");
        ERC20Mintable(address(avatar.nativeToken())).mint(msg.sender, gdReturn);
        emit TokenPurchased(
            msg.sender,
            address(_buyWith),
            _tokenAmount,
            _minReturn,
            gdReturn
        );
        return gdReturn;
    }

    /**
     * @dev Converts GD tokens to `sellTo` tokens and update the bonding curve params.
     * `sell` occurs only if the token return is above the given minimum. Notice that
     * there is a contribution amount from the given GD that remains in the reserve.
     * It is only possible to sell when the contract is set to
     * active. MUST be called to G$ `approve` prior to this action to allow this
     * contract to accomplish the conversion.
     * @param _sellTo The tokens that will be received after the conversion
     * @param _gdAmount The amount of GD tokens that should be converted to `_sellTo` tokens
     * @param _minReturn The minimum allowed `sellTo` tokens return
     * @return (tokenReturn) How much `sellTo` tokens were transferred
     */
    function sell(
        ERC20 _sellTo,
        uint256 _gdAmount,
        uint256 _minReturn
    ) public requireActive onlyActiveToken(_sellTo) returns (uint256) {
        ERC20Burnable(address(avatar.nativeToken())).burnFrom(msg.sender, _gdAmount);
        uint256 contributionAmount = contribution.calculateContribution(
            marketMaker,
            this,
            msg.sender,
            _sellTo,
            _gdAmount
        );
        uint256 tokenReturn = marketMaker.sellWithContribution(
            _sellTo,
            _gdAmount,
            contributionAmount
        );
        require(tokenReturn >= _minReturn, "Token return must be above the minReturn");
        require(_sellTo.transfer(msg.sender, tokenReturn) == true, "Transfer failed");
        emit TokenSold(
            msg.sender,
            address(_sellTo),
            _gdAmount,
            contributionAmount,
            _minReturn,
            tokenReturn
        );
        return tokenReturn;
    }

    /**
     * @dev Current price of GD in `token`. currently only cDAI is supported.
     * @param _token The desired reserve token to have
     * @return price of GD
     */
    function currentPrice(ERC20 _token) public view returns (uint256) {
        return marketMaker.currentPrice(_token);
    }

    /**
     * @dev Checks if enough blocks have passed so it would be possible to
     * execute `mintInterestAndUBI` according to the length of `blockInterval`
     * @return (bool) True if enough blocks have passed
     */
    function canMint() public view returns (bool) {
        return block.number.div(blockInterval) > lastMinted;
    }

    /**
     * @dev Anyone can call this to trigger calculations.
     * Reserve sends UBI to Avatar DAO and returns interest to FundManager.
     * @param _interestToken The token that was transfered to the reserve
     * @param _transfered How much was transfered to the reserve for UBI in `_interestToken`
     * @param _interest Out of total transfered how much is the interest (in `_interestToken`)
     * that needs to be paid back (some interest might be donated)
     * @return (gdInterest, gdUBI) How much GD interest was minted and how much GD UBI was minted
     */
    function mintInterestAndUBI(
        ERC20 _interestToken,
        uint256 _transfered,
        uint256 _interest
    )
        public
        requireActive
        onlyActiveToken(_interestToken)
        onlyFundManager
        returns (uint256, uint256)
    {
        require(canMint(), "Need to wait for the next interval");
        uint256 price = currentPrice(_interestToken);
        uint256 gdInterestToMint = marketMaker.mintInterest(_interestToken, _transfered);
        GoodDollar gooddollar = GoodDollar(address(avatar.nativeToken()));
        uint256 precisionLoss = uint256(27).sub(uint256(gooddollar.decimals()));
        uint256 gdInterest = rdiv(_interest, price).div(10**precisionLoss);
        uint256 gdExpansionToMint = marketMaker.mintExpansion(_interestToken);
        uint256 gdUBI = gdInterestToMint.sub(gdInterest);
        gdUBI = gdUBI.add(gdExpansionToMint);
        uint256 toMint = gdUBI.add(gdInterest);
        ERC20Mintable(address(avatar.nativeToken())).mint(fundManager, toMint);
        lastMinted = block.number.div(blockInterval);
        emit UBIMinted(
            lastMinted,
            address(_interestToken),
            _transfered,
            gdInterestToMint,
            gdExpansionToMint,
            gdInterest,
            gdUBI
        );
        return (gdInterest, gdUBI);
    }

    /**
     * @dev Making the contract inactive after it has transferred the cDAI funds to `_avatar`
     * and has transferred the market maker ownership to `_avatar`. Inactive means that
     * buy / sell / mintInterestAndUBI actions will no longer be active. Only the Avatar can
     * executes this method
     */
    function end() public onlyAvatar {
        // remaining cDAI tokens in the current reserve contract
        uint256 remainingReserve = cDai.balanceOf(address(this));
        if (remainingReserve > 0) {
            require(
                cDai.transfer(address(avatar), remainingReserve),
                "cdai transfer failed"
            );
        }
        require(cDai.balanceOf(address(this)) == 0, "Funds transfer has failed");
        GoodDollar gooddollar = GoodDollar(address(avatar.nativeToken()));
        marketMaker.transferOwnership(address(avatar));
        gooddollar.renounceMinter();
        super.internalEnd(avatar);
    }

    /**
     * @dev method to recover any stuck erc20 tokens (ie compound COMP)
     * @param _token the ERC20 token to recover
     */
    function recover(ERC20 _token) public onlyAvatar {
        require(
            _token.transfer(address(avatar), _token.balanceOf(address(this))),
            "recover transfer failed"
        );
    }
}
