/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, TeamPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { addBlockchainTime, getNewTestStartDate, monthToMs, setBlockchainDate } from '../date-utils';
import { Wallet } from 'ethers';

/*
 * WARNING, this test test private sales pool AND vesting pool
 * In case of delete private sales pool, don't remove tests, move in other testsuite
 */

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
};

type DeployTeamPoolReturn = DeployTokenReturn & {
  teamPool: TeamPool;
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

// Contain the specific test of PrivateSalesPool and Vesting functionality
describe('TeamPool', function () {
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

  async function deployTeamPool(): Promise<DeployTeamPoolReturn> {
    const deployTokenResult = await deployToken();

    const teamPoolFactory = await ethers.getContractFactory('TeamPool');

    const [deployer, admin, manager, platform, otherAccount1, otherAccount2] = await ethers.getSigners();

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const teamPool = (await upgrades.deployProxy(
      teamPoolFactory,
      [
        await deployTokenResult.token.getAddress(),
        await admin.getAddress(),
        await manager.getAddress(),
        await platform.getAddress(),
        monthToMs(12),
        monthToMs(3),
      ],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as TeamPool;

    await deployTokenResult.token.registerPool(await teamPool.getAddress(), 100_000);

    return { ...deployTokenResult, teamPool, deployer, admin, manager, platform, otherAccount1, otherAccount2 };
  }

  describe('addVesting', function () {
    it('should add vestings and release token', async () => {
      const { teamPool, token, manager, platform, otherAccount1, otherAccount2 } = await loadFixture(deployTeamPool);
      const otherAccount3 = Wallet.createRandom();

      await setBlockchainDate(startDate);
      await expect(teamPool.connect(manager).addVesting(otherAccount1, 120)).not.be.reverted;

      // + 1 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(120);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      // + 12 mount
      await addBlockchainTime(monthToMs(11));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(120);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      // + 13 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(40);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(40);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(80);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      await expect(teamPool.connect(manager).addVesting(otherAccount3, 300)).not.be.reverted;
      await expect(teamPool.connect(manager).addVesting(otherAccount2, 300)).not.be.reverted;

      // + 14 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(80);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(80);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount3.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount3.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(640);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);

      // + 15 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount3.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount3.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(600);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);

      // + 28 mount
      await addBlockchainTime(monthToMs(13));
      await expect(teamPool.connect(platform).releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(300);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(300);
      expect(await teamPool.released(await otherAccount3.getAddress())).to.equal(300);
      expect(await token.balanceOf(await otherAccount3.getAddress())).to.equal(300);
      expect(await teamPool.getTotalUnreleased()).to.equal(0);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);
    });

    it('Sould addVesting as manager', async () => {
      const { teamPool, deployer, manager, admin, platform, otherAccount1, otherAccount2 } = await loadFixture(deployTeamPool);

      for (const account of [admin, platform, otherAccount1, deployer]) {
        await expect(teamPool.connect(account).addVesting(otherAccount2, 300)).revertedWithCustomError(
          teamPool,
          'AccessControlUnauthorizedAccount',
        );
      }
      await expect(teamPool.connect(manager).addVesting(otherAccount2, 300)).not.reverted;
    });
  });
});
