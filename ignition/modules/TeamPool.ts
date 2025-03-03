import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { setupContractPool } from './utils';

export const teamPoolModule = buildModule('TeamPoolModule', (m) => {
  return setupContractPool(m, 'TeamPool', ['vestingCliff', 'vestingDuration']);
});
