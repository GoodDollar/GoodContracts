pragma solidity 0.5.4;

import "@daostack/arc/contracts/controller/Controller.sol";
import "@daostack/arc/contracts/universalSchemes/SchemeRegistrar.sol";
import "@daostack/infra/contracts/votingMachines/AbsoluteVote.sol";

import "../token/GoodDollar.sol";
import "../identity/IdentityGuard.sol";
import "../dao/schemes/FeeFormula.sol";
/**
 * @title ControllerCreator for creating a single controller. Taken from @daostack.
 */
contract ControllerCreatorGoodDollar {

    function create(Avatar _avatar) public returns(address) {
        Controller controller = new Controller(_avatar);
        controller.registerScheme(msg.sender, bytes32(0), bytes4(0x0000001f), address(_avatar));
        controller.unregisterScheme(address(this), address(_avatar));
        return address(controller);
    }
}


/**
 * @title Genesis Scheme that creates organizations. Taken and modified from @daostack.
 */
contract DaoCreatorGoodDollar {

    Avatar public avatar;
    address public lock;

    event NewOrg (address _avatar);
    event InitialSchemesSet (address _avatar);

    ControllerCreatorGoodDollar private controllerCreatorGoodDollar;

    constructor(ControllerCreatorGoodDollar _controllerCreatorGoodDollar) public {
        controllerCreatorGoodDollar = _controllerCreatorGoodDollar;
    }

  /**
    * @dev Create a new organization
    * @param _tokenName The name of the token associated with the organization
    * @param _tokenSymbol The symbol of the token
    * @param _founders An array with the addresses of the founders of the organization
    * @param _foundersTokenAmount An array of amount of tokens that the founders
    *  receive in the new organization
    * @param _foundersReputationAmount An array of amount of reputation that the
    *   founders receive in the new organization
    * @param  _cap token cap - 0 for no cap.
    * @return The address of the avatar of the controller
    */
    function forgeOrg (
        string calldata _tokenName,
        string calldata _tokenSymbol,
        uint256 _cap,
        FeeFormula _formula,
        Identity _identity,
        address[] calldata _founders,
        uint[] calldata _foundersTokenAmount,
        uint[] calldata _foundersReputationAmount
    )
    external
    returns(address)
    {
        //The call for the private function is needed to bypass a deep stack issues
        return _forgeOrg(
            _tokenName,
            _tokenSymbol,
            _cap,
            _formula,
            _identity,
            _founders,
            _foundersTokenAmount,
            _foundersReputationAmount);
    }

     /**
      * @dev Set initial schemes for the organization.
      * @param _avatar organization avatar (returns from forgeOrg)
      * @param _schemes the schemes to register for the organization
      * @param _params the schemes's params
      * @param _permissions the schemes permissions.
      * @param _metaData dao meta data hash
      */
    function setSchemes (
        Avatar _avatar,
        address[] calldata _schemes,
        bytes32[] calldata _params,
        bytes4[] calldata _permissions,
        string calldata _metaData
    )
        external
    {
        // this action can only be executed by the account that holds the lock
        // for this controller
        require(lock == msg.sender, "Message sender is not lock");
        // register initial schemes:
        ControllerInterface controller = ControllerInterface(_avatar.owner());
        for (uint256 i = 0; i < _schemes.length; i++) {
            controller.registerScheme(_schemes[i], _params[i], _permissions[i], address(_avatar));
        }
        controller.metaData(_metaData, _avatar);
        // Unregister self:
        controller.unregisterScheme(address(this), address(_avatar));
        // Remove lock:
        lock = address(0);
        emit InitialSchemesSet(address(_avatar));
    }

    /**
     * @dev Create a new organization
     * @param _tokenName The name of the token associated with the organization
     * @param _tokenSymbol The symbol of the token
     * @param _founders An array with the addresses of the founders of the organization
     * @param _foundersTokenAmount An array of amount of tokens that the founders
     *  receive in the new organization
     * @param _foundersReputationAmount An array of amount of reputation that the
     *   founders receive in the new organization
     * @param  _cap token cap - 0 for no cap.
     * @return The address of the avatar of the controller
     */
    function _forgeOrg (
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _cap,
        FeeFormula _formula,
        Identity _identity,
        address[] memory _founders,
        uint[] memory _foundersTokenAmount,
        uint[] memory _foundersReputationAmount
    ) private returns(address)
    {
        // Create Token, Reputation and Avatar:
        require(lock == address(0), "Lock already exists");
        require(_founders.length == _foundersTokenAmount.length, "Not enough founder tokens");
        require(_founders.length == _foundersReputationAmount.length, "Founder reputation missing");
        require(_founders.length > 0, "Must have at least one founder");
        GoodDollar nativeToken = new GoodDollar(_tokenName, _tokenSymbol, _cap, _formula, _identity, address(0));
        Reputation nativeReputation = new Reputation();
        avatar = new Avatar("GoodDollar", nativeToken, nativeReputation);

        // Mint token and reputation for founders:
        for (uint256 i = 0; i < _founders.length; i++) {
            require(_founders[i] != address(0), "Founder cannot be zero address");
            if (_foundersTokenAmount[i] > 0) {
                nativeToken.mint(_founders[i], _foundersTokenAmount[i]);
            }
            if (_foundersReputationAmount[i] > 0) {
                nativeReputation.mint(_founders[i], _foundersReputationAmount[i]);
            }
        }

        // Create Controller:
        ControllerInterface controller = ControllerInterface(controllerCreatorGoodDollar.create(avatar));

        // Set fee recipient and minters
        nativeToken.setFeeRecipient(address(avatar), avatar);
        nativeToken.addMinter(address(avatar));
        nativeToken.addMinter(address(controller));
        nativeToken.renounceMinter();

        // Transfer ownership:
        avatar.transferOwnership(address(controller));
        nativeToken.transferOwnership(address(controller));
        nativeReputation.transferOwnership(address(controller));

        lock = msg.sender;

        emit NewOrg (address(avatar));
        return (address(avatar));
    }
}
