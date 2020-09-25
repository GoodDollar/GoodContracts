pragma solidity >= 0.6;

interface IdentityInterface {
    function isWhitelisted(address account) external view returns (bool);
    function isRegistered() external view returns (bool);
    function isBlackedListeed(address account) external view returns (bool);
    function isIdentityAdmin(address account) external view returns (bool);
    function isDAOContract(address account) external view returns (bool);
    function lastAuthenticated(address account) external view returns (uint256);

}