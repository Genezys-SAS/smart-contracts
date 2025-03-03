import { ethers } from 'hardhat';
import { getTokenAndPoolConf as getTokenAndPoolConfBase } from './TokenAndPool';
import fs from 'fs';
import { DeploymentParameters } from '@nomicfoundation/ignition-core';
import { Wallet } from 'ethers';

export function getStartDateDeployment(pathDeployment: string): Date {
  const path = pathDeployment + '/start-date';
  if (fs.existsSync(path)) {
    const file = fs.readFileSync(path);
    const string = Buffer.from(file).toString();
    return new Date(string);
  } else {
    const date = new Date();
    fs.mkdirSync(pathDeployment, { recursive: true });
    fs.writeFileSync(path, date.toISOString());
    return date;
  }
}

export async function getTokenAndPoolConf(pathDeployment: string): Promise<DeploymentParameters> {
  const platform = (await ethers.getSigners())[0];
  const admin = Wallet.createRandom();
  const manager = Wallet.createRandom();
  console.log('admin', admin);
  console.log('manager', manager);
  return getTokenAndPoolConfBase({
    poolStartDate: getStartDateDeployment(pathDeployment),
    adminRoleAddress: admin.address,
    managerRoleAddress: manager.address,
    platformRoleAddress: platform.address,
  });
}
