pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/ControllerInterface.sol";

import "./ActivePeriod.sol";
import "./SchemeGuard.sol";


/* @title Scheme contract responsible for minting to a given recipient.
 */
contract ReserveMinter is ActivePeriod, SchemeGuard {
    address public receiver;
    uint256 public amount;

    /* @dev Constructor.
     * @param _avatar The avatar of the DAO
     * @param _amount The amount to mint to receiver
     * @param _receiver The address to receive minted amount
     */
    constructor(Avatar _avatar, uint256 _amount, address _receiver)
        public
        ActivePeriod(now, now * 2, _avatar)
        SchemeGuard(_avatar)
    {
        require(_receiver != address(0), "receiver cannot be null address");
        require(_amount > 0, "Reserve cannot be zero");

        amount = _amount;
        receiver = _receiver;
    }

    /* @dev Start function. Mints the given amount to
     * the receiver given in the constructor, then ends the scheme
     */
    function start() public onlyRegistered {
        super.start();

        DAOToken token = avatar.nativeToken();

        controller.genericCall(
            address(token),
            abi.encodeWithSignature("mint(address,uint256)", receiver, amount),
            avatar,
            0
        );

        super.internalEnd(avatar);
    }
}
