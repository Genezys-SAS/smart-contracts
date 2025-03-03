import { DeploymentParameters } from '@nomicfoundation/ignition-core';

export function getTokenAndPoolConf(config: {
  poolStartDate: string | Date | number;
  adminRoleAddress: string;
  managerRoleAddress: string;
  platformRoleAddress: string;
}): DeploymentParameters {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parameters: any = {
    ForwarderModule: {
      name: 'genezys-forwarder',
    },

    GNZTokenModule: {
      tokenName: 'Genezys',
      tokenTicker: 'GNZ',
      tokenSupply: getTokenForContract(6_000_000_000),
    },

    AthletePoolModule: {
      poolStart: getDate(config.poolStartDate),
      poolDuration: getDurationFromYear(5),
      tokenSupply: getTokenForContract(720_000_000),
    },

    ExchangeOverflowReservePoolModule: {}, // For Inject roles attributes

    ExchangeReservePoolModule: {
      tokenSupply: getTokenForContract(906_600_000),
    },

    PartnerPoolModule: {
      poolStart: getDate(config.poolStartDate),
      poolDuration: getDurationFromYear(2.5),
      tokenSupply: getTokenForContract(180_000_000),
    },

    PrivateSalesPoolModule: {
      vestingCliff: getDurationFromYear(1),
      vestingDuration: getDurationFromYear(1.66),
      tokenSupply: getTokenForContract(254_400_000),
    },

    PublicSalesPoolModule: {
      tokenSupply: getTokenForContract(219_000_000),
    },

    TeamPoolModule: {
      vestingCliff: getDurationFromYear(1),
      vestingDuration: getDurationFromYear(3),
      tokenSupply: getTokenForContract(300_000_000),
    },

    TreasuryPoolModule: {
      poolStart: getDate(config.poolStartDate),
      poolDuration: getDurationFromYear(5),
      tokenSupply: getTokenForContract(720_000_000),
    },

    CommunityPoolModule: {
      baseTotal: getTokenForContract(100_000),
      tokenSupply: getTokenForContract(2_700_000_000),
    },

    TokenPoolModule: {}, // For Inject roles attributes
  };
  // Inject permission in all parameters, even is is not needed. Do nothing if is already set
  for (const key of Object.keys(parameters)) {
    if (!parameters[key].admin) parameters[key].admin = config.adminRoleAddress;
    if (!parameters[key].manager) parameters[key].manager = config.managerRoleAddress;
    if (!parameters[key].platform) parameters[key].platform = config.platformRoleAddress;
  }
  return parameters;
}

export const tokenDecimals = BigInt(10 ** 18);

export function getDate(isoDate: string | Date | number): number {
  return new Date(isoDate).getTime();
}

export function getDurationFromYear(year: number): number {
  return Math.round(year * 365 * 24 * 60 * 60 * 1_000);
}

export function getTokenForContract(token: number): bigint {
  return BigInt(token) * tokenDecimals;
}
