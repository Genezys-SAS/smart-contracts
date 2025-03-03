import { ethers, ignition } from 'hardhat';
import { getNewTestStartDate } from '../date-utils';
import tokenAndPoolModule from '../../ignition/modules/TokenAndPool';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import {
  getDate,
  getDurationFromYear,
  getTokenAndPoolConf,
  getTokenForContract,
  tokenDecimals,
} from '../../ignition/parameters/TokenAndPool';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  AthletePool,
  CommunityPool,
  ExchangeOverflowReservePool,
  ExchangeReservePool,
  Forwarder,
  GNZToken,
  PartnerPool,
  PrivateSalesPool,
  ProxyAdmin,
  PublicSalesPool,
  TeamPool,
  TreasuryPool,
} from '../../typechain-types';
import { DeploymentParameters } from '@nomicfoundation/ignition-core';
import { BaseContract, Contract } from 'ethers';

export type Contracts = {
  Forwarder: Forwarder;
  ForwarderProxyAdmin: ProxyAdmin;
  GNZToken: GNZToken;
  GNZTokenProxyAdmin: ProxyAdmin;
  AthletePool: AthletePool;
  AthletePoolProxyAdmin: ProxyAdmin;
  ExchangeOverflowReservePool: ExchangeOverflowReservePool;
  ExchangeOverflowReservePoolProxyAdmin: ProxyAdmin;
  ExchangeReservePool: ExchangeReservePool;
  ExchangeReservePoolProxyAdmin: ProxyAdmin;
  PartnerPool: PartnerPool;
  PartnerPoolProxyAdmin: ProxyAdmin;
  PrivateSalesPool: PrivateSalesPool;
  PrivateSalesPoolProxyAdmin: ProxyAdmin;
  PublicSalesPool: PublicSalesPool;
  PublicSalesPoolProxyAdmin: ProxyAdmin;
  TeamPool: TeamPool;
  TeamPoolProxyAdmin: ProxyAdmin;
  TreasuryPool: TreasuryPool;
  TreasuryPoolProxyAdmin: ProxyAdmin;
  CommunityPool: CommunityPool;
  CommunityPoolProxyAdmin: ProxyAdmin;
};

export type Roles = {
  deployer: HardhatEthersSigner;
  admin: HardhatEthersSigner;
  manager: HardhatEthersSigner;
  platform: HardhatEthersSigner;
};

