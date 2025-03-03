import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ExchangeOverflowReservePool, ExchangeReservePool, Forwarder, GNZToken } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

type DeployTestContextReturn = {
  token: GNZToken;
  forwarder: Forwarder;
  overflowPool: ExchangeOverflowReservePool;
  exchangePool: ExchangeReservePool;
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

describe('ExchangeOverflowReservePool', function () {
  async function deployTestContext(): Promise<DeployTestContextReturn> {
    // Deploy forwarder
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    // Deploy token
    const tokenFactory = await ethers.getContractFactory('GNZToken');
    const token = (await upgrades.deployProxy(tokenFactory, ['Genezys Token', 'GNZ', BigInt(6_000_000_000)], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as GNZToken;

    const [deployer, admin, manager, platform, otherAccount1, otherAccount2] = await ethers.getSigners();

    // Deploy exchange pool for testing
    const exchangePoolFactory = await ethers.getContractFactory('ExchangeReservePool');
    const exchangePool = (await upgrades.deployProxy(
      exchangePoolFactory,
      [await token.getAddress(), await admin.getAddress(), await manager.getAddress(), await platform.getAddress()],
      {
        constructorArgs: [await forwarder.getAddress()],
      },
    )) as unknown as ExchangeReservePool;

    // Deploy overflow pool
    const overflowPoolFactory = await ethers.getContractFactory('ExchangeOverflowReservePool');
    const overflowPool = (await upgrades.deployProxy(
      overflowPoolFactory,
      [await token.getAddress(), await admin.getAddress(), await manager.getAddress()],
      {
        constructorArgs: [await forwarder.getAddress()],
      },
    )) as unknown as ExchangeOverflowReservePool;

    // Setup permissions
    await token.registerPool(await exchangePool.getAddress(), 100_000);

    return {
      token,
      forwarder,
      overflowPool,
      exchangePool,
      deployer,
      admin,
      manager,
      platform,
      otherAccount1,
      otherAccount2,
    };
  }

  describe('Deployment & Setup', function () {
    it('Should set the right token contract', async function () {
      const { token, overflowPool } = await loadFixture(deployTestContext);
      expect(await overflowPool.getTokenContract()).to.equal(await token.getAddress());
    });

    it('Should grant manager role to manager', async function () {
      const { overflowPool, manager } = await loadFixture(deployTestContext);
      const managerRole = await overflowPool.POOL_MANAGER_ROLE();
      expect(await overflowPool.hasRole(managerRole, manager.address)).to.be.true;
    });
  });

  describe('getBalance', function () {
    it('Should return correct balance', async function () {
      const { token, exchangePool, manager, overflowPool, otherAccount1 } = await loadFixture(deployTestContext);

      // Initial balance should be 0
      expect(await overflowPool.getBalance()).to.equal(0);

      // Transfer some tokens to overflow pool
      const amount = 1000;
      await exchangePool.connect(manager).transfer(otherAccount1.address, amount);
      await token.connect(otherAccount1).transfer(await overflowPool.getAddress(), amount);

      expect(await overflowPool.getBalance()).to.equal(amount);
    });
  });

  describe('transferToken', function () {
    it('Should fail if sender is not manager', async function () {
      const { token, exchangePool, overflowPool, manager, otherAccount1, otherAccount2 } = await loadFixture(deployTestContext);

      // Setup tokens in pool
      const amount = 1000;
      await exchangePool.connect(manager).transfer(otherAccount1.address, amount);
      await token.connect(otherAccount1).transfer(await overflowPool.getAddress(), amount);

      // Try to transfer without manager role
      await expect(overflowPool.connect(otherAccount2).transferToken(otherAccount2.address, amount)).to.be.revertedWithCustomError(
        overflowPool,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('Should fail if amount is 0', async function () {
      const { manager, overflowPool, otherAccount1 } = await loadFixture(deployTestContext);

      await expect(overflowPool.connect(manager).transferToken(otherAccount1.address, 0)).to.be.revertedWithCustomError(
        overflowPool,
        'InvalidInput',
      );
    });

    it('Should fail if insufficient balance', async function () {
      const { manager, overflowPool, otherAccount1 } = await loadFixture(deployTestContext);

      await expect(overflowPool.connect(manager).transferToken(otherAccount1.address, 1)).to.be.revertedWithCustomError(
        overflowPool,
        'MissingTokens',
      );
    });

    it('Should transfer tokens successfully', async function () {
      const { token, exchangePool, overflowPool, manager, otherAccount1, otherAccount2 } = await loadFixture(deployTestContext);

      // Setup tokens in pool
      const amount = 1000;
      await exchangePool.connect(manager).transfer(otherAccount1.address, amount);
      await token.connect(otherAccount1).transfer(await overflowPool.getAddress(), amount);

      // Transfer tokens from pool
      await expect(overflowPool.connect(manager).transferToken(otherAccount2.address, amount)).to.not.be.reverted;

      expect(await token.balanceOf(otherAccount2.address)).to.equal(amount);
      expect(await overflowPool.getBalance()).to.equal(0);
    });

    it('Sould batchTransfer as platform', async () => {
      const { token, exchangePool, overflowPool, deployer, manager, admin, platform, otherAccount1 } = await loadFixture(deployTestContext);

      // Setup tokens in pool
      const amount = 1000;
      await exchangePool.connect(manager).transfer(otherAccount1.address, amount);
      await token.connect(otherAccount1).transfer(await overflowPool.getAddress(), amount);

      for (const account of [platform, admin, otherAccount1, deployer]) {
        await expect(overflowPool.connect(account).transferToken(otherAccount1.address, amount)).revertedWithCustomError(
          overflowPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(overflowPool.connect(manager).transferToken(otherAccount1.address, amount)).not.reverted;
    });
  });
});
