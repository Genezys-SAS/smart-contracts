import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export const forwarderModule = buildModule('ForwarderModule', (m) => {
  const logic = m.contract('Forwarder', undefined, { id: 'logic' });

  const init = m.encodeFunctionCall(logic, 'initialize', [m.getParameter('name')]);
  const Proxy = m.contract('TransparentUpgradeableProxy', [logic, m.getAccount(0), init]);

  const proxyAdminAddress = m.readEventArgument(Proxy, 'AdminChanged', 'newAdmin');
  const ProxyAdmin = m.contractAt('ProxyAdmin', proxyAdminAddress);

  const Forwarder = m.contractAt('Forwarder', Proxy);

  m.call(Forwarder, 'transferOwnership', [m.getParameter('platform')], { id: 'forwarder_transferOwnership' });
  m.call(ProxyAdmin, 'transferOwnership', [m.getParameter('admin')], { id: 'proxy_transferOwnership' });

  return { Forwarder, ForwarderProxyAdmin: ProxyAdmin };
});
