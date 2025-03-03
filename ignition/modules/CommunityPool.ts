import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { setupContractPool } from './utils';

export const communityPoolModule = buildModule('CommunityPoolModule', (m) => {
  return setupContractPool(m, 'CommunityPool', ['baseTotal']);
});
