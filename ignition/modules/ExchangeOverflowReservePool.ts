import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { deployContractPool } from './utils';

export const exchangeOverflowReservePoolModule = buildModule('ExchangeOverflowReservePoolModule', (m) => {
  const { Contract, ProxyAdmin } = deployContractPool(m, 'ExchangeOverflowReservePool', [], false);

  m.call(ProxyAdmin, 'transferOwnership', [m.getParameter('admin')]);

  return { ExchangeOverflowReservePool: Contract, ExchangeOverflowReservePoolProxyAdmin: ProxyAdmin };
});
