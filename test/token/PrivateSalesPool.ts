/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ExchangeReservePool, Forwarder, GNZToken, PrivateSalesPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { Wallet } from 'ethers';
import { addBlockchainTime, dayToMs, expectIgnoreMs, getNewTestStartDate, monthToMs, setBlockchainDate } from '../date-utils';

/*
 * WARNING, this test test private sales pool AND vesting pool
 * In case of delete private sales pool, don't remove tests, move in other testsuite
 */

const MAX_BATCH_SIZE = 100; // Must match with batch max size of contract

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

type DeployPrivateSalesPoolReturn = DeployTokenReturn & {
  privateSalesPool: PrivateSalesPool;
};

type DeployTokenPrivateSalesAndReservePoolReturn = DeployPrivateSalesPoolReturn & {
  exchangeReservePool: ExchangeReservePool;
};

// Contain the specific test of PrivateSalesPool and Vesting functionality
describe('PrivateSalesPool', function () {
  const startDate = getNewTestStartDate();

  async function deployToken(): Promise<DeployTokenReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const tokenFactory = await ethers.getContractFactory('GNZToken');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const token = (await upgrades.deployProxy(tokenFactory, ['Genezys Token', 'GNZ', BigInt(6_000_000_000)], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as GNZToken;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { token, forwarder, owner, otherAccount1, otherAccount2 };
  }

  async function deployPrivateSalesPool(): Promise<DeployPrivateSalesPoolReturn> {
    const deployTokenResult = await deployToken();

    const privateSalesPoolFactory = await ethers.getContractFactory('PrivateSalesPool');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const privateSalesPool = (await upgrades.deployProxy(
      privateSalesPoolFactory,
      [await deployTokenResult.token.getAddress(), monthToMs(2), monthToMs(12)],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as PrivateSalesPool;
    await privateSalesPool.grantRole(await privateSalesPool.POOL_MANAGER_ROLE(), deployTokenResult.owner);
    await privateSalesPool.grantRole(await privateSalesPool.POOL_PLATFORM_ROLE(), deployTokenResult.owner);

    await deployTokenResult.token.registerPool(await privateSalesPool.getAddress(), 100_000);

    return { ...deployTokenResult, privateSalesPool };
  }

  async function deployTokenPrivateSalesAndReservePool(): Promise<DeployTokenPrivateSalesAndReservePoolReturn> {
    const deployTokenAndPrivateSalesPoolResult = await deployPrivateSalesPool();

    // Deploy transferPool
    const transferPoolFactory = await ethers.getContractFactory('ExchangeReservePool');
    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const exchangeReservePool = (await upgrades.deployProxy(
      transferPoolFactory,
      [await deployTokenAndPrivateSalesPoolResult.token.getAddress()],
      {
        constructorArgs: [await deployTokenAndPrivateSalesPoolResult.forwarder.getAddress()],
      },
    )) as unknown as ExchangeReservePool;

    await deployTokenAndPrivateSalesPoolResult.token.registerPool(await exchangeReservePool.getAddress(), 100_000);

    return { ...deployTokenAndPrivateSalesPoolResult, exchangeReservePool };
  }

  describe('addVesting', function () {
    it('should add one vestings', async () => {
      const { privateSalesPool, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;

      expect(await privateSalesPool.getPagination()).to.equal(1);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(120);
      expectIgnoreMs(await privateSalesPool.start(await otherAccount1.getAddress()), startDate.getTime() + monthToMs(2));
      expectIgnoreMs(await privateSalesPool.end(await otherAccount1.getAddress()), startDate.getTime() + monthToMs(2) + monthToMs(12));
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.totalAllocation(await otherAccount1.getAddress())).to.equal(120);

      expect(await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(1))).to.equal(0);
      expect(
        await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(2) + dayToMs(15) + 1), // +1ms to be shure validate number
      ).to.equal(5);
      expect(await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(3) + 1)).to.equal(10);
      expect(await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(12) + 1)).to.equal(100);
      expect(await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(14) + 1)).to.equal(120);
      expect(await privateSalesPool.vestedAmount(await otherAccount1.getAddress(), startDate.getTime() + monthToMs(15) + 1)).to.equal(120);
    });

    it('should add multiples vestings', async () => {
      const { privateSalesPool } = await loadFixture(deployPrivateSalesPool);
      const NB_SIGNERS_STEP1 = 150;
      const NB_SIGNERS_STEP2 = 51;

      for (let i = 0; i < NB_SIGNERS_STEP1; i++) {
        await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 100)).not.be.reverted;
      }

      expect(await privateSalesPool.getPagination()).to.equal(Math.ceil(NB_SIGNERS_STEP1 / MAX_BATCH_SIZE));
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(100 * NB_SIGNERS_STEP1);

      for (let i = 1; i <= NB_SIGNERS_STEP2; i++) {
        await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 50)).not.be.reverted;
      }
      expect(await privateSalesPool.getPagination()).to.equal(Math.ceil((NB_SIGNERS_STEP1 + NB_SIGNERS_STEP2) / MAX_BATCH_SIZE));
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(100 * NB_SIGNERS_STEP1 + 50 * NB_SIGNERS_STEP2);
    });

    it('should not add same vestings user', async () => {
      const { privateSalesPool, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).revertedWithCustomError(privateSalesPool, 'InvalidInput');
    });

    it('should not vestings more than max in pool', async () => {
      const { privateSalesPool } = await loadFixture(deployPrivateSalesPool);

      await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 90_000)).not.be.reverted;
      await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 10_000)).not.be.reverted;
      await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 10_000)).revertedWithCustomError(
        privateSalesPool,
        'MissingTokens',
      );
    });

    it('should not add when not admin', async () => {
      const { privateSalesPool, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await expect(privateSalesPool.connect(otherAccount1).addVesting(Wallet.createRandom().address, 90_000)).be.revertedWithCustomError(
        privateSalesPool,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('release', function () {
    it('should release one vestings at multiple time', async () => {
      const { privateSalesPool, token, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;

      // + 1 mount
      await addBlockchainTime(monthToMs(1));
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(120);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);

      // + 2 mount
      await addBlockchainTime(monthToMs(1));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(120);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);

      // + 2.5 mount
      await addBlockchainTime(dayToMs(15));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(5);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(5);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(115);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(5);

      // + 3 mount
      await addBlockchainTime(dayToMs(15));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(5);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(10);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(110);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(10);

      // + 4 mount
      await addBlockchainTime(monthToMs(1));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(10);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(20);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(100);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(20);

      // + 10 mount
      await addBlockchainTime(monthToMs(6));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(60);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(80);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(40);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(80);

      // + 14 mount
      await addBlockchainTime(monthToMs(4));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(40);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);

      // + 15 mount
      await addBlockchainTime(monthToMs(4));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
    });

    it('sould release all token of pool', async () => {
      const { privateSalesPool, token, otherAccount1, otherAccount2 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 50_000)).not.be.reverted;
      await expect(privateSalesPool.addVesting(otherAccount2, 50_000)).not.be.reverted;
      await addBlockchainTime(monthToMs(15));

      await expect(privateSalesPool.release(otherAccount1)).not.be.reverted;
      await expect(privateSalesPool.release(otherAccount2)).not.be.reverted;

      expect(await privateSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(0);
      expect(await privateSalesPool.getReservedTokens()).to.equal(0);
      expect(await privateSalesPool.getDistributedTokens()).to.equal(100_000);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(50_000);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(50_000);
    });

    it('should not release if not releasabler', async () => {
      const { privateSalesPool, token, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;

      await addBlockchainTime(monthToMs(15));
      await expect(privateSalesPool.connect(otherAccount1).release(otherAccount1)).be.revertedWithCustomError(
        privateSalesPool,
        'AccessControlUnauthorizedAccount',
      );

      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(120);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
    });

    it('should release me', async () => {
      const { privateSalesPool, token, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;

      // + 3 mount
      await addBlockchainTime(monthToMs(3));
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(10);
      await expect(privateSalesPool.connect(otherAccount1).releaseMe()).not.be.reverted;
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(10);
      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(110);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(10);
    });
  });

  describe('releaseAll', function () {
    it('should release multiple vestings at multiple time', async () => {
      const { privateSalesPool, token, otherAccount1, otherAccount2 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;
      await expect(privateSalesPool.addVesting(otherAccount2, 1_200)).not.be.reverted;

      // + 1 mount
      await addBlockchainTime(monthToMs(1));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 2 mount
      await addBlockchainTime(monthToMs(1));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 2.5 mount
      await addBlockchainTime(dayToMs(15));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(5);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(5);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(50);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(50);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 55);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 3 mount
      await addBlockchainTime(dayToMs(15));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(10);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(10);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(100);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(100);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 110);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 4 mount
      await addBlockchainTime(monthToMs(1));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(20);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(20);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(200);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(200);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 220);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 10 mount
      await addBlockchainTime(monthToMs(6));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(80);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(80);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(800);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(800);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 880);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 14 mount
      await addBlockchainTime(monthToMs(4));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(1200);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(1200);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 1320);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);

      // + 15 mount
      await addBlockchainTime(monthToMs(4));
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.released(await otherAccount2.getAddress())).to.equal(1200);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(1200);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(1320 - 1320);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_200);
    });

    it('should release multiple vestings with multiple page', async () => {
      const { privateSalesPool, token } = await loadFixture(deployPrivateSalesPool);
      const wallets: string[] = [];
      for (let i = 0; i < MAX_BATCH_SIZE * 2; i++) {
        wallets.push(Wallet.createRandom().address);
      }

      await setBlockchainDate(startDate);
      let halfTotalToken = 0;
      let totalToken = 0;
      for (let i = 1; i <= wallets.length; i++) {
        await expect(privateSalesPool.addVesting(wallets[i - 1], i)).not.be.reverted;
        if (i <= MAX_BATCH_SIZE) halfTotalToken += i;
        totalToken += i;
      }

      expect(await privateSalesPool.getTotalUnreleased()).to.equal(totalToken);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - totalToken);
      await addBlockchainTime(monthToMs(15));
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(totalToken);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - totalToken);

      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(totalToken - halfTotalToken);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - totalToken);
      expect(await token.balanceOf(wallets[0])).to.equal(1);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE - 1])).to.equal(MAX_BATCH_SIZE);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE])).to.equal(0);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE * 2 - 1])).to.equal(0);

      expect(await privateSalesPool.isAllReleaseable(1)).to.equal(true);
      await expect(privateSalesPool.releaseAll(1)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(1)).to.equal(false);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - totalToken);
      expect(await token.balanceOf(wallets[0])).to.equal(1);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE - 1])).to.equal(MAX_BATCH_SIZE);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE])).to.equal(MAX_BATCH_SIZE + 1);
      expect(await token.balanceOf(wallets[MAX_BATCH_SIZE * 2 - 1])).to.equal(MAX_BATCH_SIZE * 2);
    });

    it('sould release all token of pool', async () => {
      const { privateSalesPool, token, otherAccount1, otherAccount2 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 50_000)).not.be.reverted;
      await expect(privateSalesPool.addVesting(otherAccount2, 50_000)).not.be.reverted;
      await addBlockchainTime(monthToMs(15));

      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);

      expect(await privateSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(0);
      expect(await privateSalesPool.getReservedTokens()).to.equal(0);
      expect(await privateSalesPool.getDistributedTokens()).to.equal(100_000);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(50_000);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(50_000);
    });

    it('should not release if not releasabler', async () => {
      const { privateSalesPool, token, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted;

      await addBlockchainTime(monthToMs(15));
      await expect(privateSalesPool.connect(otherAccount1).releaseAll(0)).be.revertedWithCustomError(
        privateSalesPool,
        'AccessControlUnauthorizedAccount',
      );

      expect(await privateSalesPool.releasable(await otherAccount1.getAddress())).to.equal(120);
      expect(await privateSalesPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await privateSalesPool.getTotalUnreleased()).to.equal(120);
      expect(await privateSalesPool.getAvailableTokens()).to.equal(100_000 - 120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
    });
  });

  describe('cleanListAll', function () {
    it('should cleanListAll correclty', async () => {
      const { privateSalesPool, token, otherAccount1 } = await loadFixture(deployPrivateSalesPool);

      await setBlockchainDate(startDate);
      for (let i = 0; i < MAX_BATCH_SIZE; i++) {
        await expect(privateSalesPool.addVesting(Wallet.createRandom().address, 120)).not.be.reverted;
      }

      await addBlockchainTime(monthToMs(15));
      await expect(privateSalesPool.addVesting(otherAccount1, 120)).not.be.reverted; // In page 1

      expect(await privateSalesPool.isCleanable()).to.equal(false);
      expect(await privateSalesPool.getPagination()).to.equal(2);

      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true);
      expect(await privateSalesPool.isAllReleaseable(1)).to.equal(false); // contains only otherAccount1, but not started
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      await expect(privateSalesPool.releaseAll(1)).not.be.reverted;
      expect(await token.balanceOf(otherAccount1.address)).to.equal(0);
      expect(await privateSalesPool.isCleanable()).to.equal(true);
      await expect(privateSalesPool.cleanReleased()).not.be.reverted; // otherAccount1 should move one page 0
      expect(await privateSalesPool.isCleanable()).to.equal(false);
      expect(await privateSalesPool.getPagination()).to.equal(1);

      await addBlockchainTime(monthToMs(8) + 1);
      expect(await privateSalesPool.isCleanable()).to.equal(false);
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(true); // contains only otherAccount1, and now started
      await expect(privateSalesPool.releaseAll(0)).not.be.reverted;
      expect(await privateSalesPool.isAllReleaseable(0)).to.equal(false);
      expect(await token.balanceOf(otherAccount1.address)).to.equal(60);
      expect(await privateSalesPool.isCleanable()).to.equal(false);
      expect(await privateSalesPool.getPagination()).to.equal(1);
    });
  });

  describe('close', function () {
    it('should transfer the remaining token allocation to another pool', async () => {
      const { privateSalesPool, exchangeReservePool, token } = await loadFixture(deployTokenPrivateSalesAndReservePool);

      await expect(privateSalesPool.close(await exchangeReservePool.getAddress())).not.be.reverted;
      expect(await privateSalesPool.getReservedTokens()).to.equal(0);
      expect(await exchangeReservePool.getReservedTokens()).to.equal(200_000);

      const tokenPrivateSalesPool = await token.getPool(await privateSalesPool.getAddress());
      expect(tokenPrivateSalesPool[0]).to.equal(await privateSalesPool.getAddress());
      expect(tokenPrivateSalesPool[1]).to.equal(0);
      expect(tokenPrivateSalesPool[2]).to.equal(0);

      const tokenExchangeReservePool = await token.getPool(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[0]).to.equal(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[1]).to.equal(200_000);
      expect(tokenExchangeReservePool[2]).to.equal(0);
    });

    it('should transfer the remaining token allocation to another pool but keep vested amount', async () => {
      const { privateSalesPool, exchangeReservePool, token, otherAccount1, otherAccount2 } = await loadFixture(
        deployTokenPrivateSalesAndReservePool,
      );

      await expect(privateSalesPool.addVesting(await otherAccount1.getAddress(), 50_000)).not.be.reverted;
      await expect(privateSalesPool.addVesting(await otherAccount2.getAddress(), 25_000)).not.be.reverted;

      await expect(privateSalesPool.close(await exchangeReservePool.getAddress())).not.be.reverted;
      expect(await privateSalesPool.getReservedTokens()).to.equal(75_000);
      expect(await exchangeReservePool.getReservedTokens()).to.equal(125_000);

      const tokenPrivateSalesPool = await token.getPool(await privateSalesPool.getAddress());
      expect(tokenPrivateSalesPool[0]).to.equal(await privateSalesPool.getAddress());
      expect(tokenPrivateSalesPool[1]).to.equal(75_000);
      expect(tokenPrivateSalesPool[2]).to.equal(0);

      const tokenExchangeReservePool = await token.getPool(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[0]).to.equal(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[1]).to.equal(125_000);
      expect(tokenExchangeReservePool[2]).to.equal(0);
    });
  });
});