describe('TokenAndPool', function () {
  const startDate = getNewTestStartDate();

  async function deploy(): Promise<{ contracts: Contracts; roles: Roles; config: DeploymentParameters }> {
    const [deployer, admin, manager, platform] = await ethers.getSigners();
    const config = getTokenAndPoolConf({
      poolStartDate: startDate,
      adminRoleAddress: admin.address,
      managerRoleAddress: manager.address,
      platformRoleAddress: platform.address,
    });
    const contracts = (await ignition.deploy(tokenAndPoolModule, {
      parameters: config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    return { contracts, roles: { deployer, admin, manager, platform }, config };
  }

  describe('Parameter utility function', () => {
    it('tokenDecimals', () => {
      expect(tokenDecimals).to.equals(BigInt('1000000000000000000'));
    });

    it('getDate', () => {
      expect(getDate('2025-01-01T00:00:00.000Z')).to.equals(1735689600000);
    });

    it('getDurationFromYear', () => {
      expect(getDurationFromYear(1)).to.equals(31536000000);
      expect(getDurationFromYear(1.6)).to.equals(50457600000);
      expect(getDurationFromYear(2)).to.equals(63072000000);
    });

    it('getTokenForContract', () => {
      expect(getTokenForContract(1)).to.equals(BigInt('1000000000000000000'));
      expect(getTokenForContract(10)).to.equals(BigInt('10000000000000000000'));
      expect(getTokenForContract(987)).to.equals(BigInt('987000000000000000000'));
      expect(getTokenForContract(6_000_000_000)).to.equals(BigInt('6000000000000000000000000000'));
    });
  });

  it('should be correclty deployed', async function () {
    const deployed = await loadFixture(deploy);

    async function checkRoles(contract: BaseContract, admin: boolean, manager: boolean, platform: boolean): Promise<void> {
      const cont = contract as Contract;
      if (admin) {
        expect(await cont.hasRole(await cont.DEFAULT_ADMIN_ROLE(), deployed.roles.admin.address)).equals(true);
        expect(await cont.hasRole(await cont.DEFAULT_ADMIN_ROLE(), deployed.roles.manager.address)).equals(false);
        expect(await cont.hasRole(await cont.DEFAULT_ADMIN_ROLE(), deployed.roles.platform.address)).equals(false);
        expect(await cont.hasRole(await cont.DEFAULT_ADMIN_ROLE(), deployed.roles.deployer.address)).equals(false);
      }

      if (manager) {
        expect(await cont.hasRole(await cont.POOL_MANAGER_ROLE(), deployed.roles.manager.address)).equals(true);
        expect(await cont.hasRole(await cont.POOL_MANAGER_ROLE(), deployed.roles.admin.address)).equals(false);
        expect(await cont.hasRole(await cont.POOL_MANAGER_ROLE(), deployed.roles.platform.address)).equals(false);
        expect(await cont.hasRole(await cont.POOL_MANAGER_ROLE(), deployed.roles.deployer.address)).equals(false);
      }

      if (platform) {
        expect(await cont.hasRole(await cont.POOL_PLATFORM_ROLE(), deployed.roles.platform.address)).equals(true);
        expect(await cont.hasRole(await cont.POOL_PLATFORM_ROLE(), deployed.roles.admin.address)).equals(false);
        expect(await cont.hasRole(await cont.POOL_PLATFORM_ROLE(), deployed.roles.manager.address)).equals(false);
        expect(await cont.hasRole(await cont.POOL_PLATFORM_ROLE(), deployed.roles.deployer.address)).equals(false);
      }
    }

    const nbTokens = deployed.config.GNZTokenModule.tokenSupply as bigint;
    const mintPools = [
      { name: 'AthletePool', contract: deployed.contracts.AthletePool },
      { name: 'ExchangeReservePool', contract: deployed.contracts.ExchangeReservePool },
      { name: 'PartnerPool', contract: deployed.contracts.PartnerPool },
      { name: 'PrivateSalesPool', contract: deployed.contracts.PrivateSalesPool },
      { name: 'PublicSalesPool', contract: deployed.contracts.PublicSalesPool },
      { name: 'TeamPool', contract: deployed.contracts.TeamPool },
      { name: 'TreasuryPool', contract: deployed.contracts.TreasuryPool },
      { name: 'CommunityPool', contract: deployed.contracts.CommunityPool },
    ];

    // Check forwarder
    expect(await deployed.contracts.Forwarder.owner()).equals(deployed.roles.platform.address);
    expect(await deployed.contracts.ForwarderProxyAdmin.owner()).equals(deployed.roles.admin.address);

    // Check GNZ
    expect(await deployed.contracts.GNZToken.trustedForwarder()).equals(await deployed.contracts.Forwarder.getAddress());
    expect(await deployed.contracts.GNZTokenProxyAdmin.owner()).equals(deployed.roles.admin.address);

    expect(await deployed.contracts.GNZToken.getTotalAllocatedTokens()).to.equals(nbTokens);
    expect(await deployed.contracts.GNZToken.totalSupply()).to.equals(0);
    expect(await deployed.contracts.GNZToken.name()).to.equals(deployed.config['GNZTokenModule'].tokenName);
    expect(await deployed.contracts.GNZToken.symbol()).to.equals(deployed.config['GNZTokenModule'].tokenTicker);
    await checkRoles(deployed.contracts.GNZToken, true, false, false);

    // Check generic pools
    let sum = BigInt(0);
    for (const pool of mintPools) {
      const amount = deployed.config[`${pool.name}Module`].tokenSupply as bigint;
      const gnzInPool = await deployed.contracts.GNZToken.getPool(await pool.contract.getAddress());
      expect(gnzInPool[0]).equals(await pool.contract.getAddress());
      expect(gnzInPool[1]).equals(amount);
      expect(gnzInPool[2]).equals(0);
      expect(
        await deployed.contracts.GNZToken.hasRole(await deployed.contracts.GNZToken.POOL_ROLE(), await pool.contract.getAddress()),
      ).equals(true);

      expect(await pool.contract.trustedForwarder()).equals(await deployed.contracts.Forwarder.getAddress());
      expect(await (deployed.contracts[`${pool.name}ProxyAdmin` as keyof typeof deployed.contracts] as ProxyAdmin).owner()).equals(
        deployed.roles.admin.address,
      );

      expect(await pool.contract.getTokenContract()).equals(await deployed.contracts.GNZToken.getAddress());
      expect(await pool.contract.getReservedTokens()).equals(amount);

      await checkRoles(pool.contract, true, true, true);
      sum += amount;
    }
    expect(sum).equals(nbTokens);

    // Check exchange reserve pool overflow
    const gnzInPool = await deployed.contracts.GNZToken.getPool(await deployed.contracts.ExchangeOverflowReservePool.getAddress());
    expect(gnzInPool[0]).equals('0x0000000000000000000000000000000000000000');
    expect(gnzInPool[1]).equals(0);
    expect(gnzInPool[2]).equals(0);
    expect(
      await deployed.contracts.GNZToken.hasRole(
        await deployed.contracts.GNZToken.POOL_ROLE(),
        await deployed.contracts.ExchangeOverflowReservePool.getAddress(),
      ),
    ).equals(false);

    expect(await deployed.contracts.ExchangeOverflowReservePool.trustedForwarder()).equals(await deployed.contracts.Forwarder.getAddress());
    expect(await deployed.contracts.ExchangeOverflowReservePoolProxyAdmin.owner()).equals(deployed.roles.admin.address);
    await checkRoles(deployed.contracts.ExchangeOverflowReservePool, true, true, false);

    expect(await deployed.contracts.ExchangeOverflowReservePool.getTokenContract()).equals(await deployed.contracts.GNZToken.getAddress());
    expect(await deployed.contracts.ExchangeOverflowReservePool.getBalance()).equals(0);

    // Check specific
    async function checkScheduledReleasePool(name: keyof Contracts): Promise<void> {
      const contract = deployed.contracts[name] as unknown as Contract;
      const config = deployed.config[`${name}Module`];
      expect(await contract.getTotalAllocation()).equals(config.tokenSupply);
      expect(await contract.getAvailableTokens()).equals(0);
      expect(await contract.poolStart()).equals(startDate.getTime());
      expect(await contract.poolDuration()).equals(config.poolDuration);
      expect(await contract.poolEnd()).equals(startDate.getTime() + (config.poolDuration as number));
      expect(await contract.poolReleased()).equals(0);
    }

    async function checkVestingPool(name: keyof Contracts): Promise<void> {
      const contract = deployed.contracts[name] as unknown as Contract;
      expect(await contract.getTotalUnreleased()).equals(0);
      expect(await contract.getPagination()).equals(0);
    }

    await checkScheduledReleasePool('AthletePool');
    await checkVestingPool('AthletePool');

    await checkVestingPool('PartnerPool');
    await checkVestingPool('PartnerPool');

    await checkScheduledReleasePool('TreasuryPool');

    await checkVestingPool('PrivateSalesPool');

    await checkVestingPool('PublicSalesPool');

    await checkVestingPool('TeamPool');

    // Nothing for ExchangeReservePool

    expect(await deployed.contracts.CommunityPool.getAvailableTokens()).equals(0);
    expect(await deployed.contracts.CommunityPool.baseTotal()).equals(deployed.config['CommunityPoolModule'].baseTotal);
  });
});
