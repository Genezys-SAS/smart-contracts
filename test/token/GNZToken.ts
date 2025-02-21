/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades, network } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder, GNZToken, TransferPool } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

type DeployTokenReturn = {
  token: GNZToken;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

type DeployTransferPoolReturn = {
  transferPool: TransferPool;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

// Contain the tests for the pool management
// We are not testing the Openzeppelin contract as there are already tested
describe('GNZToken', function () {
  async function deployToken(): Promise<DeployTokenReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const tokenFactory = await ethers.getContractFactory('GNZToken');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const token = (await upgrades.deployProxy(tokenFactory, ['Genezys Token', 'GNZ', BigInt(6_000_000_000) * BigInt(10 ** 18)], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as GNZToken;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { token, owner, otherAccount1, otherAccount2 };
  }

  async function deployExchangeReservePool(token: GNZToken): Promise<DeployTransferPoolReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const transferPoolFactory = await ethers.getContractFactory('ExchangeReservePool');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const transferPool = (await upgrades.deployProxy(transferPoolFactory, [await token.getAddress()], {
      constructorArgs: [await forwarder.getAddress()],
    })) as unknown as TransferPool;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { transferPool, owner, otherAccount1, otherAccount2 };
  }

  describe('Deployment', function () {
    it('Should have good name, symbol and cap', async function () {
      const { token } = await loadFixture(deployToken);
      expect(await token.name()).to.equal('Genezys Token');
      expect(await token.symbol()).to.equal('GNZ');
      const cap = await token.cap();
      expect(cap).to.equal(BigInt(6_000_000_000) * BigInt(10 ** 18));
    });
  });

  describe('Register transfer pool', function () {
    it('Should register transfer pool', async function () {
      const { token } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1_000_000_000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      // Check pool info in GNZToken are reflecting the current state
      const pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);

      expect(await token.getTotalAllocatedTokens()).to.equal(poolReservedToken);
    });

    it('Should fail to register pool if not enough token to allocate', async function () {
      // Deploy token
      const { token } = await loadFixture(deployToken);
      // Deploy first pool and allocate 1_000_000_000 to it
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1_000_000_000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;

      // Deploy second pool and try to allocate 6_000_000_000 to it
      async function deployPoolOfToken2(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool: transferPool2 } = await loadFixture(deployPoolOfToken2);
      const pool2ReservedToken = BigInt(6_000_000_000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool2.getAddress(), pool2ReservedToken)).be.reverted;
    });

    it('Should not register transfer pool if not owner', async function () {
      const { token, otherAccount1 } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      await expect(token.connect(otherAccount1).registerPool(await transferPool.getAddress(), BigInt(1_000_000_000 * 10 ** 18))).be
        .reverted;

      expect(await token.getTotalAllocatedTokens()).to.equal(0);
    });

    it('Should not register transfer pool if already registered', async function () {
      const { token } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1_000_000_000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      expect(await token.getTotalAllocatedTokens()).to.equal(poolReservedToken);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).be.reverted;
      expect(await token.getTotalAllocatedTokens()).to.equal(poolReservedToken);
    });
  });

  describe('mint', function () {
    it('Should fail to mint with owner user', async function () {
      const { token, owner } = await loadFixture(deployToken);

      expect(await token.balanceOf(owner.getAddress())).to.equal(0);

      await expect(token.mint(await owner.getAddress(), BigInt(1) * BigInt(10 ** 18))).be.reverted;

      expect(await token.balanceOf(owner.getAddress())).to.equal(0);
    });

    it('Should successfully mint from transfer pool', async function () {
      const { token } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool, owner, otherAccount1 } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      // Check pool info in GNZToken are reflecting the current state
      let pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);

      // Mint from pool
      await expect(transferPool.grantRole(await transferPool.POOL_MANAGER_ROLE(), await owner.getAddress())).not.be.reverted;
      await expect(transferPool.transfer(await otherAccount1.getAddress(), BigInt(1) * BigInt(10 ** 18))).not.be.reverted;
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(BigInt(1) * BigInt(10 ** 18));
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken - BigInt(10 ** 18));
      // Check pool info updated
      pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken - BigInt(10 ** 18));
      expect(pool[2]).to.equal(BigInt(1) * BigInt(10 ** 18));
    });
  });

  describe('batchMint', function () {
    it('Should fail if called by an address without a pool role', async function () {
      const { token, owner } = await loadFixture(deployToken);

      expect(await token.balanceOf(owner.getAddress())).to.equal(0);

      const mintInstructions = [
        {
          to: await owner.getAddress(),
          amount: BigInt(1) * BigInt(10 ** 18),
        },
      ];

      await expect(token.batchMint(mintInstructions)).be.reverted;

      expect(await token.balanceOf(owner.getAddress())).to.equal(0);
    });

    it('Should fail if one of the address is address(0)', async function () {
      const { token, owner, otherAccount1, otherAccount2 } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      // Check pool info in GNZToken are reflecting the current state
      let pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);

      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      const mintInstructions = [
        {
          to: await owner.getAddress(),
          amount: BigInt(50) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount1.getAddress(),
          amount: BigInt(176) * BigInt(10 ** 18),
        },
        {
          to: ethers.ZeroAddress,
          amount: BigInt(10) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount2.getAddress(),
          amount: BigInt(28) * BigInt(10 ** 18),
        },
      ];

      // Batch mint from pool
      await expect(token.connect(impersonatedTransferPoolSigner).batchMint(mintInstructions)).to.be.reverted;

      // Check balance of each account
      expect(await token.balanceOf(owner.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(0);

      // Check pool info updated
      pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);
    });

    it('Should fail if total amount higher than pool reserve', async function () {
      const { token, owner, otherAccount1, otherAccount2 } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(100) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      // Check pool info in GNZToken are reflecting the current state
      let pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);

      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      const mintInstructions = [
        {
          to: await owner.getAddress(),
          amount: BigInt(50) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount1.getAddress(),
          amount: BigInt(176) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount2.getAddress(),
          amount: BigInt(28) * BigInt(10 ** 18),
        },
      ];

      // Batch mint from pool
      await expect(token.connect(impersonatedTransferPoolSigner).batchMint(mintInstructions)).to.be.reverted;

      // Check balance of each account
      expect(await token.balanceOf(owner.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(0);

      // Check pool info updated
      pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);
    });

    it('Should succed if instructions correct', async function () {
      const { token, owner, otherAccount1, otherAccount2 } = await loadFixture(deployToken);
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1000) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      // Check pool info in GNZToken are reflecting the current state
      let pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);

      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      const mintInstructions = [
        {
          to: await owner.getAddress(),
          amount: BigInt(50) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount1.getAddress(),
          amount: BigInt(176) * BigInt(10 ** 18),
        },
        {
          to: await otherAccount2.getAddress(),
          amount: BigInt(28) * BigInt(10 ** 18),
        },
      ];
      const totalAmount = mintInstructions[0].amount + mintInstructions[1].amount + mintInstructions[2].amount;

      // Batch mint from pool
      await expect(token.connect(impersonatedTransferPoolSigner).batchMint(mintInstructions)).not.be.reverted;
      expect(await token.balanceOf(owner.getAddress())).to.equal(mintInstructions[0].amount);
      expect(await token.balanceOf(otherAccount1.getAddress())).to.equal(mintInstructions[1].amount);
      expect(await token.balanceOf(otherAccount2.getAddress())).to.equal(mintInstructions[2].amount);

      // Check pool info updated
      pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken - totalAmount);
      expect(pool[2]).to.equal(totalAmount);
    });
  });

  describe('transferAllocation', function () {
    it('Should transfer token allocation from one pool to another', async function () {
      const { token } = await loadFixture(deployToken);
      // Add first pool
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;

      // Add second pool
      async function deployPoolOfToken2(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool: transferPool2 } = await loadFixture(deployPoolOfToken2);
      const pool2ReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool2.getAddress(), pool2ReservedToken)).not.be.reverted;
      expect(await transferPool2.getReservedTokens()).to.equal(pool2ReservedToken);
      let pool2 = await token.getPool(transferPool2.getAddress());
      expect(pool2[0]).to.equal(await transferPool2.getAddress());
      expect(pool2[1]).to.equal(pool2ReservedToken);
      expect(pool2[2]).to.equal(0);

      // Impersonate the pool contract address
      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      // Transfer token allocation from first pool to second pool
      await expect(
        token
          .connect(impersonatedTransferPoolSigner)
          .transferAllocation(await transferPool2.getAddress(), await transferPool2.getAvailableTokens()),
      ).not.be.reverted;

      // transferPool2 reserved token should be updated
      expect(await transferPool2.getReservedTokens()).to.equal(poolReservedToken + pool2ReservedToken);

      // Pool information in token smart contract should be updated
      // Pool 1 info
      const pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(0);
      expect(pool[2]).to.equal(0);
      // Pool 2
      pool2 = await token.getPool(transferPool2.getAddress());
      expect(pool2[0]).to.equal(await transferPool2.getAddress());
      expect(pool2[1]).to.equal(pool2ReservedToken + poolReservedToken);
      expect(pool2[2]).to.equal(0);
    });

    it('Should fail to transfer token allocation to a non pool address', async function () {
      const { token, owner } = await loadFixture(deployToken);
      // Add first pool
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;

      // Impersonate the pool contract address
      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      // Try to transfer token allocation from first pool to owner address
      await expect(
        token.connect(impersonatedTransferPoolSigner).transferAllocation(await owner.getAddress(), await transferPool.getAvailableTokens()),
      ).be.reverted;
      expect(await transferPool.getReservedTokens()).to.equal(poolReservedToken);
      const pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);
    });

    it('Should fail to transfer more than reserved token', async () => {
      const { token } = await loadFixture(deployToken);
      // Add first pool
      async function deployPoolOfToken(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool } = await loadFixture(deployPoolOfToken);
      const poolReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool.getAddress(), poolReservedToken)).not.be.reverted;

      // Add second pool
      async function deployPoolOfToken2(): Promise<DeployTransferPoolReturn> {
        return deployExchangeReservePool(token);
      }
      const { transferPool: transferPool2 } = await loadFixture(deployPoolOfToken2);
      const pool2ReservedToken = BigInt(1) * BigInt(10 ** 18);
      await expect(token.registerPool(await transferPool2.getAddress(), pool2ReservedToken)).not.be.reverted;
      expect(await transferPool2.getReservedTokens()).to.equal(pool2ReservedToken);
      let pool2 = await token.getPool(transferPool2.getAddress());
      expect(pool2[0]).to.equal(await transferPool2.getAddress());
      expect(pool2[1]).to.equal(pool2ReservedToken);
      expect(pool2[2]).to.equal(0);

      // Impersonate the pool contract address
      const poolAddress = await transferPool.getAddress();
      const impersonatedTransferPoolSigner = await ethers.getImpersonatedSigner(poolAddress);
      // Fund the impersonated signer
      await network.provider.send('hardhat_setBalance', [poolAddress, '0x1000000000000000000']);

      // Transfer token allocation from first pool to second pool
      await expect(
        token
          .connect(impersonatedTransferPoolSigner)
          .transferAllocation(await transferPool2.getAddress(), (await transferPool2.getAvailableTokens()) + BigInt(1)),
      ).be.reverted;

      // transferPool2 reserved token should be updated
      expect(await transferPool2.getReservedTokens()).to.equal(pool2ReservedToken);

      // Pool information in token smart contract should be updated
      // Pool 1 info
      const pool = await token.getPool(transferPool.getAddress());
      expect(pool[0]).to.equal(await transferPool.getAddress());
      expect(pool[1]).to.equal(poolReservedToken);
      expect(pool[2]).to.equal(0);
      // Pool 2
      pool2 = await token.getPool(transferPool2.getAddress());
      expect(pool2[0]).to.equal(await transferPool2.getAddress());
      expect(pool2[1]).to.equal(pool2ReservedToken);
      expect(pool2[2]).to.equal(0);
    });
  });
});
