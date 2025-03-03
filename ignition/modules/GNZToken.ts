import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ADMIN_ROLE, deployContract } from './utils';
import { Future, IgnitionModuleBuilder, NamedArtifactContractAtFuture } from '@nomicfoundation/ignition-core';

export const gnzTokenModule = buildModule('GNZTokenModule', (m) => {
  const { Contract, ProxyAdmin } = deployContract(m, 'GNZToken', ['tokenName', 'tokenTicker', 'tokenSupply']);

  m.call(ProxyAdmin, 'transferOwnership', [m.getParameter('admin')], { id: 'proxy_transferOwnership' });

  return { GNZToken: Contract, GNZTokenProxyAdmin: ProxyAdmin };
});

export function finalizeGnzTokenModule(
  m: IgnitionModuleBuilder,
  GNZToken: NamedArtifactContractAtFuture<'GNZToken'>,
  after: Future[],
): void {
  const grant = m.call(GNZToken, 'grantRole', [ADMIN_ROLE, m.getParameter('admin')], { id: 'GNZToken_grantRole_admin', after });
  m.call(GNZToken, 'renounceRole', [ADMIN_ROLE, m.getAccount(0)], { id: 'GNZToken_renounceRole_admin', after: [...after, grant] });
}
