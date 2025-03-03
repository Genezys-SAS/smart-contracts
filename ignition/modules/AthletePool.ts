import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { setupContractPool } from './utils';

export const athletePoolModule = buildModule('AthletePoolModule', (m) => {
  return setupContractPool(m, 'AthletePool', ['poolStart', 'poolDuration']);
});
