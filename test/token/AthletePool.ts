/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, AthletePool } from '../../typechain-types';
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

type DeployAthletePoolReturn = DeployTokenReturn & {
  athletePool: AthletePool;
};

// Contain the specific test of AthletePool and Monthly release functionality
describe('AthletePool', function () {
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

  async function deployAthletePool(): Promise<DeployAthletePoolReturn> {
    const deployTokenResult = await deployToken();

    const athletePoolFactory = await ethers.getContractFactory('AthletePool');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const athletePool = (await upgrades.deployProxy(
      athletePoolFactory,
      [await deployTokenResult.token.getAddress(), startDate.getTime(), monthToMs(12)],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as AthletePool;
    await athletePool.grantRole(await athletePool.POOL_MANAGER_ROLE(), deployTokenResult.owner);
    await athletePool.grantRole(await athletePool.POOL_PLATFORM_ROLE(), deployTokenResult.owner);

    await deployTokenResult.token.registerPool(await athletePool.getAddress(), 120_000); // 10_000 by mount

    await setBlockchainDate(startDate);
    return { ...deployTokenResult, athletePool };
  }

  describe('poolRelease and addVesting', function () {
    it('should only add in versting unlocked token', async () => {
      const { athletePool, token, otherAccount1 } = await loadFixture(deployAthletePool);

      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        athletePool,
        'MissingTokens',
      );

      // +1 month / 10_000 token
      await addBlockchainTime(monthToMs(1));
      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        athletePool,
        'MissingTokens',
      );
      expect(await athletePool.getAvailableTokens()).to.equal(0);
      await expect(athletePool.poolRelease()).not.reverted;
      expect(await athletePool.getAvailableTokens()).to.equal(10_000);
      await expect(athletePool.addVesting(otherAccount1.address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        athletePool,
        'MissingTokens',
      );
      expect(await athletePool.getAvailableTokens()).to.equal(4_000);

      // +2 month / 20_000 token - 6_000 (reserved)
      await addBlockchainTime(monthToMs(1));
      expect(await athletePool.getAvailableTokens()).to.equal(4_000);
      await expect(athletePool.poolRelease()).not.reverted;
      expect(await athletePool.getAvailableTokens()).to.equal(14_000);
      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).not.reverted;
      await expect(athletePool.addVesting(Wallet.createRandom().address, 6_000, monthToMs(6), 0)).revertedWithCustomError(
        athletePool,
        'MissingTokens',
      );
      expect(await athletePool.getAvailableTokens()).to.equal(2_000);

      // Check release not not change available token
      await expect(athletePool.releaseAll(0)).not.reverted;
      expect(await athletePool.getAvailableTokens()).to.equal(2_000);
      expect(await athletePool.released(otherAccount1.address)).to.equal(1_000);
      expect(await token.balanceOf(otherAccount1.address)).to.equal(1_000);

      // +12 month / 120_000 - 18_000
      await addBlockchainTime(monthToMs(10));
      await expect(athletePool.poolRelease()).not.reverted;
      expect(await athletePool.getAvailableTokens()).to.equal(102_000);
      await expect(athletePool.addVesting(Wallet.createRandom().address, 103_000, monthToMs(6), 0)).revertedWithCustomError(
        athletePool,
        'MissingTokens',
      );
      await expect(athletePool.addVesting(Wallet.createRandom().address, 102_000, monthToMs(6), 0)).not.reverted;
      expect(await athletePool.getAvailableTokens()).to.equal(0);
    });
  });
});
