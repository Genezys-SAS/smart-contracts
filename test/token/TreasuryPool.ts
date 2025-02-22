/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, TreasuryPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { Wallet } from 'ethers';
import { addBlockchainTime, getNewTestStartDate, monthToMs, setBlockchainDate } from '../date-utils';

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

type DeployTreasuryPoolReturn = DeployTokenReturn & {
  treasuryPool: TreasuryPool;
};

// Contain the specific tests for TreasuryPool
describe('TreasuryPool', function () {
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

  async function deployTreasuryPool(): Promise<DeployTreasuryPoolReturn> {
    const deployTokenResult = await deployToken();

    const treasuryPoolFactory = await ethers.getContractFactory('TreasuryPool');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const treasuryPool = (await upgrades.deployProxy(
      treasuryPoolFactory,
      [await deployTokenResult.token.getAddress(), startDate.getTime(), monthToMs(12)],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as TreasuryPool;
    await treasuryPool.grantRole(await treasuryPool.POOL_MANAGER_ROLE(), deployTokenResult.owner);
    await treasuryPool.grantRole(await treasuryPool.POOL_PLATFORM_ROLE(), deployTokenResult.owner);

    await deployTokenResult.token.registerPool(await treasuryPool.getAddress(), 120_000); // 10_000 by mount

    await setBlockchainDate(startDate);
    return { ...deployTokenResult, treasuryPool };
  }

  describe('poolRelease and transfer', function () {
    it('should only add in versting unlocked token', async () => {
      const { treasuryPool, token, otherAccount1 } = await loadFixture(deployTreasuryPool);

      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).revertedWithCustomError(treasuryPool, 'MissingTokens');

      // +1 month / 10_000 token
      await addBlockchainTime(monthToMs(1));
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).revertedWithCustomError(treasuryPool, 'MissingTokens');
      expect(await treasuryPool.getAvailableTokens()).to.equal(0);
      await expect(treasuryPool.poolRelease()).not.reverted;
      expect(await treasuryPool.getAvailableTokens()).to.equal(10_000);
      await expect(treasuryPool.transfer(otherAccount1.address, 6_000)).not.reverted;
      expect(await token.balanceOf(otherAccount1.address)).to.equal(6_000);
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).revertedWithCustomError(treasuryPool, 'MissingTokens');
      expect(await treasuryPool.getAvailableTokens()).to.equal(4_000);

      // +2 month / 20_000 token - 6_000 (reserved)
      await addBlockchainTime(monthToMs(1));
      expect(await treasuryPool.getAvailableTokens()).to.equal(4_000);
      await expect(treasuryPool.poolRelease()).not.reverted;
      expect(await treasuryPool.getAvailableTokens()).to.equal(14_000);
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).not.reverted;
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).not.reverted;
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 6_000)).revertedWithCustomError(treasuryPool, 'MissingTokens');
      expect(await treasuryPool.getAvailableTokens()).to.equal(2_000);

      // +12 month / 120_000 - 18_000
      await addBlockchainTime(monthToMs(10));
      await expect(treasuryPool.poolRelease()).not.reverted;
      expect(await treasuryPool.getAvailableTokens()).to.equal(102_000);
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 103_000)).revertedWithCustomError(treasuryPool, 'MissingTokens');
      await expect(treasuryPool.transfer(Wallet.createRandom().address, 102_000)).not.reverted;
      expect(await treasuryPool.getAvailableTokens()).to.equal(0);
    });
  });
});
