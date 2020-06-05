import * as helpers from "./helpers";

const Identity = artifacts.require("Identity");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const IdentityGuardMock = artifacts.require("IdentityGuardMock");
const AddAdmin = artifacts.require("AddAdmin");
const RemoveAdmin = artifacts.require("RemoveAdmin");

contract(
  "Identity - Blacklist and whitelist",
  ([
    founder,
    blacklisted,
    blacklisted2,
    whitelisted,
    whitelisted2,
    outsider,
    authuser
  ]) => {
    let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
    let dangerIdentity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
    let absoluteVote: helpers.ThenArg<ReturnType<typeof AbsoluteVote["new"]>>;
    let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
    let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
    let identityGuard: helpers.ThenArg<ReturnType<typeof IdentityGuardMock["new"]>>;
    let mock: helpers.ThenArg<ReturnType<typeof IdentityGuardMock["new"]>>;
    let addAdmin: helpers.ThenArg<ReturnType<typeof AddAdmin["new"]>>;
    let addAdmin2: helpers.ThenArg<ReturnType<typeof AddAdmin["new"]>>;
    let removeAdmin: helpers.ThenArg<ReturnType<typeof RemoveAdmin["new"]>>;
    let controller: helpers.ThenArg<ReturnType<typeof ControllerInterface["new"]>>;

    let proposalId: string;

    before(async () => {
      identity = await Identity.deployed();
      dangerIdentity = await Identity.new();

      avatar = await Avatar.at(await (await DaoCreatorGoodDollar.deployed()).avatar());
      controller = await ControllerInterface.at(await avatar.owner());
      token = await GoodDollar.at(await avatar.nativeToken());
      absoluteVote = await AbsoluteVote.deployed();

      identityGuard = await IdentityGuardMock.new(dangerIdentity.address);

      await helpers.assertVMException(
        IdentityGuardMock.new(helpers.NULL_ADDRESS),
        "Supplied identity is null"
      );
      mock = await IdentityGuardMock.new(identity.address);
    });

    it("should set avatar", async () => {
      await helpers.assertVMRevert(dangerIdentity.isRegistered());
      await dangerIdentity.setAvatar(avatar.address);
    });

    it("should blacklist address", async () => {
      await identity.addBlacklisted(blacklisted);
      assert(await identity.isBlacklisted(blacklisted));

      await identity.removeBlacklisted(blacklisted);
      assert(!(await identity.isBlacklisted(blacklisted)));
    });

    it("should check blacklisted", async () => {
      assert(await mock.blacklistMock(blacklisted));
      await identity.addBlacklisted(blacklisted);

      await helpers.assertVMException(
        mock.blacklistMock(blacklisted),
        "Receiver is blacklisted"
      );
      await helpers.assertVMException(
        mock.blacklistMock(founder, { from: blacklisted }),
        "Caller is blacklisted"
      );

      await identity.addBlacklisted(blacklisted2);

      await helpers.assertVMException(
        mock.blacklistMock(blacklisted2, { from: blacklisted }),
        "Caller is blacklisted"
      );
      await identity.removeBlacklisted(blacklisted);
    });

    it("should add, check and remove whitelisted", async () => {
      await helpers.assertVMException(
        mock.checkWhitelisted(whitelisted),
        "is not whitelisted"
      );

      await identity.addWhitelisted(whitelisted);
      assert(await identity.isWhitelisted(whitelisted));

      assert(await mock.checkWhitelisted(whitelisted));

      await identity.removeWhitelisted(whitelisted);
      assert(!(await identity.isWhitelisted(whitelisted)));
    });

    it("should increment and decrement whitelisteds when adding whitelisted", async () => {
      const oldWhitelistedCount = (await identity.whitelistedCount()) as any;

      await identity.addWhitelisted(whitelisted);

      const diffWhitelistedCount = ((await identity.whitelistedCount()) as any).sub(
        oldWhitelistedCount
      );
      expect(diffWhitelistedCount.toString()).to.be.equal("1");

      await identity.removeWhitelisted(whitelisted);

      const whitelistedCount = (await identity.whitelistedCount()) as any;
      expect(whitelistedCount.toString()).to.be.equal(oldWhitelistedCount.toString());
    });

    it("should revert when non admin tries to add whitelisted", async () => {
      await helpers.assertVMException(
        identity.addWhitelisted(whitelisted, { from: outsider }),
        "not IdentityAdmin"
      );
    });

    it("should revert when non admin tries to add blacklist", async () => {
      await helpers.assertVMException(
        identity.addBlacklisted(blacklisted, { from: outsider }),
        "not IdentityAdmin"
      );
    });

    it("should revert when non admin tries to set the authentication period", async () => {
      await helpers.assertVMException(
        identity.setAuthenticationPeriod(10, { from: outsider }),
        ""
      );
    });

    it("should revert when non admin tries to authentice a user", async () => {
      await helpers.assertVMException(
        identity.authenticate(authuser, { from: outsider }),
        "not IdentityAdmin"
      );
    });

    it("should not be able to add zero address as identity admin", async () => {
      helpers.assertVMException(
        AddAdmin.new(avatar.address, identity.address, helpers.NULL_ADDRESS),
        "admin cannot be null address"
      );
    });

    it("should authenticate the user with the correct timestamp", async () => {
      await identity.authenticate(authuser);
      let dateAuthenticated1 = await identity.lastAuthenticated(authuser);
      await helpers.increaseTime(10);
      await identity.authenticate(authuser);
      let dateAuthenticated2 = await identity.lastAuthenticated(authuser);
      assert(dateAuthenticated2.toNumber() - dateAuthenticated1.toNumber() > 0);
    });

    it("should add identity admin", async () => {
      addAdmin = await AddAdmin.new(avatar.address, identity.address, outsider);

      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        addAdmin.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);

      await addAdmin.transferOwnership(await avatar.owner());
      await addAdmin.start();

      expect(await identity.isIdentityAdmin(outsider)).to.be.equal(true);
    });

    it("should remove identity admin", async () => {
      removeAdmin = await RemoveAdmin.new(avatar.address, identity.address, outsider);

      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        removeAdmin.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );
      assert(executeProposalEventExists);

      await removeAdmin.transferOwnership(await avatar.owner());
      await removeAdmin.start();

      expect(await identity.isIdentityAdmin(outsider)).to.be.equal(false);
    });

    it("should not remove identity admin twice", async () => {
      await helpers.assertVMException(
        RemoveAdmin.new(avatar.address, identity.address, outsider),
        "Given address is not admin"
      );
    });

    it("should renounce identity admin", async () => {
      addAdmin2 = await AddAdmin.new(avatar.address, identity.address, outsider);

      const schemeRegistrar = await SchemeRegistrar.deployed();
      let transaction = await schemeRegistrar.proposeScheme(
        avatar.address,
        addAdmin2.address,
        helpers.NULL_HASH,
        "0x00000010",
        helpers.NULL_HASH
      );

      proposalId = transaction.logs[0].args._proposalId;

      const voteResult = await absoluteVote.vote(proposalId, 1, 0, founder);
      const executeProposalEventExists = voteResult.logs.some(
        e => e.event === "ExecuteProposal"
      );

      // Verifies that the ExecuteProposal event has been emitted
      assert(executeProposalEventExists);

      await addAdmin2.transferOwnership(await avatar.owner());
      await addAdmin2.start();

      expect(await identity.isIdentityAdmin(outsider)).to.be.equal(true);

      await identity.renounceIdentityAdmin({ from: outsider });
    });

    it("should revert when adding to whitelisted twice", async () => {
      await identity.addWhitelisted(whitelisted);

      await helpers.assertVMException(
        identity.addWhitelisted(whitelisted),
        "VM Exception"
      );

      await identity.removeWhitelisted(whitelisted);
    });

    it("should revert when adding to blacklist twice", async () => {
      await identity.addBlacklisted(blacklisted);

      await helpers.assertVMException(
        identity.addBlacklisted(blacklisted),
        "VM Exception"
      );

      await identity.removeBlacklisted(blacklisted);
    });

    it("should not increment whitelisted counter when adding whitelisted", async () => {
      await identity.addWhitelisted(whitelisted);
      let whitelistedCount = await identity.whitelistedCount;

      await helpers.assertVMException(
        identity.addWhitelisted(whitelisted),
        "VM Exception"
      );

      let whitelistedCountNew = await identity.whitelistedCount;
      expect(whitelistedCountNew.toString()).to.be.equal(whitelistedCount.toString());

      await identity.removeWhitelisted(whitelisted);
    });

    it("should renounce whitelisted", async () => {
      await identity.addWhitelisted(whitelisted);
      assert(await identity.isWhitelisted(whitelisted));
      await identity.renounceWhitelisted({ from: whitelisted });
      assert(!(await identity.isWhitelisted(whitelisted)));
    });

    it("should add with did", async () => {
      await identity.addWhitelistedWithDID(whitelisted, "testString");

      const str = await identity.addrToDID(whitelisted);

      expect(str).to.be.equal("testString");
    });

    it("should not allow adding with used did", async () => {
      await helpers.assertVMException(
        identity.addWhitelistedWithDID(whitelisted2, "testString"),
        "DID already registered"
      );
    });

    it("should not allow transferring account to blacklisted", async () => {
      await helpers.assertVMException(
        identity.transferAccount(blacklisted2, { from: whitelisted }),
        "Cannot transfer to blacklisted"
      );
    });

    it("should not allow transferring account to address with funds", async () => {
      await token.transfer(outsider, helpers.toGD("1"));
      await helpers.assertVMException(
        identity.transferAccount(outsider, { from: whitelisted }),
        "Account is already in use"
      );
    });

    it("should not allow transferring account to address with did", async () => {
      const newUser = await web3.eth.personal.newAccount("123");
      await web3.eth.personal.unlockAccount(newUser, "123", 6000);

      await identity.addWhitelistedWithDID(newUser, "testString2");

      await helpers.assertVMException(
        identity.transferAccount(newUser, { from: whitelisted }),
        "address already has DID"
      );
    });

    it("should transfer account to new address", async () => {
      const newUser2 = await web3.eth.personal.newAccount("123");
      await web3.eth.personal.unlockAccount(newUser2, "123", 6000);

      const bal = await token.balanceOf(newUser2);
      expect(bal.toString()).to.be.equal(helpers.toGD("0"));

      await identity.transferAccount(newUser2, { from: whitelisted });

      assert(await identity.isWhitelisted(newUser2));
      const transferstring = await identity.addrToDID(newUser2);
      expect(transferstring).to.be.equal("testString");
    });

    it("should not keep did after transferring account", async () => {
      const emptyString = await identity.addrToDID(whitelisted);

      expect(emptyString).to.be.equal("");
    });

    it("should not allow setting non-registered identity contract", async () => {
      await helpers.assertVMException(
        identityGuard.setIdentity(dangerIdentity.address),
        "Identity is not registered"
      );
      dangerIdentity = await Identity.new();
    });

    it("should allow to set registered identity", async () => {
      assert(await identityGuard.setIdentity(identity.address));
    });

    it("should not allow adding non contract to contracts", async () => {
      await helpers.assertVMException(
        identity.addContract(outsider),
        "Given address is not a contract"
      );
    });
    it("should add contract to contracts", async () => {
      await identity.addContract(token.address);
      const wasAdded = await identity.isDAOContract(token.address);
      expect(wasAdded).to.be.true;
    });
  }
);

export {};
