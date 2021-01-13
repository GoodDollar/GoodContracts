import { ethers } from "hardhat";

import DAOCreatorABI from "../../build/contracts/DaoCreatorGoodDollar.json";
import IdentityABI from "../../build/contracts/Identity.json";
import FeeFormulaABI from "../../build/contracts/FeeFormula.json";
import AddFoundersABI from "../../build/contracts/AddFoundersGoodDollar.json";

export const createDAO = async () => {
  let [root] = await ethers.getSigners();
  const DAOCreatorFactory = new ethers.ContractFactory(
    DAOCreatorABI.abi,
    DAOCreatorABI.bytecode,
    root
  );
  const IdentityFactory = new ethers.ContractFactory(
    IdentityABI.abi,
    IdentityABI.bytecode,
    root
  );
  const FeeFormulaFactory = new ethers.ContractFactory(
    FeeFormulaABI.abi,
    FeeFormulaABI.bytecode,
    root
  );
  const AddFoundersFactory = new ethers.ContractFactory(
    AddFoundersABI.abi,
    AddFoundersABI.bytecode,
    root
  );

  const AddFounders = await AddFoundersFactory.deploy();
  const Identity = await IdentityFactory.deploy();
  const daoCreator = await DAOCreatorFactory.deploy(AddFounders.address);
  const FeeFormula = await FeeFormulaFactory.deploy(0);

  await daoCreator.forgeOrg(
    "G$",
    "G$",
    10000,
    FeeFormula.address,
    Identity.address,
    [root.address],
    1000,
    [100000]
  );

  const Avatar = new ethers.Contract(
    await daoCreator.avatar(),
    ["function owner() view returns (address)"],
    root
  );
  const controller = await Avatar.owner();
  return { daoCreator, controller, avatar: await daoCreator.avatar() };
};
