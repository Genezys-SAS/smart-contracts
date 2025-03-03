/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, PartnerPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { Wallet } from 'ethers';
import { addBlockchainTime, expectIgnoreMs, getNewTestStartDate, isEqualsDateIgnoreMs, monthToMs, setBlockchainDate } from '../date-utils';

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
};

type DeployPartnerPoolReturn = DeployTokenReturn & {
  partnerPool: PartnerPool;
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

// Contain the specific test of PartnerPool and Monthly release functionality
describe('PartnerPool', function () {
  const startDate = getNewTestStartDate();

  async function deployToken(): Promise<DeployTokenReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const tokenFactory = await ethers.getContractFactory('GNZToken');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const token = (await upgrades.deployProxy(tokenFactory, ['Genezys Token', 'GNZ', BigInt(6_000_000_000)], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as GNZToken;

    return { token, forwarder };
  }

  async function deployPartnerPool(): Promise<DeployPartnerPoolReturn> {
    const deployTokenResult = await deployToken();

    const partnerPoolFactory = await ethers.getContractFactory('PartnerPool');

    const [deployer, admin, manager, platform, otherAccount1, otherAccount2] = await ethers.getSigners();

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const partnerPool = (await upgrades.deployProxy(
      partnerPoolFactory,
      [
        await deployTokenResult.token.getAddress(),
        await admin.getAddress(),
        await manager.getAddress(),
        await platform.getAddress(),
        startDate.getTime(),
        monthToMs(12),
      ],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as PartnerPool;

    await deployTokenResult.token.registerPool(await partnerPool.getAddress(), 120_000); // 10_000 by mount

    await setBlockchainDate(startDate);
    return { ...deployTokenResult, partnerPool, deployer, admin, manager, platform, otherAccount1, otherAccount2 };
  }

  describe('init', function () {
    it('should init correclty', async () => {
      const { partnerPool, platform } = await loadFixture(deployPartnerPool);

      expect(await partnerPool.connect(platform).poolReleased()).to.equals(0);
      expect(await partnerPool.getAvailableTokens()).to.equals(0);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await partnerPool.poolVestedAmount(startDate.getTime())).to.equals(0);
      expect(await partnerPool.poolVestedAmount(startDate.getTime() + monthToMs(1))).to.equals(10_000);
      expect(await partnerPool.poolVestedAmount(startDate.getTime() + monthToMs(6))).to.equals(60_000);
      expect(await partnerPool.poolVestedAmount(startDate.getTime() + monthToMs(12))).to.equals(120_000);
      expect(await partnerPool.poolVestedAmount(startDate.getTime() + monthToMs(13))).to.equals(120_000);
      expectIgnoreMs(await partnerPool.poolStart(), startDate.getTime());
      expectIgnoreMs(await partnerPool.poolEnd(), startDate.getTime() + monthToMs(12));
      expectIgnoreMs(await partnerPool.poolDuration(), monthToMs(12));
    });
  });

  describe('poolRelease', function () {
    it('should distribute token correclty', async () => {
      const { partnerPool, token, platform } = await loadFixture(deployPartnerPool);

      // +1 month
      await addBlockchainTime(monthToMs(1));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(0);
      expect(await partnerPool.getAvailableTokens()).to.equals(0);
      expect(await partnerPool.poolReleasable()).to.equals(10_000);
      let release = partnerPool.connect(platform).poolRelease();
      await expect(release)
        .emit(partnerPool, 'PoolReleaseEvent')
        .withArgs(10_000, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(1)));
      await expect(release).not.reverted;
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(10_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(10_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);

      // +6 month
      await addBlockchainTime(monthToMs(5));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(10_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(10_000);
      expect(await partnerPool.poolReleasable()).to.equals(50_000);
      release = partnerPool.connect(platform).poolRelease();
      await expect(release)
        .emit(partnerPool, 'PoolReleaseEvent')
        .withArgs(50_000, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(6)));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(60_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(60_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);

      // +12 month
      await addBlockchainTime(monthToMs(6));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(60_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(60_000);
      expect(await partnerPool.poolReleasable()).to.equals(60_000);
      release = partnerPool.connect(platform).poolRelease();
      await expect(release)
        .emit(partnerPool, 'PoolReleaseEvent')
        .withArgs(60_000, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(12)));
      await expect(release).not.reverted;
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(120_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(120_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);

      // +13 month
      await addBlockchainTime(monthToMs(1));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(120_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(120_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      release = partnerPool.connect(platform).poolRelease();
      await expect(release)
        .emit(partnerPool, 'PoolReleaseEvent')
        .withArgs(0, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(13)));
      expect(await partnerPool.connect(platform).poolReleased()).to.equals(120_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(120_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);
    });

    it('should not release if not releasaber', async () => {
      const { partnerPool, token, platform, otherAccount1 } = await loadFixture(deployPartnerPool);

      await addBlockchainTime(monthToMs(15));
      await expect(partnerPool.connect(otherAccount1).release(otherAccount1)).be.revertedWithCustomError(
        partnerPool,
        'AccessControlUnauthorizedAccount',
      );

      expect(await partnerPool.connect(platform).poolReleased()).to.equals(0);
      expect(await partnerPool.getAvailableTokens()).to.equals(0);
      expect(await partnerPool.poolReleasable()).to.equals(120_000);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);
    });

    it('Sould poolRelease as platform', async () => {
      const { partnerPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployPartnerPool);

      for (const account of [manager, admin, otherAccount1, deployer]) {
        await expect(partnerPool.connect(account).poolRelease()).revertedWithCustomError(partnerPool, 'AccessControlUnauthorizedAccount');
      }
      await expect(partnerPool.connect(platform).poolRelease()).not.reverted;
    });
  });

  describe('addVesting', function () {
    it('should not addVesting if not manager', async () => {
      const { partnerPool, token, platform, otherAccount1 } = await loadFixture(deployPartnerPool);

      await addBlockchainTime(monthToMs(15));
      await partnerPool.connect(platform).poolRelease();

      await expect(partnerPool.connect(otherAccount1).addVesting(otherAccount1.address, 5_000, monthToMs(6), 0)).be.revertedWithCustomError(
        partnerPool,
        'AccessControlUnauthorizedAccount',
      );

      expect(await partnerPool.poolReleased()).to.equals(120_000);
      expect(await partnerPool.getAvailableTokens()).to.equals(120_000);
      expect(await partnerPool.poolReleasable()).to.equals(0);
      expect(await token.balanceOf(partnerPool.getAddress())).to.equal(0);
    });

    it('Sould addVesting as manager', async () => {
      const { partnerPool, deployer, manager, admin, platform, otherAccount1, otherAccount2 } = await loadFixture(deployPartnerPool);

      await addBlockchainTime(monthToMs(15));
      await partnerPool.connect(platform).poolRelease();

      for (const account of [platform, admin, otherAccount1, deployer]) {
        await expect(partnerPool.connect(account).addVesting(otherAccount2.address, 5_000, monthToMs(6), 0)).revertedWithCustomError(
          partnerPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(partnerPool.connect(manager).addVesting(otherAccount2.address, 5_000, monthToMs(6), 0)).not.reverted;
    });
  });

  describe('poolRelease and addVesting', function () {
    it('should only add in versting unlocked token', async () => {
      const { partnerPool, token, manager, platform, otherAccount1 } = await loadFixture(deployPartnerPool);

      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        partnerPool,
        'MissingTokens',
      );

      // +1 month / 10_000 token
      await addBlockchainTime(monthToMs(1));
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        partnerPool,
        'MissingTokens',
      );
      expect(await partnerPool.getAvailableTokens()).to.equal(0);
      await expect(partnerPool.connect(platform).poolRelease()).not.reverted;
      expect(await partnerPool.getAvailableTokens()).to.equal(10_000);
      await expect(partnerPool.connect(manager).addVesting(otherAccount1.address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        partnerPool,
        'MissingTokens',
      );
      expect(await partnerPool.getAvailableTokens()).to.equal(4_000);

      // +2 month / 20_000 token - 6_000 (reserved)
      await addBlockchainTime(monthToMs(1));
      expect(await partnerPool.getAvailableTokens()).to.equal(4_000);
      await expect(partnerPool.connect(platform).poolRelease()).not.reverted;
      expect(await partnerPool.getAvailableTokens()).to.equal(14_000);
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        partnerPool,
        'MissingTokens',
      );
      expect(await partnerPool.getAvailableTokens()).to.equal(2_000);

      // Check release not not change available token
      await expect(partnerPool.connect(platform).releaseAll(0)).not.reverted;
      expect(await partnerPool.getAvailableTokens()).to.equal(2_000);
      expect(await partnerPool.released(otherAccount1.address)).to.equal(1_000);
      expect(await token.balanceOf(otherAccount1.address)).to.equal(1_000);

      // +12 month / 120_000 - 18_000
      await addBlockchainTime(monthToMs(10));
      await expect(partnerPool.connect(platform).poolRelease()).not.reverted;
      expect(await partnerPool.getAvailableTokens()).to.equal(102_000);
      await expect(
        partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 103_000, monthToMs(6), 0),
      ).revertedWithCustomError(partnerPool, 'MissingTokens');
      await expect(partnerPool.connect(manager).addVesting(Wallet.createRandom().address, 102_000, monthToMs(6), 0)).not.reverted;
      expect(await partnerPool.getAvailableTokens()).to.equal(0);
    });
  });
});
