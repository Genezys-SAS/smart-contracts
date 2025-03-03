import { setupContractPool } from './utils';
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export const partnerPoolModule = buildModule('PartnerPoolModule', (m) => {
  return setupContractPool(m, 'PartnerPool', ['poolStart', 'poolDuration']);
});
