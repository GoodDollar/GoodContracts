pragma solidity >0.5.4;

import "../UBIScheme.sol";

/**
 * @title An UBIScheme mock. Ignores the scheme registration.
 * Those tests can be found on e2e tests.
 */
contract UBISchemeMock is UBIScheme {

    modifier onlyRegistered() {
        _;
    }

    constructor(
        Avatar _avatar,
        Identity _identity,
        FirstClaimPool _firstClaimPool,
        uint256 _periodStart,
        uint256 _periodEnd,
        uint256 _maxInactiveDays,
        uint256 _cycleLength
    )
        public
        UBIScheme(
            _avatar,
            _identity,
            _firstClaimPool,
            _periodStart,
            _periodEnd,
            _maxInactiveDays,
            _cycleLength        )
    {
        shouldWithdrawFromDAO = true;
    }

    // //we mock this to skip the onlyRegistered modifier that requires scheme registration, dao voting etc...
    // function start() public {
    //     controller.genericCall(
    //         address(firstClaimPool),
    //         abi.encodeWithSignature("setUBIScheme(address)", address(this)),
    //         avatar,
    //         0
    //     );
    // }

    // function end() public onlyAvatar {
    //     DAOToken token = avatar.nativeToken();
    //     uint256 remainingGDReserve = token.balanceOf(address(this));
    //     if (remainingGDReserve > 0) {
    //         token.transfer(address(avatar), remainingGDReserve);
    //     }
    //     selfdestruct(address(avatar));
    // }
}
