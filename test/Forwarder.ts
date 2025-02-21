import { ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Forwarder } from '../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

type DeployReturn = {
  forwarder: Forwarder;
  owner: HardhatEthersSigner;
  otherAccount1: HardhatEthersSigner;
  otherAccount2: HardhatEthersSigner;
};

describe('Forwarder', function () {
  async function deployCollection(): Promise<DeployReturn> {
    const forwarderFactory = await ethers.getContractFactory('Forwarder');
    const forwarder = (await upgrades.deployProxy(forwarderFactory, ['genezys-forwarder'])) as unknown as Forwarder;

    const [owner, otherAccount1, otherAccount2] = await ethers.getSigners();

    return { forwarder, owner, otherAccount1, otherAccount2 };
  }

  describe('Deployment', function () {
    it('Should have good forwarder name and owner', async function () {
      const { forwarder, owner } = await loadFixture(deployCollection);

      expect((await forwarder.eip712Domain()).name).to.equal('genezys-forwarder');
      expect(await forwarder.owner()).to.equal(owner.address);
    });
  });

  describe('useNonce', function () {
    it('Should increase nonce manually', async function () {
      const { forwarder, otherAccount1 } = await loadFixture(deployCollection);

      await forwarder.useNonce(otherAccount1.address, 0);

      expect(await forwarder.nonces(otherAccount1.address)).to.equal(1);
    });

    it('Should not increase nonce manually when not owner', async function () {
      const { forwarder, otherAccount1 } = await loadFixture(deployCollection);

      await expect(forwarder.connect(otherAccount1).useNonce(otherAccount1.address, 0)).to.be.revertedWithCustomError(
        forwarder,
        'OwnableUnauthorizedAccount',
      );

      expect(await forwarder.nonces(otherAccount1.address)).to.equal(0);
    });

    it('Should note increase nonce if is not next', async function () {
      const { forwarder, otherAccount1 } = await loadFixture(deployCollection);

      await expect(forwarder.useNonce(otherAccount1.address, 1)).to.be.revertedWithCustomError(forwarder, 'ForwarderUseNonceFailed');

      expect(await forwarder.nonces(otherAccount1.address)).to.equal(0);
    });
  });
});
