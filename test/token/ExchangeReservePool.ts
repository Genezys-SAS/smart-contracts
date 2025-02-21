/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades, network } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, TransferPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

type DeployTokenAndReservePoolReturn = {
  token: GNZToken;
  transferPool: TransferPool;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

// Contain the specific test of ExchangeReservePool and Transfer functionality
describe('ExchangeReservePool', function () {
  async function deployTokenAndReservePool(): Promise<DeployTokenAndReservePoolReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    // Deploy token
    const tokenFactory = await ethers.getContractFactory('GNZToken');
    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const token = (await upgrades.deployProxy(tokenFactory, ['Genezys Token', 'GNZ', BigInt(6_000_000_000) * BigInt(10 ** 18)], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as GNZToken;

    // Deploy transferPool
    const transferPoolFactory = await ethers.getContractFactory('ExchangeReservePool');
    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const transferPool = (await upgrades.deployProxy(transferPoolFactory, [await token.getAddress()], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as TransferPool;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { token, transferPool, owner, otherAccount1, otherAccount2 };
  }

  describe('getTokenContract', function () {
    it('Should return correct contract address', async function () {
      const { transferPool, token } = await loadFixture(deployTokenAndReservePool);
      expect(await transferPool.getTokenContract()).to.equal(await token.getAddress());
    });
  });

  describe('addTokenAllocation', function () {
    it('Should fail to add token allocation if msg.sender is not tokenContract', async function () {
      const { transferPool } = await loadFixture(deployTokenAndReservePool);
      // Try to add allocation directly (not through token contract)
      await expect(transferPool.addTokenAllocation(BigInt(1) * BigInt(10 ** 18))).be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(0);
    });

    it('Should successfully add token allocation ', async function () {
      const { token, transferPool } = await loadFixture(deployTokenAndReservePool);

      // Impersonate the token contract address
      const tokenAddress = await token.getAddress();
      const impersonatedTokenSigner = await ethers.getImpersonatedSigner(tokenAddress);

      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [tokenAddress, '0x1000000000000000000']);

      // Add token allocation
      const poolReservedToken = BigInt(1_000_000_000) * BigInt(10 ** 18);
      await expect(transferPool.connect(impersonatedTokenSigner).addTokenAllocation(poolReservedToken)).not.be.reverted;

      // Verify allocation was set correctly
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await transferPool.getDistributedTokens()).to.equal(0);
    });

    it('Should multiple call successfully update reservedAmount', async function () {
      const { token, transferPool } = await loadFixture(deployTokenAndReservePool);

      // Impersonate the token contract address
      const tokenAddress = await token.getAddress();
      const impersonatedTokenSigner = await ethers.getImpersonatedSigner(tokenAddress);

      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [tokenAddress, '0x1000000000000000000']);

      // Add token allocation
      const poolReservedToken = BigInt(1_000_000_000) * BigInt(10 ** 18);
      await expect(transferPool.connect(impersonatedTokenSigner).addTokenAllocation(poolReservedToken)).not.be.reverted;

      // Verify allocation was set correctly
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await transferPool.getDistributedTokens()).to.equal(0);

      await expect(transferPool.connect(impersonatedTokenSigner).addTokenAllocation(poolReservedToken)).not.be.reverted;
      await expect(transferPool.connect(impersonatedTokenSigner).addTokenAllocation(poolReservedToken)).not.be.reverted;

      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken * BigInt(3));
      expect(await transferPool.getDistributedTokens()).to.equal(0);
    });
  });

  describe('transfer', function () {
    it('Should only allow pool manager to transfer token', async function () {
      const { token, transferPool, otherAccount1, otherAccount2 } = await loadFixture(deployTokenAndReservePool);

      const poolReservedToken = BigInt(100) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);

      // Add pool manager and transfer token to account 2
      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await otherAccount1.getAddress())).not.be.reverted;
      await expect(transferPool.connect(otherAccount1).transfer(otherAccount2.getAddress(), poolReservedToken / BigInt(2))).not.be.reverted;
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(poolReservedToken / BigInt(2));
      expect(await transferPool.getDistributedTokens()).to.equal(poolReservedToken / BigInt(2));

      // Remove pool manager and try to transfer token to account 2 but should fail

      await expect(transferPool.revokeRole(await transferPool.POOL_MANAGER_ROLE(), await otherAccount1.getAddress())).not.be.reverted;
      await expect(transferPool.connect(otherAccount1).transfer(otherAccount2.getAddress(), poolReservedToken / BigInt(2))).to.be.reverted;
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(poolReservedToken / BigInt(2));
      expect(await transferPool.getDistributedTokens()).to.equal(poolReservedToken / BigInt(2));
    });

    it('Should fail to transfer token to address 0', async function () {
      const { token, transferPool, owner } = await loadFixture(deployTokenAndReservePool);

      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);

      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await owner.getAddress())).not.be.reverted;
      await expect(transferPool.transfer(ethers.ZeroAddress, poolReservedToken / BigInt(2))).to.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await transferPool.getDistributedTokens()).to.equal(0);
    });

    it('Should fail to transfer 0 or less token', async function () {
      const { token, transferPool, owner, otherAccount1 } = await loadFixture(deployTokenAndReservePool);

      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);

      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await owner.getAddress())).not.be.reverted;
      await expect(transferPool.transfer(otherAccount1.getAddress(), 0)).to.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await transferPool.getDistributedTokens()).to.equal(0);
    });

    it('Should fail to transfer more than the token allocated', async function () {
      const { token, transferPool, owner, otherAccount1 } = await loadFixture(deployTokenAndReservePool);

      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);

      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await owner.getAddress())).not.be.reverted;
      await expect(transferPool.transfer(otherAccount1.getAddress(), poolReservedToken + BigInt(1))).to.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await transferPool.getDistributedTokens()).to.equal(0);
    });

    it('Should successfully transfer token', async function () {
      const { token, transferPool, owner, otherAccount1 } = await loadFixture(deployTokenAndReservePool);

      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);

      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await owner.getAddress())).not.be.reverted;
      await expect(transferPool.transfer(otherAccount1.getAddress(), poolReservedToken / BigInt(2))).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken / BigInt(2));
      expect(await transferPool.getDistributedTokens()).to.equal(poolReservedToken / BigInt(2));

      // Check state
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(poolReservedToken / BigInt(2));
      const pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken / BigInt(2));
      expect(pool[2]).to.equal(poolReservedToken / BigInt(2));
    });
  });
});
