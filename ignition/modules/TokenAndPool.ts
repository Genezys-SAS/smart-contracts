import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { finalizeGnzTokenModule, gnzTokenModule } from './GNZToken';
import { athletePoolModule } from './AthletePool';
import { exchangeOverflowReservePoolModule } from './ExchangeOverflowReservePool';
import { exchangeReservePoolModule } from './ExchangeReservePool';
import { partnerPoolModule } from './PartnerPool';
import { privateSalesPoolModule } from './PrivateSalesPool';
import { publicSalesPoolModule } from './PublicSalesPool';
import { teamPoolModule } from './TeamPool';
import { treasuryPoolModule } from './TreasuryPool';
import { forwarderModule } from './Forwarder';
import { communityPoolModule } from './CommunityPool';
import { Future } from '@nomicfoundation/ignition-core';

const initTokenAndPoolModule = buildModule('InitTokenPoolModule', (m) => {
  const { Forwarder, ForwarderProxyAdmin } = m.useModule(forwarderModule);
  const { GNZToken, GNZTokenProxyAdmin } = m.useModule(gnzTokenModule);
  const { AthletePool, AthletePoolProxyAdmin } = m.useModule(athletePoolModule);
  const { ExchangeOverflowReservePool, ExchangeOverflowReservePoolProxyAdmin } = m.useModule(exchangeOverflowReservePoolModule);
  const { ExchangeReservePool, ExchangeReservePoolProxyAdmin } = m.useModule(exchangeReservePoolModule);
  const { PartnerPool, PartnerPoolProxyAdmin } = m.useModule(partnerPoolModule);
  const { PrivateSalesPool, PrivateSalesPoolProxyAdmin } = m.useModule(privateSalesPoolModule);
  const { PublicSalesPool, PublicSalesPoolProxyAdmin } = m.useModule(publicSalesPoolModule);
  const { TeamPool, TeamPoolProxyAdmin } = m.useModule(teamPoolModule);
  const { TreasuryPool, TreasuryPoolProxyAdmin } = m.useModule(treasuryPoolModule);
  const { CommunityPool, CommunityPoolProxyAdmin } = m.useModule(communityPoolModule);

  return {
    Forwarder,
    ForwarderProxyAdmin,
    GNZToken,
    GNZTokenProxyAdmin,
    AthletePool,
    AthletePoolProxyAdmin,
    ExchangeOverflowReservePool,
    ExchangeOverflowReservePoolProxyAdmin,
    ExchangeReservePool,
    ExchangeReservePoolProxyAdmin,
    PartnerPool,
    PartnerPoolProxyAdmin,
    PrivateSalesPool,
    PrivateSalesPoolProxyAdmin,
    PublicSalesPool,
    PublicSalesPoolProxyAdmin,
    TeamPool,
    TeamPoolProxyAdmin,
    TreasuryPool,
    TreasuryPoolProxyAdmin,
    CommunityPool,
    CommunityPoolProxyAdmin,
  };
});

export const tokenAndPoolModule = buildModule('TokenPoolModule', (m) => {
  const result = m.useModule(initTokenAndPoolModule);

  const after: Future[] = [];
  for (const contract of Object.values(result)) {
    after.push(contract);
  }

  finalizeGnzTokenModule(m, result.GNZToken, after);

  return result;
});

export default tokenAndPoolModule;
