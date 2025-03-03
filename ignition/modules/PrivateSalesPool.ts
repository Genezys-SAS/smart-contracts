import { setupContractPool } from './utils';
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export const privateSalesPoolModule = buildModule('PrivateSalesPoolModule', (m) => {
  return setupContractPool(m, 'PrivateSalesPool', ['vestingCliff', 'vestingDuration']);
});
