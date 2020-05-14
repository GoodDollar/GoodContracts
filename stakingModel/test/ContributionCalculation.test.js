const ContributionCalculation = artifacts.require("ContributionCalculation.sol");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 2;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("ContributionCalculation - calculate exit contribution in reserve", ([founder, staker]) => {
  let contribution;
  before(async () => {
    contribution = await ContributionCalculation.new(NULL_ADDRESS, 2e5, 1e6);
  });
  it("should calculate 20% contribution", async () => {
    let contrib = await contribution.calculateContribution(
      NULL_ADDRESS,
      NULL_ADDRESS,
      NULL_ADDRESS,
      NULL_ADDRESS,
      1e4 //10000
    );
    expect(contrib.toString()).to.be.equal("8000"); //10000 - 20% = 8000
  });
});
