import { ArgumentType, IgnitionModuleBuilder, NamedArtifactContractAtFuture } from '@nomicfoundation/ignition-core';
import { forwarderModule } from './Forwarder';
import { gnzTokenModule } from './GNZToken';
import { keccak256 } from 'ethers';

export const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const MANAGER_ROLE = keccak256(new TextEncoder().encode('POOL_MANAGER_ROLE'));
export const PLATFORM_ROLE = keccak256(new TextEncoder().encode('POOL_PLATFORM_ROLE'));

export type DeployContractOutput<ContractNameT extends string> = {
  Contract: NamedArtifactContractAtFuture<ContractNameT>;
  ProxyAdmin: NamedArtifactContractAtFuture<'ProxyAdmin'>;
};

export function deployContract<ContractNameT extends string>(
  m: IgnitionModuleBuilder,
  contractName: ContractNameT,
  args: (NamedArtifactContractAtFuture<string> | string)[],
): DeployContractOutput<ContractNameT> {
  const parameterArgs: ArgumentType[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      parameterArgs.push(m.getParameter(arg));
    } else {
      parameterArgs.push(arg.address);
    }
  }

  const deployArg: ArgumentType[] = [m.useModule(forwarderModule).Forwarder];
  const logic = m.contract(contractName, deployArg, { id: 'logic' });

  const init = m.encodeFunctionCall(logic, 'initialize', parameterArgs);
  const Proxy = m.contract('TransparentUpgradeableProxy', [logic, m.getAccount(0), init]);

  const proxyAdminAddress = m.readEventArgument(Proxy, 'AdminChanged', 'newAdmin');
  const ProxyAdmin = m.contractAt('ProxyAdmin', proxyAdminAddress);

  const Contract = m.contractAt(contractName, Proxy);

  return { Contract, ProxyAdmin };
}

export function deployContractPool<ContractNameT extends string>(
  m: IgnitionModuleBuilder,
  contractName: ContractNameT,
  args: (NamedArtifactContractAtFuture<string> | string)[] = [],
  includePlatformRole: boolean,
): DeployContractOutput<ContractNameT> {
  const { GNZToken } = m.useModule(gnzTokenModule);

  const parameters: (NamedArtifactContractAtFuture<string> | string)[] = [GNZToken, 'admin', 'manager'];
  if (includePlatformRole) {
    parameters.push('platform');
  }
  parameters.push(...args);

  return deployContract<ContractNameT>(m, contractName, parameters);
}

type InitContractPoolOutput<ContractNameT extends string, ContractNameProxy extends `${ContractNameT}ProxyAdmin`> = {
  [key in ContractNameT]: NamedArtifactContractAtFuture<key>;
} & {
  [key in ContractNameProxy]: NamedArtifactContractAtFuture<'ProxyAdmin'>;
};
export function setupContractPool<ContractNameT extends string>(
  m: IgnitionModuleBuilder,
  contractName: string,
  args: (NamedArtifactContractAtFuture<string> | string)[] = [],
  includePlatformRole = true,
): InitContractPoolOutput<ContractNameT, `${ContractNameT}ProxyAdmin`> {
  const { GNZToken } = m.useModule(gnzTokenModule);
  const { Contract, ProxyAdmin } = deployContractPool(m, contractName, args, includePlatformRole);

  m.call(ProxyAdmin, 'transferOwnership', [m.getParameter('admin')]);

  const tokenSupply = m.getParameter('tokenSupply');
  m.call(GNZToken, 'registerPool', [Contract.address, tokenSupply]);

  return { [`${contractName}ProxyAdmin`]: ProxyAdmin, [contractName]: Contract } as InitContractPoolOutput<
    ContractNameT,
    `${ContractNameT}ProxyAdmin`
  >;
}
