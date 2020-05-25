pragma solidity 0.5.4;
/**
@dev contract to make sure contracts for main package are compiled and available in testing scope
 */
import "../../contracts/mocks/DAIMock.sol";
import "../../contracts/mocks/cDAIMock.sol";
import "../../contracts/mocks/AvatarMock.sol";
import "../../contracts/identity/Identity.sol";
import "../../contracts/dao/schemes/FeeFormula.sol";
import "../../contracts/dao/DaoCreator.sol";
import "../../contracts/dao/schemes/AddMinter.sol";


contract Imports {}
