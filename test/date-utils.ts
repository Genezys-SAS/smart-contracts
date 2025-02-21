import { network } from 'hardhat';
import { expect } from 'chai';

let currentYear = 2000;
export function getNewTestStartDate(): Date {
  const date = new Date(currentYear.toString() + '-01-01T00:00:00.000Z');
  currentYear += 10;
  return date;
}

export function monthToMs(months: number): number {
  return dayToMs(30) * months;
}

export function dayToMs(days: number): number {
  return days * 24 * 60 * 1_000;
}

export async function setBlockchainDate(date: Date): Promise<void> {
  await network.provider.send('evm_setNextBlockTimestamp', [date.getTime()]);
  await network.provider.send('evm_mine');
}

export async function addBlockchainTime(time: number): Promise<void> {
  await network.provider.send('evm_increaseTime', [time]);
  await network.provider.send('evm_mine');
}

export function expectIgnoreMs(given: number | bigint, expected: number): void {
  expect(new Date(Number(given)).setMilliseconds(0)).to.equal(new Date(expected).setMilliseconds(0));
}
