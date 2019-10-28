import * as helpers from "./helpers";

const Identity = artifacts.require("Identity");
const Avatar = artifacts.require("Avatar");
const GoodDollar = artifacts.require("GoodDollar");
const ControllerInterface = artifacts.require("ControllerInterface");
const SchemeRegistrar = artifacts.require("SchemeRegistrar");
const AbsoluteVote = artifacts.require("AbsoluteVote");
const AdminWallet = artifacts.require("AdminWallet");
const DaoCreatorGoodDollar = artifacts.require("DaoCreatorGoodDollar");
const SignUpBonus = artifacts.require("SignUpBonus");

contract("AdminWallet", ([founder, whitelisted, stranger, stranger2, blacklisted]) => {
  let identity: helpers.ThenArg<ReturnType<typeof Identity["new"]>>;
  let avatar: helpers.ThenArg<ReturnType<typeof Avatar["new"]>>;
  let token: helpers.ThenArg<ReturnType<typeof GoodDollar["new"]>>;
  let adminWallet: helpers.ThenArg<ReturnType<typeof AdminWallet["new"]>>;
  let newWallet: helpers.ThenArg<ReturnType<typeof AdminWallet["new"]>>;
  let signupBonus: helpers.ThenArg<ReturnType<typeof SignUpBonus["new"]>>;

  let toppingAmount;
  let toppingTimes;
  let newUser;
  let newUser2;
  let admin;
  let admin2;
  let admin3;
  let admin4;
  let admin5;
  let admin6;
  let admin7;
  let admin8;
  let admin9;
  let admin10;

  before(async () => {
    identity = await Identity.deployed();
    adminWallet = await AdminWallet.deployed();
    signupBonus = await SignUpBonus.deployed();

    avatar = await Avatar.at(
      await (await DaoCreatorGoodDollar.deployed()).avatar()
    );
    token = await GoodDollar.at(await avatar.nativeToken());

    toppingTimes = await adminWallet.toppingTimes();
    toppingAmount = await adminWallet.toppingAmount().then(_ => _.toNumber());

    newWallet = await AdminWallet.new([founder], toppingAmount, toppingTimes, identity.address);

    newUser = await web3.eth.personal.newAccount("123");
    newUser2 = await web3.eth.personal.newAccount("123");
    admin = await web3.eth.personal.newAccount("123");
    admin2 = await web3.eth.personal.newAccount("123");
    admin3 = await web3.eth.personal.newAccount("123");
    admin4 = await web3.eth.personal.newAccount("123");
    admin5 = await web3.eth.personal.newAccount("123");
    admin6 = await web3.eth.personal.newAccount("123");
    admin7 = await web3.eth.personal.newAccount("123");
    admin8 = await web3.eth.personal.newAccount("123");
    admin9 = await web3.eth.personal.newAccount("123");
    admin10 = await web3.eth.personal.newAccount("123");
    await web3.eth.personal.unlockAccount(newUser, "123", 6000);
    await web3.eth.personal.unlockAccount(newUser2, "123", 6000);
    await web3.eth.personal.unlockAccount(admin, "123", 6000);
    await web3.eth.personal.unlockAccount(admin2, "123", 6000);
    await web3.eth.personal.unlockAccount(admin3, "123", 6000);
    await web3.eth.personal.unlockAccount(admin4, "123", 6000);
    await web3.eth.personal.unlockAccount(admin5, "123", 6000);
    await web3.eth.personal.unlockAccount(admin6, "123", 6000);
    await web3.eth.personal.unlockAccount(admin7, "123", 6000);
    await web3.eth.personal.unlockAccount(admin8, "123", 6000);
    await web3.eth.personal.unlockAccount(admin9, "123", 6000);
    await web3.eth.personal.unlockAccount(admin10, "123", 6000);
    await web3.eth.sendTransaction({
      to: admin,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin2,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin3,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin4,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin5,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin6,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin7,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin8,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin9,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
    await web3.eth.sendTransaction({
      to: admin10,
      from: founder,
      value: web3.utils.toWei("1", "ether")
    });
  });

  it("should fill wallet", async () => {
    await web3.eth.sendTransaction({
      to: adminWallet.address,
      from: founder,
      value: web3.utils.toWei("50", "ether")
    });
  });

  it("should add admins", async () => {
    await adminWallet.addAdmins([
      whitelisted,
      admin,
      admin2,
      admin3,
      admin4,
      admin5,
      admin6,
      admin7,
      admin8,
      admin9,
      admin10
    ]);
    assert(await adminWallet.isAdmin(whitelisted));
  });

  it("should remove single admin", async () => {
    await adminWallet.removeAdmins([whitelisted]);
    assert(!(await adminWallet.isAdmin(whitelisted)));
  });

  it("should allow admin to whitelist and remove whitelist", async () => {
    assert(!(await identity.isWhitelisted(whitelisted)));
    await adminWallet.whitelist(whitelisted, { from: admin4 });

    assert(await identity.isWhitelisted(whitelisted));
    await adminWallet.removeWhitelist(whitelisted, { from: admin5 });
    assert(!(await identity.isWhitelisted(whitelisted)));
  });

  it("should not allow non-admin to whitelist and remove whitelist", async () => {
    assert(!(await identity.isWhitelisted(whitelisted)));
    await helpers.assertVMException(
      adminWallet.whitelist(whitelisted, { from: stranger }),
      "Caller is not admin"
    );
    assert(!(await identity.isWhitelisted(whitelisted)));
    await adminWallet.whitelist(whitelisted, { from: admin6 });
    assert(await identity.isWhitelisted(whitelisted));
    await helpers.assertVMException(
      adminWallet.removeWhitelist(whitelisted, { from: stranger }),
      "Caller is not admin"
    );
    assert(await identity.isWhitelisted(whitelisted));
  });

  it("should allow admin to blacklist and remove blacklist", async () => {
    assert(!(await identity.isBlacklisted(blacklisted)));
    await adminWallet.blacklist(blacklisted, { from: admin7 });

    assert(await identity.isBlacklisted(blacklisted));
    await adminWallet.removeBlacklist(blacklisted, { from: admin8 });
    assert(!(await identity.isBlacklisted(blacklisted)));
  });

  it("should not allow non-admin to blacklist and remove blacklist", async () => {
    assert(!(await identity.isBlacklisted(blacklisted)));
    await helpers.assertVMException(
      adminWallet.blacklist(blacklisted, { from: stranger }),
      "Caller is not admin"
    );
    assert(!(await identity.isBlacklisted(blacklisted)));
    await adminWallet.blacklist(blacklisted, { from: admin9 });
    assert(await identity.isBlacklisted(blacklisted));
    await helpers.assertVMException(
      adminWallet.removeBlacklist(blacklisted, { from: stranger }),
      "Caller is not admin"
    );
    assert(await identity.isBlacklisted(blacklisted));
    await adminWallet.removeBlacklist(blacklisted, { from: admin10 });
    assert(!(await identity.isBlacklisted(blacklisted)));
  });

  it("should not allow to top wallet if user balance is too high", async () => {
    await helpers.assertVMException(
      adminWallet.topWallet(whitelisted),
      "User balance too high"
    );
  });

  it("should allow to top wallet", async () => {
    assert((await web3.eth.getBalance(newUser).then(parseInt)) == 0);
    await adminWallet.topWallet(newUser, { from: admin });
    assert((await web3.eth.getBalance(newUser).then(parseInt)) > 0);
    await web3.eth.sendTransaction({
      to: adminWallet.address,
      from: newUser,
      value: toppingAmount * 0.9
    });
  });

  it("should not allow to top wallet more than three times", async () => {
    await adminWallet.topWallet(newUser, { from: admin2 });
    await web3.eth.sendTransaction({
      to: adminWallet.address,
      from: newUser,
      value: toppingAmount * 0.9
    });
    await web3.eth.sendTransaction({
      to: adminWallet.address,
      from: admin2,
      value: toppingAmount
    });
    await adminWallet.topWallet(newUser, { from: admin2 });
    await web3.eth.sendTransaction({
      to: adminWallet.address,
      from: newUser,
      value: toppingAmount * 0.9
    });

    await helpers.assertVMException(
      adminWallet.topWallet(newUser),
      "User wallet has been topped too many times today"
    );
  });

  it("should not allow whitelisting and awarding before setting signup", async () => {
    await helpers.assertVMException(
      newWallet.whitelistAndAwardUser(stranger, 1, { from: founder }),
      "SignUp bonus has not been set yet"
    );
  });

  it("should whitelist user", async () => {
    assert(!(await identity.isWhitelisted(stranger2)));
    await adminWallet.whitelistAndAwardUser(stranger2, 0, { from: founder });
    assert(await identity.isWhitelisted(stranger2));
  })

  it("should award users without whitelisting", async () => {
    await adminWallet.whitelistAndAwardUser(stranger2, 5, { from: founder });
  })
});

export {};
