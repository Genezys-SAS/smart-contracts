import { ethers } from 'hardhat';
import { getTokenAndPoolConf as getTokenAndPoolConfBase } from './TokenAndPool';
import { getStartDateDeployment } from './TokenAndPool-ci';
import { DeploymentParameters } from '@nomicfoundation/ignition-core';

export async function getTokenAndPoolConf(pathDeployment: string): Promise<DeploymentParameters> {
  const signers = await ethers.getSigners();
  return getTokenAndPoolConfBase({
    poolStartDate: getStartDateDeployment(pathDeployment),
    adminRoleAddress: signers[0].address,
    managerRoleAddress: signers[0].address,
    platformRoleAddress: signers[0].address,
  });
}
