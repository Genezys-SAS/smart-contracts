/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { CommunityPool, Forwarder, GNZToken } from '../../typechain-types';
import { addBlockchainTime, getNewTestStartDate, isEqualsDateIgnoreMs, monthToMs, setBlockchainDate } from '../date-utils';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { Wallet } from 'ethers';

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
};

type DeployCommunityPoolReturn = DeployTokenReturn & {
  communityPool: CommunityPool;
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

// Contain the specific tests for communityPool
describe('CommunityPool', function () {
  const startDate = getNewTestStartDate();
  const RESERVED_TOKEN = 1_000_000_000;
  const BASE_TOTAL = 100_000;
  const DECIMALS = 6;
  const MULTIPLICATER = 10 ** DECIMALS;

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

  async function deployCommunityPool(): Promise<DeployCommunityPoolReturn> {
    const deployTokenResult = await deployToken();

    const communityPoolFactory = await ethers.getContractFactory('CommunityPool');

    const [deployer, admin, manager, platform, otherAccount1, otherAccount2] = await ethers.getSigners();

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const communityPool = (await upgrades.deployProxy(
      communityPoolFactory,
      [
        await deployTokenResult.token.getAddress(),
        await admin.getAddress(),
        await manager.getAddress(),
        await platform.getAddress(),
        BASE_TOTAL,
      ],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as CommunityPool;

    await deployTokenResult.token.registerPool(await communityPool.getAddress(), RESERVED_TOKEN);

    await setBlockchainDate(startDate);
    return { ...deployTokenResult, communityPool, deployer, admin, manager, platform, otherAccount1, otherAccount2 };
  }

  function calulateTotal(fancardRatio: number, userActivityRatio: number, pointsRatio: number, priceRatio: number): number {
    return Math.round(fancardRatio * userActivityRatio * pointsRatio * priceRatio * BASE_TOTAL);
  }

  describe('baseTotal', function () {
    it('should set baseTotal', async () => {
      const { communityPool, admin, platform } = await loadFixture(deployCommunityPool);

      expect(await communityPool.baseTotal()).to.equal(BASE_TOTAL);
      await expect(communityPool.connect(admin).setBaseTotal(200_000)).not.reverted;
      expect(await communityPool.baseTotal()).to.equal(200_000);
      const release = communityPool
        .connect(platform)
        .poolRelease(1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER);
      await expect(release)
        .emit(communityPool, 'PoolReleaseEvent')
        .withArgs(200_000, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime()));
      await expect(release).not.reverted;
    });

    it('Sould set baseTotal as admin', async () => {
      const { communityPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployCommunityPool);

      for (const account of [manager, platform, otherAccount1, deployer]) {
        await expect(communityPool.connect(account).setBaseTotal(300_000)).revertedWithCustomError(
          communityPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(communityPool.connect(admin).setBaseTotal(300_000)).not.reverted;
    });
  });

  describe('poolRelease', function () {
    it('should poolRelease correclty', async () => {
      const { token, communityPool, platform } = await loadFixture(deployCommunityPool);

      await addBlockchainTime(monthToMs(1));
      let fancardRatio = 1;
      let userActivityRatio = 1;
      let pointsRatio = 1;
      let priceRatio = 1;
      const total1 = calulateTotal(fancardRatio, userActivityRatio, pointsRatio, priceRatio);
      let release = communityPool
        .connect(platform)
        .poolRelease(
          fancardRatio * MULTIPLICATER,
          userActivityRatio * MULTIPLICATER,
          pointsRatio * MULTIPLICATER,
          priceRatio * MULTIPLICATER,
        );
      await expect(release)
        .emit(communityPool, 'PoolReleaseEvent')
        .withArgs(total1, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(1)));
      await expect(release).not.reverted;
      expect(await communityPool.connect(platform).poolReleased()).to.equals(total1);
      expect(await communityPool.getAvailableTokens()).to.equals(total1);
      expect(await token.balanceOf(communityPool.getAddress())).to.equal(0);

      await addBlockchainTime(monthToMs(1));
      fancardRatio = 1.8733;
      userActivityRatio = 1.4356;
      pointsRatio = 1.546;
      priceRatio = 0.459;
      const total2 = calulateTotal(fancardRatio, userActivityRatio, pointsRatio, priceRatio);
      release = communityPool
        .connect(platform)
        .poolRelease(
          fancardRatio * MULTIPLICATER,
          userActivityRatio * MULTIPLICATER,
          pointsRatio * MULTIPLICATER,
          priceRatio * MULTIPLICATER,
        );
      await expect(release)
        .emit(communityPool, 'PoolReleaseEvent')
        .withArgs(total2, (val: number) => isEqualsDateIgnoreMs(val, startDate.getTime() + monthToMs(2)));
      await expect(release).not.reverted;
      expect(await communityPool.connect(platform).poolReleased()).to.equals(total1 + total2);
      expect(await communityPool.getAvailableTokens()).to.equals(total1 + total2);
      expect(await token.balanceOf(communityPool.getAddress())).to.equal(0);
    });

    it('should not poolRelease when is not manager', async () => {
      const { communityPool, token, platform, otherAccount1 } = await loadFixture(deployCommunityPool);

      await expect(communityPool.connect(otherAccount1).poolRelease(1, 1, 1, 1)).be.revertedWithCustomError(
        communityPool,
        'AccessControlUnauthorizedAccount',
      );
      expect(await communityPool.connect(platform).poolReleased()).to.equals(0);
      expect(await communityPool.getAvailableTokens()).to.equals(0);
      expect(await token.balanceOf(communityPool.getAddress())).to.equal(0);
    });

    it('Sould poolRelease as platform', async () => {
      const { communityPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployCommunityPool);

      for (const account of [manager, admin, otherAccount1, deployer]) {
        await expect(communityPool.connect(account).poolRelease(1, 1, 1, 1)).revertedWithCustomError(
          communityPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(communityPool.connect(platform).poolRelease(1, 1, 1, 1)).not.reverted;
    });
  });

  describe('batchTransfer', function () {
    it('Should successfully batch transfer token', async function () {
      const { token, communityPool, platform, otherAccount1, otherAccount2 } = await loadFixture(deployCommunityPool);
      await expect(communityPool.connect(platform).poolRelease(1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER))
        .not.reverted;

      await expect(
        communityPool.connect(platform).batchTransfer([
          { to: otherAccount1.getAddress(), amount: 10_000 },
          { to: otherAccount2.getAddress(), amount: 90_000 },
        ]),
      ).not.be.reverted;

      expect(await communityPool.getReservedTokens()).to.equal(RESERVED_TOKEN - 100_000);
      expect(await communityPool.getDistributedTokens()).to.equal(100_000);

      // Check state
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(10_000);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(90_000);
      const pool = await token.getPool(communityPool.getAddress());
      expect(pool[0]).to.equal(await communityPool.getAddress());
      expect(pool[1]).to.equal(RESERVED_TOKEN - 100_000);
      expect(pool[2]).to.equal(100_000);
    });

    it('Should not batch transfer token when too many token', async function () {
      const { token, communityPool, platform, otherAccount1, otherAccount2 } = await loadFixture(deployCommunityPool);
      await expect(communityPool.connect(platform).poolRelease(1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER))
        .not.reverted;

      await expect(
        communityPool.connect(platform).batchTransfer([
          { to: otherAccount1.getAddress(), amount: 70_000 },
          { to: otherAccount2.getAddress(), amount: 90_000 },
        ]),
      ).to.be.revertedWithCustomError(communityPool, 'MissingTokens');
      expect(await communityPool.getReservedTokens()).to.equal(RESERVED_TOKEN);
      expect(await communityPool.getDistributedTokens()).to.equal(0);

      // Check state
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(0);
      const pool = await token.getPool(communityPool.getAddress());
      expect(pool[0]).to.equal(await communityPool.getAddress());
      expect(pool[1]).to.equal(RESERVED_TOKEN);
      expect(pool[2]).to.equal(0);
    });

    it('Should not batch transfer token if not manager', async function () {
      const { token, communityPool, platform, otherAccount1, otherAccount2 } = await loadFixture(deployCommunityPool);
      await expect(communityPool.connect(platform).poolRelease(1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER))
        .not.reverted;

      await expect(
        communityPool.connect(otherAccount1).batchTransfer([
          { to: otherAccount1.getAddress(), amount: 10_000 },
          { to: otherAccount2.getAddress(), amount: 90_000 },
        ]),
      ).to.be.revertedWithCustomError(communityPool, 'AccessControlUnauthorizedAccount');
      expect(await communityPool.getReservedTokens()).to.equal(RESERVED_TOKEN);
      expect(await communityPool.getDistributedTokens()).to.equal(0);

      // Check state
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(0);
      const pool = await token.getPool(communityPool.getAddress());
      expect(pool[0]).to.equal(await communityPool.getAddress());
      expect(pool[1]).to.equal(RESERVED_TOKEN);
      expect(pool[2]).to.equal(0);
    });

    it('Sould batchTransfer as platform', async () => {
      const { communityPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployCommunityPool);

      for (const account of [manager, admin, otherAccount1, deployer]) {
        await expect(
          communityPool.connect(account).batchTransfer([{ to: otherAccount1.getAddress(), amount: 70_000 }]),
        ).revertedWithCustomError(communityPool, 'AccessControlUnauthorizedAccount');
      }
      await expect(communityPool.connect(platform).poolRelease(1, 1, 1, 1)).not.reverted;
    });
  });

  describe('poolRelease and batchTransfert', function () {
    it('should poolRealase and batchTransfert', async () => {
      const { communityPool, platform } = await loadFixture(deployCommunityPool);

      // 1st release
      await expect(communityPool.connect(platform).poolRelease(1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER, 1 * MULTIPLICATER))
        .not.reverted;
      expect(await communityPool.getAvailableTokens()).equals(100_000);

      await expect(
        communityPool.connect(platform).batchTransfer([
          { to: Wallet.createRandom().address, amount: 25_000 },
          { to: Wallet.createRandom().address, amount: 70_000 },
        ]),
      ).not.be.reverted;
      expect(await communityPool.getAvailableTokens()).equals(5_000);

      await expect(
        communityPool.connect(platform).batchTransfer([{ to: Wallet.createRandom().address, amount: 10_000 }]),
      ).to.be.revertedWithCustomError(communityPool, 'MissingTokens');
      expect(await communityPool.getAvailableTokens()).equals(5_000);

      await expect(communityPool.connect(platform).batchTransfer([{ to: Wallet.createRandom().address, amount: 5_000 }])).not.be.reverted;
      expect(await communityPool.getAvailableTokens()).equals(0);

      // 2st release
      await expect(
        communityPool.connect(platform).poolRelease(2 * MULTIPLICATER, 0.5 * MULTIPLICATER, 0.5 * MULTIPLICATER, 2 * MULTIPLICATER),
      ).not.reverted;
      expect(await communityPool.getAvailableTokens()).equals(100_000);
      await expect(
        communityPool.connect(platform).batchTransfer([
          { to: Wallet.createRandom().address, amount: 50_000 },
          { to: Wallet.createRandom().address, amount: 50_000 },
        ]),
      ).not.be.reverted;
      expect(await communityPool.getAvailableTokens()).equals(0);
    });
  });
});
