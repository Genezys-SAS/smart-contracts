import { setupContractPool } from './utils';
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export const exchangeReservePoolModule = buildModule('ExchangeReservePoolModule', (m) => {
  return setupContractPool(m, 'ExchangeReservePool');
});
