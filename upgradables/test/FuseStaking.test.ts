import { ethers, upgrades, network as networkConfig } from "hardhat";
import { FuseStakingV3, Uniswap, UniswapFactory, UniswapPair } from "../types";
import { expect } from "chai";
import { deployMockContract, MockContract } from "ethereum-waffle";
import hre from "hardhat";
import { abi as ubiabi } from "../../stakingModel/build/contracts/UBIScheme.json";
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("FuseStakingV3", () => {
  let staking: FuseStakingV3;
  let founder, staker1, staker2;
  let signers;

  let uniswap: MockContract, uniswapFactory, uniswapPair, ubiMock;

  const deployMocks = async () => {
    let u = await hre.artifacts.readArtifact("Uniswap");
    let uf = await hre.artifacts.readArtifact("UniswapFactory");
    let up = await hre.artifacts.readArtifact("UniswapPair");
    uniswap = await deployMockContract(signers[0], u.abi);
    uniswapFactory = await deployMockContract(signers[0], uf.abi);
    uniswapPair = await deployMockContract(signers[0], up.abi);
    ubiMock = await deployMockContract(signers[0], ubiabi);
    await uniswap.mock.factory.returns(uniswapFactory.address);
    await uniswap.mock.WETH.returns(NULL_ADDRESS);
    await uniswapFactory.mock.getPair.returns(uniswapPair.address);
    await uniswapPair.mock.getReserves.returns(
      ethers.utils.parseEther("1000"),
      "100000",
      "0"
    );
  };

  before(async () => {
    signers = await ethers.getSigners();
    [founder, staker1, staker2] = signers.map(_ => _.address);
    await deployMocks();

    let network = networkConfig.name;
    staking = (await (
      await ethers.getContractFactory("FuseStakingV3")
    ).deploy()) as FuseStakingV3;
    console.log(
      "getPair",
      await uniswapFactory.getPair(uniswap.address, uniswap.address)
    );
    await staking.initialize();
    await staking.upgrade0();
    await staking.upgrade1(NULL_ADDRESS, ubiMock.address, uniswap.address);
  });

  it("should have owner", async () => {
    expect(await staking.owner()).to.be.equal(founder);
  });

  it("should calc quantity with slippage", async () => {
    const res = await staking["calcMaxFuseWithSlippage(uint256,uint256,uint256)"](
      "6917100025787759640707",
      "265724494",
      ethers.utils.parseEther("500")
    );

    // const fuseQuantity = ethers.utils.formatEther(res);
    expect(res).to.gt(0);
    expect(res).to.equal(ethers.utils.parseEther("186"));
  });

  it("should calc quantity with uniswap mock", async () => {
    const res = await staking["calcMaxFuseWithSlippage(uint256)"](
      ethers.utils.parseEther("500")
    );

    // const fuseQuantity = ethers.utils.formatEther(res);
    expect(res).to.gt(0);
    expect(res).to.equal(ethers.utils.parseEther("26"));

    await uniswapPair.mock.getReserves.returns(
      ethers.utils.parseEther("100"),
      "500000",
      "0"
    );
    const res2 = await staking["calcMaxFuseWithSlippage(uint256)"](
      ethers.utils.parseEther("500")
    );

    expect(res2).to.equal(ethers.utils.parseEther("2.5"));
  });
});
