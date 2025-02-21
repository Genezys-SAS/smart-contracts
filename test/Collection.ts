/* eslint-disable no-unexpected-multiline */
import { ethers, upgrades, network } from 'hardhat';
import { BaseContract } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Collection, Forwarder } from '../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

type DeployReturn = {
  collection: Collection;
  forwarder: Forwarder;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

describe('Collection', function () {
  async function deployCollection(
    collectionName = 'name',
    collectionSymbole = 'customSymbol',
    baseURI = 'https://domain.com/',
  ): Promise<DeployReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const collectionFactory = await ethers.getContractFactory('Collection');

    // Use hardhat-upgrade plugins to have correct deployment process (with upgrade), add upgrade verfication (like no constructor)
    const collection = (await upgrades.deployProxy(collectionFactory, [collectionName, collectionSymbole, baseURI], {
      constructorArgs: [await forwarder.getAddress()], // Just because we have contract with constructor
    })) as unknown as Collection;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { collection, forwarder, owner, otherAccount1, otherAccount2 };
  }

  describe('Deployment', function () {
    it('Should have good tag and collection name', async function () {
      async function deployWithCustomName(): Promise<DeployReturn> {
        return deployCollection('customName', 'customSymbol', 'https://custom.domain.com/');
      }
      const { collection } = await loadFixture(deployWithCustomName);

      expect(await collection.name()).to.equal('customName');
      expect(await collection.symbol()).to.equal('customSymbol');
      expect(await collection.getBaseURI()).to.equal('https://custom.domain.com/');
    });
  });

  describe('Mint', function () {
    it('Should mint with owner user', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collection.ownerOf(1)).to.equal(await otherAccount1.getAddress());
      expect(await collection.tokenURI(1)).to.equal('https://domain.com/0/1.json');
    });

    it('Should mint 60 card with 4 rarity and 50 team member', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      const input: { number: number; rarity: number; cardMetadataIndex: number }[] = [];
      for (let i = 0; i < 60; i++) {
        input.push({
          number: i + 1, // For add in random number
          rarity: i % 4,
          cardMetadataIndex: i % 50,
        });
      }

      const receiverAddress = await otherAccount1.getAddress();

      await expect(collection.mint(input, receiverAddress)).not.be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(60);
      for (let i = 0; i < 60; i++) {
        expect(await collection.ownerOf(i + 1)).to.equal(receiverAddress);
        expect(await collection.tokenURI(i + 1)).to.equal(`https://domain.com/${i % 50}/${i % 4}.json`);
      }
    });

    it('Should mint "random" number', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      const receiverAddress = await otherAccount1.getAddress();
      await expect(
        collection.mint(
          [
            { number: 23, rarity: 2, cardMetadataIndex: 2 },
            { number: 5, rarity: 1, cardMetadataIndex: 6 },
          ],
          receiverAddress,
        ),
      ).not.be.reverted;

      expect(await collection.balanceOf(receiverAddress)).to.equal(2);
      expect(await collection.ownerOf(5)).to.equal(receiverAddress);
      expect(await collection.tokenURI(5)).to.equal(`https://domain.com/6/1.json`);
      expect(await collection.ownerOf(23)).to.equal(receiverAddress);
      expect(await collection.tokenURI(23)).to.equal(`https://domain.com/2/2.json`);
    });

    it('Should mint failed completly when one mint fail', async function () {
      const { collection, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);

      await expect(collection.mint([{ number: 4, rarity: 1, cardMetadataIndex: 0 }], await otherAccount2.getAddress())).not.be.reverted; // Reserve nonce 4

      await expect(
        collection.mint(
          [
            { number: 2, rarity: 1, cardMetadataIndex: 0 },
            { number: 4, rarity: 1, cardMetadataIndex: 0 }, // Already used
            { number: 6, rarity: 1, cardMetadataIndex: 0 },
          ],
          await otherAccount1.getAddress(),
        ),
      ).be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);
    });

    it('Should not mint with owner user', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      await expect(
        collection.connect(otherAccount1).mint([{ number: 1, rarity: 0, cardMetadataIndex: 0 }], await otherAccount1.getAddress()),
      ).to.be.revertedWithCustomError(collection, 'OwnableUnauthorizedAccount');
    });
  });

  describe('baseURI set/get function', function () {
    it('Should set base URI', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;
      await expect(collection.setBaseURI('https://new.domain.com/')).not.be.reverted;

      expect(await collection.tokenURI(1)).to.equal('https://new.domain.com/0/1.json');
      expect(await collection.getBaseURI()).to.equal('https://new.domain.com/');
    });

    it('Should not set base URI if not owner', async function () {
      const { collection, otherAccount1 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;
      await expect(collection.connect(otherAccount1).setBaseURI('https://new.domain.com/')).be.revertedWithCustomError(
        collection,
        'OwnableUnauthorizedAccount',
      );

      expect(await collection.tokenURI(1)).to.equal('https://domain.com/0/1.json');
      expect(await collection.getBaseURI()).to.equal('https://domain.com/');
    });
  });

  describe('transfert function', function () {
    it('Should transfert nft when we are owner of nft', async () => {
      const { collection, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      await expect(
        collection
          .connect(otherAccount1)
          ['safeTransferFrom(address,address,uint256)'](await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1),
      ).not.be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(1);
    });

    it('Should not transfert nft when we are not owner of nft', async () => {
      const { collection, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      await expect(
        collection
          .connect(owner)
          ['safeTransferFrom(address,address,uint256)'](await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1),
      ).be.revertedWithCustomError(collection, 'ERC721InsufficientApproval');
      await expect(
        collection
          .connect(otherAccount2)
          ['safeTransferFrom(address,address,uint256)'](await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1),
      ).be.revertedWithCustomError(collection, 'ERC721InsufficientApproval');

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
    });
  });

  describe('batch transfert function', function () {
    it('Should transfert nfts when we are owner of nft', async () => {
      const { collection, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(
        collection.mint(
          [
            { number: 1, rarity: 1, cardMetadataIndex: 0 },
            { number: 2, rarity: 1, cardMetadataIndex: 0 },
          ],
          await otherAccount1.getAddress(),
        ),
      ).not.be.reverted;

      await expect(
        collection.connect(otherAccount1).batchSafeTransferFrom(await otherAccount1.getAddress(), await otherAccount2.getAddress(), [1, 2]),
      ).not.be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(2);
    });

    it('Should not transfert nft when we are not owner of nft', async () => {
      const { collection, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      await expect(
        collection.connect(owner).batchSafeTransferFrom(await otherAccount1.getAddress(), await otherAccount2.getAddress(), [1]),
      ).be.revertedWithCustomError(collection, 'ERC721InsufficientApproval');
      await expect(
        collection.connect(otherAccount2).batchSafeTransferFrom(await otherAccount1.getAddress(), await otherAccount2.getAddress(), [1]),
      ).be.revertedWithCustomError(collection, 'ERC721InsufficientApproval');

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
    });

    it('Should transfert nfts rollback when one failed', async () => {
      const { collection, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;
      await expect(collection.mint([{ number: 2, rarity: 1, cardMetadataIndex: 0 }], await owner.getAddress())).not.be.reverted;

      await expect(
        collection.connect(otherAccount1).batchSafeTransferFrom(await otherAccount1.getAddress(), await otherAccount2.getAddress(), [1, 2]),
      ).be.revertedWithCustomError(collection, 'ERC721InsufficientApproval');

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(0);
    });
  });

  describe('relayed function', function () {
    interface ForwardRequestData {
      from: string;
      to: string;
      value: bigint;
      gas: bigint;
      nonce: bigint;
      deadline: number;
      data: string;
      signature: string;
    }

    async function createLocalTransaction(
      forwarder: Forwarder,
      contract: BaseContract,
      functionName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: any[],
      from: HardhatEthersSigner,
      addLocalyNonceNumber = 0,
    ): Promise<ForwardRequestData> {
      const data = contract.interface.encodeFunctionData(functionName, args);
      let gas = BigInt(5000000);
      try {
        gas = await contract
          .connect(from)
          .getFunction(functionName)
          .estimateGas(...args);
      } catch {
        // Just in case if failed fo test only, keep big number of gas
      }

      const nonce = await forwarder.nonces(from.getAddress());
      const request: ForwardRequestData = {
        from: from.address,
        to: await contract.getAddress(),
        value: BigInt(0),
        gas,
        nonce: nonce + BigInt(addLocalyNonceNumber),
        deadline: Math.floor(Date.now() / 1000) + 36_000, // 10 hour from now
        data,
        signature: '', // Will be filled later
      };

      const domain = {
        name: 'genezys-forwarder',
        version: '1',
        chainId: network.config.chainId,
        verifyingContract: await forwarder.getAddress(),
      };
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };
      const signature = await from.signTypedData(domain, types, request);
      request.signature = signature;
      return request;
    }

    it('Should payed transaction for other user', async () => {
      const { collection, forwarder, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      const localTx = await createLocalTransaction(
        forwarder,
        collection,
        'safeTransferFrom(address,address,uint256)',
        [await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1],
        otherAccount1,
      );
      await forwarder.connect(owner).execute(localTx);

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(1);
    });

    it('Should payed transaction for other user not work if bad user sign', async () => {
      const { collection, forwarder, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;

      const localTx = await createLocalTransaction(
        forwarder,
        collection,
        'safeTransferFrom(address,address,uint256)',
        [await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1],
        otherAccount2,
      );
      await expect(forwarder.connect(owner).execute(localTx)).be.reverted;

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(0);
    });

    // Warning failed of subtransaction not rolback other
    it('Should execute batch transaction', async () => {
      const { collection, forwarder, owner, otherAccount1, otherAccount2 } = await loadFixture(deployCollection);

      await expect(
        collection.mint(
          [
            { number: 1, rarity: 1, cardMetadataIndex: 0 },
            { number: 2, rarity: 1, cardMetadataIndex: 0 },
          ],
          await otherAccount1.getAddress(),
        ),
      ).not.be.reverted;

      const localBatchTxs = [
        await createLocalTransaction(
          forwarder,
          collection,
          'safeTransferFrom(address,address,uint256)',
          [await otherAccount1.getAddress(), await otherAccount2.getAddress(), 1],
          otherAccount1,
        ),
        await createLocalTransaction(
          forwarder,
          collection,
          'safeTransferFrom(address,address,uint256)',
          [await otherAccount1.getAddress(), await otherAccount2.getAddress(), 2],
          otherAccount1,
          1,
        ),
      ];
      await forwarder.connect(owner).executeBatch(localBatchTxs, await owner.getAddress());

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(0);
      expect(await collection.balanceOf(otherAccount2.getAddress())).to.equal(2);
    });
  });

  describe('upgrade', function () {
    it("Should upgrade don't lose value", async () => {
      const { collection, forwarder, otherAccount1 } = await loadFixture(deployCollection);

      await expect(collection.mint([{ number: 1, rarity: 1, cardMetadataIndex: 0 }], await otherAccount1.getAddress())).not.be.reverted;
      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collection.getBaseURI()).to.equal('https://domain.com/');

      // Simulate upgrade
      const factory = await ethers.getContractFactory('Collection');
      const collectionUpgrade = (await upgrades.upgradeProxy(await collection.getAddress(), factory, {
        constructorArgs: [await forwarder.getAddress()],
      })) as unknown as Collection; // Just because we have contract with constructor

      expect(await collection.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collection.getBaseURI()).to.equal('https://domain.com/');
      expect(await collectionUpgrade.balanceOf(otherAccount1.getAddress())).to.equal(1);
      expect(await collectionUpgrade.getBaseURI()).to.equal('https://domain.com/');
    });
  });
});
