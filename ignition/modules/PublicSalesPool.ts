import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { setupContractPool } from './utils';

export const publicSalesPoolModule = buildModule('PublicSalesPoolModule', (m) => {
  return setupContractPool(m, 'PublicSalesPool');
});
