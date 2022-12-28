const hre = require("hardhat");
const ethers = hre.ethers;
const { expect, assert } = require("chai");
const { Interface } = require("ethers/lib/utils");

const zeroAddress = "0x0000000000000000000000000000000000000000";

const iFace = new Interface([
    "function pause()",
    "function unpause()",
    "function setPriceAndMaxSupplyBatch(uint256[] calldata tokenIds, uint256[] calldata supplyAmounts, uint256 price_)"
])

describe("Contract Owner", function() {
  let testContract;
  let accounts;
  let contractOwner;
  before(async function() {
    accounts = await ethers.getSigners();
    const TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    const ContractOwner = await ethers.getContractFactory("ContractOwner");
    contractOwner = await ContractOwner.deploy(zeroAddress, accounts[0].address);
  })

  describe("Sending Funds to Test Contract", function() {

    it("Sending funds", async function() {
      const value = ethers.utils.parseEther("1")
      await accounts[0].sendTransaction({
        to: testContract.address,
        value: value
      })
      assert((await testContract.provider.getBalance(testContract.address)).eq(value), 
      "Not the expected balance of test contract");
    })
  })

  describe("Sending Funds to ContractOwner", function() {

    it("Mining(gas calculation)", async function(){
      await hre.network.provider.send("evm_mine");
    })

    it("Sending funds emits event", async function() {
      const value = ethers.utils.parseEther("0.42")
      expect(await accounts[0].sendTransaction({
          to: contractOwner.address,
          value: value
      })).to.emit("ReceivedEth").withArgs(accounts[0].address, value )
      assert((await testContract.provider.getBalance(contractOwner.address)).eq(ethers.utils.parseEther("0.42")));
    })
  })

  describe("Setting Owner to contract", function() {

    it("SetsOwner to contract", async function () {
      await testContract.transferOwnership(contractOwner.address);
      assert.equal((await testContract.owner()), contractOwner.address);
    })
  })

  describe("Setting delegate", function() {

    it("Only Super can set delegate", async function() {
      await expect(contractOwner.connect(accounts[1]).setDelegate(testContract.address))
      .to.be.revertedWithCustomError(contractOwner, "OnlySuperAdminCanExecuteThisFunction")
      expect(await contractOwner.setDelegate(testContract.address)).to.emit("DelegateSet")
      .withArgs(testContract.address);
    })
  })

  describe("SUPERADMIN using FallBack function on Contract Owner to admin testContract", function() {

    it("Original Owner can't set on testContract directly", async function () {
      await expect(testContract.pause()).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it("Only admins can perform", async function () {
      assert.equal((await contractOwner.superadmin()), accounts[0].address);
      const data  = iFace.encodeFunctionData("pause");
      await expect(accounts[1].sendTransaction({
        to: contractOwner.address,
        data: data
      })).to.be.revertedWithCustomError(
        contractOwner,
        "OnlyAdminsCanExecuteThisFunction"
      ) 
    })

    it("Pauses testContract through Contract Owner", async function () {
      const data  = iFace.encodeFunctionData("pause");
      await accounts[0].sendTransaction({
          to: contractOwner.address,
          data: data
      })
      assert(await testContract.paused(), "Should be paused")
    })

    it("Unpauses testContract through Contract Owner", async function () {
      const data  = iFace.encodeFunctionData("unpause");
      await accounts[0].sendTransaction({
          to: contractOwner.address,
          data: data
      })
      assert(!(await testContract.paused()), "Should be unpaused")
    })
  })

  describe("Administrating contractOwner Part 1", function() {

    it("Only Super sets admin", async function() {
      await expect(contractOwner.connect(accounts[1]).setAdmin(accounts[1].address))
      .to.be.revertedWithCustomError(contractOwner, "OnlySuperAdminCanExecuteThisFunction");
    })

    it("Can't set admin to zeroAddress", async function() {
      await expect(contractOwner.setAdmin(zeroAddress))
      .to.be.revertedWithCustomError(contractOwner, "CanNotSetToTheZeroAddress");
    })

    it("Super sets admin", async function() {
      const newAdmin = accounts[1].address
      expect(await contractOwner.setAdmin(newAdmin)).to.emit("AdminSet").withArgs(newAdmin);
    })

    it("Admin can't renounce super", async function() {
      await expect(contractOwner.connect(accounts[1]).renounceSuper()).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Admin can't change Super", async function() {
      await expect(contractOwner.connect(accounts[1]).setSuper(accounts[1].address)).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Admin can't withdraw from ContractOwner", async function() {
      await expect(contractOwner.connect(accounts[1]).withdrawal(accounts[8].address)).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Super admin withdraws from contractOwner", async function() {
      const withdrawAddress = accounts[8].address;
      const provider = testContract.provider;
      const preBalance = await provider.getBalance(withdrawAddress);
      await contractOwner.withdrawal(withdrawAddress)
      const postBalance = await provider.getBalance(withdrawAddress);
      assert((postBalance.sub(preBalance)).eq(ethers.utils.parseEther("0.42")))
    })
  })

  describe("ADMIN using FallBack function on Contract Owner to admin testContract", function() {
      
  it("Only admins can perform", async function () {
    assert.equal((await contractOwner.admin()), accounts[1].address);
    const data  = iFace.encodeFunctionData("pause");
    await expect(accounts[2].sendTransaction({
      to: contractOwner.address,
      data: data
    })).to.be.revertedWithCustomError(
      contractOwner,
      "OnlyAdminsCanExecuteThisFunction"
    ) 
  })

    it("Pauses testContract through Contract Owner", async function () {
      const data  = iFace.encodeFunctionData("pause");
      await accounts[1].sendTransaction({
        to: contractOwner.address,
        data: data
      })
      assert(await testContract.paused(), "Should be paused")
    })

    it("Unpauses testContract through Contract Owner", async function () {
      const data  = iFace.encodeFunctionData("unpause");
      await accounts[1].sendTransaction({
        to: contractOwner.address,
        data: data
      })
      assert(!(await testContract.paused()), "Should be unpaused")
    })
  })

 describe("Specific delegation functions on contract Part 1", function () {

    it("Admin still on", async function() {
      assert.equal((await contractOwner.admin()), accounts[1].address);
    })

    it("Admin can't withdraw from testContract", async function() {
      await expect(contractOwner.connect(accounts[1]).withdraw(accounts[9].address)).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Admin can't withdrawToSender from testContract", async function() {
      await expect(contractOwner.connect(accounts[1]).withdrawToSender()).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    });

    it("SuperAdmin withdraws balance from testContract", async function() {
      const withdrawAddress = accounts[9].address;
      const provider = testContract.provider;
      const PreBalance = await provider.getBalance(withdrawAddress)
      expect(await contractOwner.withdraw(withdrawAddress)).to.emit("BalanceWithdrawn").withArgs(withdrawAddress);
      assert((await testContract.provider.getBalance(testContract.address)).eq("0"), "Not the expected Balance on testContract")
      const PostBalance = await provider.getBalance(withdrawAddress)
      assert(PostBalance.sub(PreBalance).eq(ethers.utils.parseEther("1.0")));
    })

    it("SuperAdmin withdrawsToSender from testContract", async function() {
      const provider = testContract.provider;
      const value = ethers.utils.parseEther("1.0")
      await accounts[0].sendTransaction({
        to: testContract.address,
        value: value
      })
      assert((await testContract.provider.getBalance(testContract.address)).eq(value), "Not the expected balance on testContract")
      const withdrawAddress = accounts[0].address;
      const PreBalance = await provider.getBalance(withdrawAddress);
      expect(await contractOwner.withdrawToSender()).to.emit("BalanceWithdrawn").withArgs(withdrawAddress);
      assert((await testContract.provider.getBalance(testContract.address)).eq("0"), "Not the expected Balance on testContract")
      const PostBalance = await provider.getBalance(withdrawAddress)
      console.log(PreBalance.toString(), PostBalance.toString());
      //assert(PostBalance.sub(PreBalance).eq(ethers.utils.parseEther("1.0")))
    })

    it("Admin Can't renounce Ownership of edtions", async function() {
      await expect(contractOwner.connect(accounts[1]).renounceOwnership())
      .to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Admin Can't Transfer ownership to another signer", async function() {
      await expect(contractOwner.connect(accounts[1]).transferOwnership(accounts[1].address))
      .to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })
  })
 
  describe("Administrating contractOwner Part 2", function() {

    it("Super changes Admin", async function() {
      const newAdmin = accounts[2].address;
      expect(await contractOwner.setAdmin(newAdmin)).to.emit("AdminSet").withArgs(newAdmin);
      assert.equal(await contractOwner.admin(), newAdmin);
    })

    it("Super renounces Admin", async function () {
      await contractOwner.renounceAdmin();
      assert.equal(await contractOwner.admin(), "0x0000000000000000000000000000000000000000" );
    })
  })

  describe("Kill Switch deactivation and auto activation", function () {
    it("Only Super can turn off kill switch", async function () {
      await expect(contractOwner.connect(accounts[1]).turnOffKillSwitch()).to.be.revertedWithCustomError(
        contractOwner,
        "OnlySuperAdminCanExecuteThisFunction"
      )
    })

    it("Switching off emits event", async function () {
      expect(await contractOwner.turnOffKillSwitch()).to.emit("KillSwitchDisengaged");
    })

    it("Kill Switch auto turns on after 40 blocks", async function() {
      assert(await contractOwner.killSwitchOff(), "Kill Switch should be ON");
      await hre.network.provider.send("hardhat_mine", ["0x29"]);
      assert(!(await contractOwner.killSwitchOff()), "Kill Switch should be OFF");
    })
  })

  describe("Specific delegation functions on contract Part 2", function() {

    it("Transfering ownership of owned contract requires disengaging kill switch", async function() {
      await expect(contractOwner.transferOwnership(accounts[1].address)).to.be.revertedWithCustomError(
        contractOwner,
        "KillSwitchIsEngaged"
      );
      await contractOwner.turnOffKillSwitch();
    })

    it("Transfers ownership to another signer", async function() {
      await contractOwner.transferOwnership(accounts[1].address);
      assert.equal(await testContract.owner(), accounts[1].address, "Not the expected Owner");
      await testContract.connect(accounts[1]).pause()
    })
  })

  describe("Administrating contractOwner Part 3", function() {

    it("Super transfer requires disengaging kill switch", async function () {
      await expect(contractOwner.setSuper(accounts[1].address)).to.be.revertedWithCustomError(
        contractOwner,
        "KillSwitchIsEngaged"
      );
      await contractOwner.turnOffKillSwitch();
    })

    it("Can't set Super to zeroAddress", async function () {
      await expect(contractOwner.setSuper(zeroAddress)).to.be.revertedWithCustomError(
        contractOwner,
        "CanNotSetToTheZeroAddress"
      )
    })

    it("Super transfers ownership of contractOwner", async function () {
      const newSuper = accounts[1].address;
      expect(await contractOwner.setSuper(newSuper)).to.emit("SuperAdminSet")
      .withArgs(newSuper);
    })

    it("Renouncing Super requires disengaging Kill Switch", async function () {
      await expect(contractOwner.connect(accounts[1]).renounceSuper()).to.be.revertedWithCustomError(
        contractOwner,
        "KillSwitchIsEngaged"
      );
      await contractOwner.connect(accounts[1]).turnOffKillSwitch();
    })

    it("Super Renounces Ownership of contractOwner", async function() {
      expect(await contractOwner.connect(accounts[1]).renounceSuper()).to.emit("SuperAdminSet").withArgs(zeroAddress);
      assert.equal(await contractOwner.superadmin(), zeroAddress);
    })
  })
})