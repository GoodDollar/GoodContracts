const avatarMock = artifacts.require("AvatarMock.sol");
const ControllerMock = artifacts.require("ControllerMock.sol");
const ContributionCalculation = artifacts.require("ContributionCalculation.sol");

const BN = web3.utils.BN;
export const BLOCK_INTERVAL = 2;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract(
  "ContributionCalculation - calculate exit contribution in reserve",
  ([founder, staker]) => {
    let contribution, avatar, controller;
    before(async () => {
      avatar = await avatarMock.new("", NULL_ADDRESS, NULL_ADDRESS);
      controller = await ControllerMock.new(avatar.address);
      await avatar.transferOwnership(controller.address);
      contribution = await ContributionCalculation.new(avatar.address, 2e5, 1e6);
    });

    it("should calculate 20% contribution", async () => {
      let contrib = await contribution.calculateContribution(
        NULL_ADDRESS,
        NULL_ADDRESS,
        NULL_ADDRESS,
        NULL_ADDRESS,
        1e4 //10000
      );
      expect(contrib.toString()).to.be.equal("2000"); //10000 * 20% = 2000
    });

    it("should not return a contribution amount that is larger than the gd amount", async () => {
      let nom = new BN(2e15).toString();
      let denom = new BN(1e15).toString();
      let encodedCall = web3.eth.abi.encodeFunctionCall(
        {
          name: "setContributionRatio",
          type: "function",
          inputs: [
            {
              type: "uint256",
              name: "_nom"
            },
            {
              type: "uint256",
              name: "_denom"
            }
          ]
        },
        [nom, denom]
      );
      await controller.genericCall(contribution.address, encodedCall, avatar.address, 0);
      let error = await contribution.calculateContribution(
        NULL_ADDRESS,
        NULL_ADDRESS,
        NULL_ADDRESS,
        NULL_ADDRESS,
        1e4 //10000
      ).catch(e => e);
      expect(error.message).to.have.string("Calculation error");
    });
  }
);
