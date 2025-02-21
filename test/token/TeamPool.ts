/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, TeamPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { addBlockchainTime, getNewTestStartDate, monthToMs, setBlockchainDate } from '../date-utils';

/*
 * WARNING, this test test private sales pool AND vesting pool
 * In case of delete private sales pool, don't remove tests, move in other testsuite
 */

type DeployTokenReturn = {
  token: GNZToken;
  forwarder: Forwarder;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

type DeployTeamPoolReturn = DeployTokenReturn & {
  teamPool: TeamPool;
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

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { token, forwarder, owner, otherAccount1, otherAccount2 };
  }

  async function deployTeamPool(): Promise<DeployTeamPoolReturn> {
    const deployTokenResult = await deployToken();

    const teamPoolFactory = await ethers.getContractFactory('TeamPool');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const teamPool = (await upgrades.deployProxy(
      teamPoolFactory,
      [await deployTokenResult.token.getAddress(), monthToMs(12), monthToMs(3)],
      {
        constructorArgs: [await deployTokenResult.forwarder.getAddress()],
      },
    )) as unknown as TeamPool;
    await teamPool.grantRole(await teamPool.POOL_MANAGER_ROLE(), deployTokenResult.owner);
    await teamPool.grantRole(await teamPool.POOL_PLATFORM_ROLE(), deployTokenResult.owner);

    await deployTokenResult.token.registerPool(await teamPool.getAddress(), 100_000);

    return { ...deployTokenResult, teamPool };
  }

  describe('addVesting', function () {
    it('should add vestings and release token', async () => {
      const { teamPool, token, owner, otherAccount1, otherAccount2 } = await loadFixture(deployTeamPool);

      await setBlockchainDate(startDate);
      await expect(teamPool.addVesting(otherAccount1, 120)).not.be.reverted;

      // + 1 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(120);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      // + 12 mount
      await addBlockchainTime(monthToMs(11));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(0);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(120);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      // + 13 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(40);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(40);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(80);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120);

      await expect(teamPool.addVesting(owner, 300)).not.be.reverted;
      await expect(teamPool.addVesting(otherAccount2, 300)).not.be.reverted;

      // + 14 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(80);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(80);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.released(await owner.getAddress())).to.equal(0);
      expect(await token.balanceOf(await owner.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(640);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);

      // + 15 mount
      await addBlockchainTime(monthToMs(1));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(0);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(0);
      expect(await teamPool.released(await owner.getAddress())).to.equal(0);
      expect(await token.balanceOf(await owner.getAddress())).to.equal(0);
      expect(await teamPool.getTotalUnreleased()).to.equal(600);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);

      // + 28 mount
      await addBlockchainTime(monthToMs(13));
      await expect(teamPool.releaseAll(0)).not.be.reverted;
      expect(await teamPool.released(await otherAccount1.getAddress())).to.equal(120);
      expect(await token.balanceOf(await otherAccount1.getAddress())).to.equal(120);
      expect(await teamPool.released(await otherAccount2.getAddress())).to.equal(300);
      expect(await token.balanceOf(await otherAccount2.getAddress())).to.equal(300);
      expect(await teamPool.released(await owner.getAddress())).to.equal(300);
      expect(await token.balanceOf(await owner.getAddress())).to.equal(300);
      expect(await teamPool.getTotalUnreleased()).to.equal(0);
      expect(await teamPool.getAvailableTokens()).to.equal(100_000 - 120 - 300 - 300);
    });
  });
});
