const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
const Invites = artifacts.require("InvitesV1.sol");
const Identity = artifacts.require("IIdentity");
const ERC20 = artifacts.require("GoodDollar");

const BN = web3.utils.BN;
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

contract(
  "Invites Model",
  ([founder, inviter1, inviter2, invitee1, invitee2, invitee3, invitee4, invitee5]) => {
    let invites, identity, gd, bounty;
    before(async () => {
      let network = process.env.NETWORK;
      const cur = await Invites.deployed();
      invites = cur;
      identity = await Identity.at(await cur.identity());
      gd = await ERC20.at(await cur.goodDollar());

      //if using tdd we reset and redeploy
      if (network === "tdd") {
        await identity.removeWhitelisted(invitee1).catch(e => e);
        await identity.removeWhitelisted(invitee2).catch(e => e);
        await identity.removeWhitelisted(inviter1).catch(e => e);
        await identity.removeWhitelisted(invitee3).catch(e => e);
        await identity.removeWhitelisted(invitee4).catch(e => e);
        await identity.removeWhitelisted(invitee5).catch(e => e);

        invites = await deployProxy(
          Invites,
          [await cur.avatar(), await cur.identity(), await cur.goodDollar(), 500],
          { unsafeAllowCustomTypes: true }
        );
      }
      await gd.transfer(invites.address, 5000, { from: founder });
    });

    it("should have version", async () => {
      // const invites = await Invites.deployed();
      expect(await invites.active()).to.be.true;
      const version = await invites.version();
      expect(version).to.be.equal("1.0.0");
    });

    it("should let anyone join", async () => {
      // const invites = await Invites.deployed();
      let inviter = await invites.users(inviter1);
      await invites.join("0xfa", "0x0", { from: inviter1 });
      inviter = await invites.users(inviter1);
      expect(inviter.inviteCode).to.have.string("0xfa");
    });

    it("should allow to join only once", async () => {
      let err = await invites.join("0xfa", "0x01", { from: inviter1 }).catch(e => e);
      expect(err).to.be.an("error");
    });

    it("should not allow code reuse", async () => {
      // const invites = await Invites.deployed();
      let err = await invites.join("0xfa", "0x0", { from: inviter2 }).catch(e => e);
      expect(err).to.be.an("error");
      expect(err.message).to.have.string("already");
    });

    it("should mark inviter", async () => {
      await invites.join("0xaa", "0xfa", { from: invitee1 });
      let invitee = await invites.users(invitee1);
      let inviterInvitees = await invites.getInvitees(inviter1);
      expect(invitee.invitedBy).to.be.equal(inviter1);
      expect(inviterInvitees).to.include(invitee1);
    });

    it("should not pay bounty for non whitelisted invitee", async () => {
      const err = await invites.bountyFor(invitee1, { from: inviter1 }).catch(e => e);
      expect(err).to.be.an("error");
    });

    it("should not pay bounty for non whitelisted inviter", async () => {
      await identity.addWhitelistedWithDID(invitee1, Math.random() + "").catch(e => e);
      expect(await identity.isWhitelisted(invitee1)).to.be.true;
      expect(await invites.canCollectBountyFor(invitee1)).to.be.false;
      const err = await invites.bountyFor(invitee1, { from: inviter1 }).catch(e => e);
      expect(err).to.be.an("error");
    });

    it("should pay bounty for whitelisted invitee and inviter", async () => {
      const bounty = (await invites.levels(0)).bounty.toNumber();
      await identity.addWhitelistedWithDID(inviter1, Math.random() + "").catch(e => e);
      const startBalance = await gd.balanceOf(inviter1).then(_ => _.toNumber());
      expect(await identity.isWhitelisted(inviter1)).to.be.true;
      let pending = await invites.getPendingInvitees(inviter1);
      expect(pending.length, "pending").to.be.equal(1);
      await invites.bountyFor(invitee1, { from: inviter1 });

      let invitee = await invites.users(invitee1);
      let inviter = await invites.users(inviter1);
      const endBalance = await gd.balanceOf(inviter1).then(_ => _.toNumber());

      pending = await invites.getPendingInvitees(inviter1);
      const txFee = await gd.getFees(bounty).then(_ => _["0"].toNumber()); //gd might have a tx fee
      expect(pending.length, "pending").to.be.equal(0);
      expect(invitee.bountyPaid).to.be.true;
      expect(inviter.totalApprovedInvites.toNumber()).to.be.equal(1);
      expect(inviter.totalEarned.toNumber()).to.be.equal(bounty);
      expect(endBalance - startBalance + txFee).to.be.equal(bounty);
    });

    it("should update global stats", async () => {
      const bounty = (await invites.levels(0)).bounty.toNumber();
      const stats = await invites.stats();
      expect(stats.totalApprovedInvites.toNumber()).to.be.equal(1, "approved invites");
      expect(stats.totalInvited.toNumber()).to.be.equal(1, "total  invited");
      expect(stats.totalBountiesPaid.toNumber()).to.be.equal(bounty);
    });

    it("should not pay bounty twice", async () => {
      const err = await invites.bountyFor(invitee1, { from: inviter2 }).catch(e => e);
      expect(err).to.be.an("error");
    });

    it("should not fail in collectBounties for invalid invitees", async () => {
      await invites.join("0x01", "0xfa", { from: invitee2 });
      await invites.join("0x02", "0xfa", { from: invitee3 });
      const res = await invites.collectBounties({ from: inviter1 }).catch(e => e);
      let user1 = await invites.users(invitee2);
      let user2 = await invites.users(invitee3);
      let pending = await invites.getPendingInvitees(inviter1);
      expect(
        await invites.getPendingBounties(inviter1).then(_ => _.toNumber())
      ).to.be.equal(0);
      expect(pending.length, "pending").to.be.equal(2);
      expect(user1.bountyPaid).to.be.false;
      expect(user2.bountyPaid).to.be.false;
      expect(res).not.to.be.an("error");
    });

    it("should collectBounties for inviter", async () => {
      await identity.addWhitelistedWithDID(invitee2, Math.random() + "").catch(e => e);
      await identity.addWhitelistedWithDID(invitee3, Math.random() + "").catch(e => e);
      expect(
        await invites.getPendingBounties(inviter1).then(_ => _.toNumber())
      ).to.be.equal(2);
      const res = await invites.collectBounties({ from: inviter1 }).catch(e => e);

      let user1 = await invites.users(invitee2);
      let user2 = await invites.users(invitee3);
      let pending = await invites.getPendingInvitees(inviter1);
      expect(pending.length, "pending").to.be.equal(0);
      expect(user1.bountyPaid, "user1").to.be.true;
      expect(user2.bountyPaid, "user2").to.be.true;
    });

    it("should not set level not by owner", async () => {
      const err = await invites.setLevel(0, 1, 5, 1, { from: inviter1 }).catch(e => e);
      expect(err).to.be.an("error");
    });

    it("should set level by owner", async () => {
      await invites.setLevel(0, 1, 5, 1);
      let lvl = await invites.levels(0);
      expect(lvl.toNext.toNumber()).to.be.equal(1);
      expect(lvl.daysToComplete.toNumber()).to.be.equal(1);
      await invites.setLevel(1, 0, 10, 2);
      lvl = await invites.levels(1);
      expect(lvl.toNext.toNumber()).to.be.equal(0);
      expect(lvl.daysToComplete.toNumber()).to.be.equal(2);
      expect(lvl.bounty.toNumber()).to.be.equal(10);
    });

    it("should update inviter level", async () => {
      await invites.join("0x03", "0xfa", { from: invitee4 });
      await invites.join("0x04", "0xfa", { from: invitee5 });
      await identity.addWhitelistedWithDID(invitee4, Math.random() + "").catch(e => e);
      await identity.addWhitelistedWithDID(invitee5, Math.random() + "").catch(e => e);
      const res1 = await invites.bountyFor(invitee4);

      const log1 = res1.logs[0];
      expect(log1.event).to.be.equal("InviterBounty");
      expect(log1.args.inviterLevel.toNumber()).to.be.equal(1);
      expect(log1.args.earnedLevel).to.be.equal(true);
      expect(log1.args.bountyPaid.toNumber()).to.be.equal(5);

      let inviter = await invites.users(inviter1);
      expect(inviter.level.toNumber()).to.be.equal(1);
      const res2 = await invites.collectBounties({ from: inviter1 });
      const log2 = res2.logs[0];
      expect(log2.event).to.be.equal("InviterBounty");
      expect(log2.args.inviterLevel.toNumber()).to.be.equal(1);
      expect(log2.args.earnedLevel).to.be.equal(false);
      expect(log2.args.bountyPaid.toNumber()).to.be.equal(10);

      console.log(log2);
    });
  }
);
