pragma solidity >0.5.4;

import "../SimpleDAIStaking.sol";

/**
 * @title A SimpleDAIStaking mock.
 * return 0 donation ratio on collect.
 */
contract SimpleDAIStakingNoDonation is SimpleDAIStaking {
    constructor(
        address _dai,
        address _cDai,
        address _fundManager,
        uint256 _blockInterval,
        Avatar _avatar,
        Identity _identity
    )
        public
        SimpleDAIStaking(_dai, _cDai, _fundManager, _blockInterval, _avatar, _identity)
    {}

    function collectUBIInterest(address recipient)
        public
        onlyFundManager
        returns (
            uint256,
            uint256,
            uint256,
            uint32
        )
    {
        (uint256 cdaiGains, uint256 daiGains, uint256 precisionLossDai, ) = super
            .collectUBIInterest(recipient);
        return (cdaiGains, daiGains, precisionLossDai, 0);
    }
}
