import { ethers, upgrades, network as networkConfig } from "hardhat";
import { FuseStakingV3, Uniswap, UniswapFactory, UniswapPair } from "../types";
import { expect } from "chai";
import { deployMockContract, MockContract } from "ethereum-waffle";
import hre from "hardhat";
import { abi as ubiabi } from "../../stakingModel/build/contracts/UBIScheme.json";
import { BigNumber } from "ethers";
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("FuseStakingV3", () => {
  let staking: FuseStakingV3;
  let founder, staker1, staker2;
  let signers;

  let uniswap: MockContract,
    uniswapFactory,
    uniswapPair,
    gdusdcPair,
    fusefusdPair,
    ubiMock;

  const deployMocks = async () => {
    let u = await hre.artifacts.readArtifact("Uniswap");
    let uf = await hre.artifacts.readArtifact("UniswapFactory");
    let up = await hre.artifacts.readArtifact("UniswapPair");
    uniswap = await deployMockContract(signers[0], u.abi);
    uniswapFactory = await deployMockContract(signers[0], uf.abi);
    uniswapPair = await deployMockContract(signers[0], up.abi);

    gdusdcPair = await deployMockContract(signers[0], up.abi);
    fusefusdPair = await deployMockContract(signers[0], up.abi);

    ubiMock = await deployMockContract(signers[0], ubiabi);
    await uniswap.mock.factory.returns(uniswapFactory.address);
    await uniswap.mock.WETH.returns(signers[3].address);
    await uniswapFactory.mock.getPair.returns(uniswapPair.address);
    await uniswapFactory.mock.getPair
      .withArgs(
        ethers.constants.AddressZero,
        "0x620fd5fa44BE6af63715Ef4E65DDFA0387aD13F5"
      )
      .returns(gdusdcPair.address);

    await uniswapFactory.mock.getPair
      .withArgs(signers[3].address, "0x249BE57637D8B013Ad64785404b24aeBaE9B098B")
      .returns(fusefusdPair.address);

    await uniswapPair.mock.getReserves.returns(
      ethers.utils.parseEther("1000"),
      "100000",
      "0"
    );
    await gdusdcPair.mock.getReserves.returns("4984886100", "10789000000", "0");
    await fusefusdPair.mock.getReserves.returns(
      ethers.utils.parseEther("10000"),
      ethers.utils.parseEther("2000"), //200$ fusd 18 decimals
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

    await staking.initialize();
    await staking.upgrade0();
    await staking.upgrade1(NULL_ADDRESS, ubiMock.address, uniswap.address);
    await staking.upgrade2();
  });

  it("should have owner", async () => {
    expect(await staking.owner()).to.be.equal(founder);
  });

  it("should calc quantity with slippage", async () => {
    const res = await staking["calcMaxTokenWithPriceImpact(uint256,uint256,uint256)"](
      "6917100025787759640000",
      "265724494",
      ethers.utils.parseEther("500")
    );

    // const fuseQuantity = ethers.utils.formatEther(res);
    expect(res.maxToken).to.gt(0);
    expect(res.maxToken).to.equal(
      BigNumber.from("6917100025787759640000")
        .mul(3)
        .div(100)
    );
    expect(res.tokenOut).to.equal(7717004);
  });

  it("should calc quantity with uniswap mock", async () => {
    const res = await staking["calcMaxFuseWithPriceImpact(uint256)"](
      ethers.utils.parseEther("500")
    );

    // const fuseQuantity = ethers.utils.formatEther(res);
    expect(res.fuseAmount).to.gt(0);
    expect(res.fuseAmount).to.equal(ethers.utils.parseEther("30"));

    await uniswapPair.mock.getReserves.returns(
      ethers.utils.parseEther("100"),
      "500000",
      "0"
    );
    const res2 = await staking["calcMaxFuseWithPriceImpact(uint256)"](
      ethers.utils.parseEther("500")
    );

    expect(res2.fuseAmount).to.equal(ethers.utils.parseEther("3"));
  });

  it("should calculate gd/usdc quantity with 0 price impact ", async () => {
    const res = await staking["calcMaxFuseUSDCWithPriceImpact(uint256)"](
      ethers.utils.parseEther("10")
    );
    //exchanging 10 fuse which are equal 2$ USDC should have no significant price impact on usdc/gd swap so we should be able to swap the whole 10
    expect(res.maxFuse).to.gt(0);
    expect(res.maxFuse).to.equal(ethers.utils.parseEther("10"));
  });

  it("should detect gd/usdc price impact", async () => {
    const res = await staking["calcMaxFuseUSDCWithPriceImpact(uint256)"](
      ethers.utils.parseEther("10000")
    );
    expect(res.maxFuse).to.lt(ethers.utils.parseEther("10000"));
    expect(res.maxFuse).to.equal(ethers.utils.parseEther("1618.35")); //on fuse swap it was around 335$ on above gd/usdc reserves that reaches 3% impact, that means 335*5=1675fuse
  });

  it("should match fuseswap and allow to exchange +-4600 fuse to G$", async () => {
    //G$/usdc reserves 52,841,23400/10410000000
    //fuse/fusd reserves 619085*1e18/42905*1e18

    await gdusdcPair.mock.getReserves.returns("5284123400", "10410000000", "0");
    await fusefusdPair.mock.getReserves.returns(
      ethers.utils.parseEther("619085"),
      ethers.utils.parseEther("42905"),
      "0"
    );

    const res = await staking["calcMaxFuseUSDCWithPriceImpact(uint256)"](
      ethers.utils.parseEther("10000")
    );
    expect(res.maxFuse).to.lt(ethers.utils.parseEther("5000"));
    expect(res.maxFuse).to.gt(ethers.utils.parseEther("4500"));
  });
});
