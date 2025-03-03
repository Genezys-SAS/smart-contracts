import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { setupContractPool } from './utils';

export const treasuryPoolModule = buildModule('TreasuryPoolModule', (m) => {
  return setupContractPool(m, 'TreasuryPool', ['poolStart', 'poolDuration']);
});
