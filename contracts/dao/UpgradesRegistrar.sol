import "@daostack/arc/contracts/universalSchemes/SchemeRegistrar.sol";

interface ProxyAdmin {
    function upgrade(address proxy, address  impl) external;
    function  upgradeAndCall(address proxy, address  impl, bytes calldata callData) external  payable;
}

/* @title Scheme for upgrading an upgradable contract to new impl
* see openzeppelin upgradables
 */
contract UpgradeImplScheme {

    address public newImpl;
    address public proxy;
    address public proxyAdmin;
    bytes public callData;
    uint public timeLockHours;

    /* @dev constructor.
     */
    constructor(address _newImpl, address _proxy, address _proxyAdmin, bytes memory _callData, uint _timeLockHours) public {
        newImpl = _newImpl;
        proxy = _proxy;
        proxyAdmin = _proxyAdmin;
        callData = _callData;
        timeLockHours = _timeLockHours;
    }

}

contract UpgradesRegistrar is SchemeRegistrar {
    struct Upgrade {
        uint timeLockEnd;
        address scheme;
    }

    event UpgradedImpl(address indexed proxy, address impl, bytes32 proposalId);

    mapping(bytes32=>Upgrade) public upgrades; 

    /**
    * @dev execution of proposals, can only be called by the voting machine in which the vote is held.
    * @param _proposalId the ID of the voting in the voting machine
    * @param _param a parameter of the voting result, 1 yes and 2 is no.
    */
    function executeProposal(bytes32 _proposalId, int256 _param) external onlyVotingMachine(_proposalId) returns(bool) {        
        Avatar avatar = proposalsInfo[msg.sender][_proposalId].avatar;
        SchemeProposal memory proposal = organizationsProposals[address(avatar)][_proposalId];
        require(proposal.scheme != address(0));
        delete organizationsProposals[address(avatar)][_proposalId];
        emit ProposalDeleted(address(avatar), _proposalId);
        if (_param == 1) {
            upgrades[_proposalId].timeLockEnd =  now  + UpgradeImplScheme(proposal.scheme).timeLockHours() * 1 hours;
            upgrades[_proposalId].scheme = proposal.scheme;
            executeUpgrade(_proposalId);
        }
        emit ProposalExecuted(address(avatar), _proposalId, _param);
        return true;
    }

    function executeUpgrade(bytes32 _proposalId) public
    {
        Upgrade memory upgrade = upgrades[_proposalId];
        if(upgrade.timeLockEnd > now) return;
        
        delete upgrades[_proposalId];
        UpgradeImplScheme  updScheme = UpgradeImplScheme(upgrade.scheme);
        address proxy = updScheme.proxy();
        address proxyAdmin = updScheme.proxyAdmin();
        address newImpl = updScheme.newImpl();
        bytes memory callData = updScheme.callData();

        if(callData.length > 0)
        {
            ProxyAdmin(proxyAdmin).upgradeAndCall(proxy,newImpl,callData);
        }
        else {
            ProxyAdmin(proxyAdmin).upgrade(proxy,newImpl);
        }

        emit UpgradedImpl(proxy, newImpl,  _proposalId);
        
    }
}