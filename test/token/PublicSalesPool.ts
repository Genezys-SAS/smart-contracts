/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ExchangeReservePool, Forwarder, GNZToken, PublicSalesPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { addBlockchainTime, getNewTestStartDate, monthToMs, setBlockchainDate } from '../date-utils';
import { Wallet } from 'ethers';

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
};

type DeployPublicSalesPoolReturn = DeployTokenReturn & {
  publicSalesPool: PublicSalesPool;
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

type DeployTokenPublicSalesAndReservePoolReturn = DeployPublicSalesPoolReturn & {
  exchangeReservePool: ExchangeReservePool;
};

// Contain the specific test of PublicSalesPool
describe('PublicSalesPool', function () {
  const blockchainDate = getNewTestStartDate();

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

  async function deployPublicSalesPool(): Promise<DeployPublicSalesPoolReturn> {
    const deployTokenResult = await deployToken();

    const publicSalesPoolFactory = await ethers.getContractFactory('PublicSalesPool');

    const [deployer, admin, manager, platform, otherAccount1, otherAccount2] = await ethers.getSigners();

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const publicSalesPool = (await upgrades.deployProxy(
      publicSalesPoolFactory,
      [await deployTokenResult.token.getAddress(), await admin.getAddress(), await manager.getAddress(), await platform.getAddress()],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as PublicSalesPool;

    await deployTokenResult.token.registerPool(await publicSalesPool.getAddress(), 100_000);

    return { ...deployTokenResult, publicSalesPool, deployer, admin, manager, platform, otherAccount1, otherAccount2 };
  }

  async function deployTokenPublicSalesAndReservePool(): Promise<DeployTokenPublicSalesAndReservePoolReturn> {
    const deployTokenAndPublicSalesPoolResult = await deployPublicSalesPool();

    // Deploy transferPool
    const transferPoolFactory = await ethers.getContractFactory('ExchangeReservePool');

    const [admin, manager, platform] = await ethers.getSigners();

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const exchangeReservePool = (await upgrades.deployProxy(
      transferPoolFactory,
      [
        await deployTokenAndPublicSalesPoolResult.token.getAddress(),
        await admin.getAddress(),
        await manager.getAddress(),
        await platform.getAddress(),
      ],
      {
        constructorArgs: [await deployTokenAndPublicSalesPoolResult.forwarder.getAddress()],
      },
    )) as unknown as ExchangeReservePool;

    await deployTokenAndPublicSalesPoolResult.token.registerPool(await exchangeReservePool.getAddress(), 100_000);

    return { ...deployTokenAndPublicSalesPoolResult, exchangeReservePool };
  }

  describe('addVesting', function () {
    it('should fail to add a vesting if there is not enough available token', async () => {
      const { publicSalesPool, manager, otherAccount1, otherAccount2 } = await loadFixture(deployPublicSalesPool);

      await expect(publicSalesPool.connect(manager).transfer(otherAccount1.getAddress(), 50_000)).not.be.reverted;
      await expect(publicSalesPool.connect(manager).transfer(otherAccount2.getAddress(), 49_999)).not.be.reverted;

      expect(await publicSalesPool.getAvailableTokens()).to.equal(1);
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 2, blockchainDate.getTime() + monthToMs(1))).to.be.reverted;
      expect(await publicSalesPool.vestedAmount(otherAccount1, blockchainDate.getTime())).to.equal(0);
    });

    it('should add a vesting', async () => {
      const { publicSalesPool, manager, otherAccount1, otherAccount2 } = await loadFixture(deployPublicSalesPool);

      const startDate1Month = blockchainDate.getTime() + monthToMs(1);
      const startDate2Months = blockchainDate.getTime() + monthToMs(2);
      await setBlockchainDate(blockchainDate);
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 100, startDate1Month)).not.be.reverted;
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount2, 150, startDate2Months)).not.be.reverted;

      // At start date, no vested amount
      expect(await publicSalesPool.vestedAmount(otherAccount1, blockchainDate.getTime())).to.equal(0);
      expect(await publicSalesPool.vestedAmount(otherAccount2, blockchainDate.getTime())).to.equal(0);

      // After 1 month, vested amount is 100 for account 1 and 0 for account 2
      expect(await publicSalesPool.vestedAmount(otherAccount1, startDate1Month)).to.equal(100);
      expect(await publicSalesPool.vestedAmount(otherAccount2, startDate1Month)).to.equal(0);

      // After 2 months, vested amount is 100 for account 1 and 150 for account 2
      expect(await publicSalesPool.vestedAmount(otherAccount1, startDate2Months)).to.equal(100);
      expect(await publicSalesPool.vestedAmount(otherAccount2, startDate2Months)).to.equal(150);
    });

    it('Sould addVesting as manager', async () => {
      const { publicSalesPool, deployer, manager, admin, platform, otherAccount1, otherAccount2 } =
        await loadFixture(deployPublicSalesPool);

      const startDate1Month = blockchainDate.getTime() + monthToMs(1);
      for (const account of [admin, platform, otherAccount1, deployer]) {
        await expect(publicSalesPool.connect(account).addVesting(otherAccount2, 100, startDate1Month)).revertedWithCustomError(
          publicSalesPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount2, 100, startDate1Month)).not.reverted;
    });
  });

  describe('releaseAll', function () {
    it('should release all vestings', async () => {
      const { publicSalesPool, manager, platform, otherAccount1, otherAccount2, token } = await loadFixture(deployPublicSalesPool);
      const otherAccount3 = Wallet.createRandom();

      const startDate1Month = blockchainDate.getTime() + monthToMs(1);
      const startDate2Months = blockchainDate.getTime() + monthToMs(2);
      await setBlockchainDate(blockchainDate);
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount3.address, 1_000, startDate1Month)).not.be.reverted;
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 120, startDate1Month)).not.be.reverted;
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount2, 1_200, startDate2Months)).not.be.reverted;
      expect(await publicSalesPool.getTotalUnreleased()).to.equal(1_200 + 1_000 + 120);

      await addBlockchainTime(monthToMs(1));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.released(await otherAccount3.getAddress())).to.equal(1_000);
      expect(await publicSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await publicSalesPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await publicSalesPool.getTotalUnreleased()).to.equal(1_200);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 1_200 - 120 - 1_000);

      await addBlockchainTime(monthToMs(2));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.released(await otherAccount3.getAddress())).to.equal(1_000);
      expect(await publicSalesPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await publicSalesPool.released(await otherAccount2.getAddress())).to.equal(1_200);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(1_200);
      expect(await publicSalesPool.getTotalUnreleased()).to.equal(0);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 120 - 1_000 - 1_200);
    });

    it('Sould releaseAll as platform', async () => {
      const { publicSalesPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployPublicSalesPool);

      const startDate1Month = blockchainDate.getTime() + monthToMs(1);
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 120, startDate1Month)).not.be.reverted;

      for (const account of [admin, manager, otherAccount1, deployer]) {
        await expect(publicSalesPool.connect(account).releaseAll(0)).revertedWithCustomError(
          publicSalesPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.reverted;
    });
  });

  describe('availableToken', function () {
    it('Should return the correct number of available token', async () => {
      const { publicSalesPool, manager, platform, otherAccount1, otherAccount2 } = await loadFixture(deployPublicSalesPool);
      const otherAccount3 = Wallet.createRandom();

      const startDate1Month = blockchainDate.getTime() + monthToMs(1);
      const startDate2Months = blockchainDate.getTime() + monthToMs(2);
      await setBlockchainDate(blockchainDate);

      // Transfer
      await publicSalesPool.connect(manager).transfer(otherAccount1.getAddress(), 100);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100);

      // Add vestings
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 1_000, startDate1Month)).not.be.reverted;
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount2, 120, startDate2Months)).not.be.reverted;
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120);

      // Release month 1
      await addBlockchainTime(monthToMs(1));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.released(await otherAccount1.getAddress())).to.equal(1_000);
      expect(await publicSalesPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120);

      // Add vesting
      await expect(publicSalesPool.connect(manager).addVesting(otherAccount3.address, 2_000, blockchainDate.getTime() + monthToMs(3))).not
        .be.reverted;
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120 - 2_000);

      // Transfer
      await publicSalesPool.connect(manager).transfer(otherAccount2.getAddress(), 10_000);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120 - 2_000 - 10_000);

      // Release month 2
      await addBlockchainTime(monthToMs(1));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.released(await otherAccount1.getAddress())).to.equal(1_000);
      expect(await publicSalesPool.released(await otherAccount2.getAddress())).to.equal(120);
      expect(await publicSalesPool.released(await otherAccount3.getAddress())).to.equal(0);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120 - 2_000 - 10_000);

      // Release month 3
      await addBlockchainTime(monthToMs(1));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.released(await otherAccount1.getAddress())).to.equal(1_000);
      expect(await publicSalesPool.released(await otherAccount2.getAddress())).to.equal(120);
      expect(await publicSalesPool.released(await otherAccount3.getAddress())).to.equal(2_000);
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120 - 2_000 - 10_000);

      // Release month 4
      await addBlockchainTime(monthToMs(1));
      await expect(publicSalesPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await publicSalesPool.getAvailableTokens()).to.equal(100_000 - 100 - 1_000 - 120 - 2_000 - 10_000);
    });
  });

  describe('transfer', function () {
    it('should fail to transfer if there is not enough available token', async () => {
      const { token, publicSalesPool, manager, otherAccount1, otherAccount2 } = await loadFixture(deployPublicSalesPool);

      await expect(publicSalesPool.connect(manager).addVesting(otherAccount1, 45_000, blockchainDate.getTime() + monthToMs(1))).not.be
        .reverted;
      await expect(publicSalesPool.connect(manager).transfer(otherAccount2.getAddress(), 5000)).not.be.reverted;

      await expect(publicSalesPool.connect(manager).addVesting(otherAccount2, 49_999, blockchainDate.getTime() + monthToMs(1))).not.be
        .reverted;

      expect(await publicSalesPool.getAvailableTokens()).to.equal(1);
      await expect(publicSalesPool.connect(manager).transfer(otherAccount1.getAddress(), 2)).to.be.reverted;
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
    });

    it('Should successfully transfer token', async function () {
      const { token, publicSalesPool, manager, otherAccount1 } = await loadFixture(deployPublicSalesPool);

      await expect(publicSalesPool.connect(manager).transfer(otherAccount1.getAddress(), 100)).not.be.reverted;
      expect(await publicSalesPool.getReservedTokens()).to.equal(100_000 - 100);
      expect(await publicSalesPool.getDistributedTokens()).to.equal(100);

      // Check state
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(100);
      const pool = await token.getPool(publicSalesPool.getAddress());
      expect(pool[0]).to.equal(await publicSalesPool.getAddress());
      expect(pool[1]).to.equal(100_000 - 100);
      expect(pool[2]).to.equal(100);
    });

    it('Sould transfer as manager', async () => {
      const { publicSalesPool, deployer, manager, admin, platform, otherAccount1, otherAccount2 } =
        await loadFixture(deployPublicSalesPool);

      for (const account of [admin, platform, otherAccount1, deployer]) {
        await expect(publicSalesPool.connect(account).transfer(otherAccount2.address, 10_000)).revertedWithCustomError(
          publicSalesPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(publicSalesPool.connect(manager).transfer(otherAccount2.address, 10_000)).not.reverted;
    });
  });

  describe('close', function () {
    it('should transfer the remaining token allocation to another pool', async () => {
      const { publicSalesPool, exchangeReservePool, token, admin } = await loadFixture(deployTokenPublicSalesAndReservePool);

      await expect(publicSalesPool.connect(admin).close(await exchangeReservePool.getAddress())).not.be.reverted;
      expect(await publicSalesPool.getReservedTokens()).to.equal(0);
      expect(await exchangeReservePool.getReservedTokens()).to.equal(200_000);

      const tokenPublicSalesPool = await token.getPool(await publicSalesPool.getAddress());
      expect(tokenPublicSalesPool[0]).to.equal(await publicSalesPool.getAddress());
      expect(tokenPublicSalesPool[1]).to.equal(0);
      expect(tokenPublicSalesPool[2]).to.equal(0);

      const tokenExchangeReservePool = await token.getPool(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[0]).to.equal(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[1]).to.equal(200_000);
      expect(tokenExchangeReservePool[2]).to.equal(0);
    });

    it('should transfer the remaining token allocation to another pool but keep vested amount', async () => {
      const { publicSalesPool, exchangeReservePool, token, admin, manager, otherAccount1, otherAccount2 } = await loadFixture(
        deployTokenPublicSalesAndReservePool,
      );

      // Add vesting
      await expect(
        publicSalesPool.connect(manager).addVesting(await otherAccount1.getAddress(), 50_000, blockchainDate.getTime() + monthToMs(1)),
      ).not.be.reverted;
      await expect(
        publicSalesPool.connect(manager).addVesting(await otherAccount2.getAddress(), 15_000, blockchainDate.getTime() + monthToMs(1)),
      ).not.be.reverted;

      // Transfer point
      await expect(publicSalesPool.connect(manager).transfer(otherAccount1.getAddress(), 10_000)).not.be.reverted;

      await expect(publicSalesPool.connect(admin).close(await exchangeReservePool.getAddress())).not.be.reverted;
      expect(await publicSalesPool.getReservedTokens()).to.equal(65_000);
      expect(await exchangeReservePool.getReservedTokens()).to.equal(125_000);

      const tokenPrivateSalesPool = await token.getPool(await publicSalesPool.getAddress());
      expect(tokenPrivateSalesPool[0]).to.equal(await publicSalesPool.getAddress());
      expect(tokenPrivateSalesPool[1]).to.equal(65_000);
      expect(tokenPrivateSalesPool[2]).to.equal(10_000);

      const tokenExchangeReservePool = await token.getPool(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[0]).to.equal(await exchangeReservePool.getAddress());
      expect(tokenExchangeReservePool[1]).to.equal(125_000);
      expect(tokenExchangeReservePool[2]).to.equal(0);
    });

    it('Sould close as admin', async () => {
      const { publicSalesPool, exchangeReservePool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(
        deployTokenPublicSalesAndReservePool,
      );

      for (const account of [manager, platform, otherAccount1, deployer]) {
        await expect(publicSalesPool.connect(account).close(await publicSalesPool.getAddress())).revertedWithCustomError(
          publicSalesPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(publicSalesPool.connect(admin).close(await exchangeReservePool.getAddress())).not.reverted;
    });
  });
});
