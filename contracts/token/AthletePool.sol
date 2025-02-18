// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ScheduledReleasePool } from './templates/ScheduledReleasePool.sol';
import { VestingPool } from './templates/VestingPool.sol';
import { Pool } from './templates/Pool.sol';

/**
 * @title AthletePool
 * @dev This smart contract is designed to manage tokens distribution to athletes and clubs.
 *      It combines vesting and scheduled release mechanisms to ensure a controlled
 *      and gradual release of GNZ tokens over time.
 *
 *      - Implements ScheduledReleasePool: Ensures a structured monthly release schedule.
 *      - Implements VestingPool: Supports vesting schedules to lock tokens for a period.
 *      - Allows a designated role to allocate tokens with vesting.
 *      - Provides a method to trigger periodic tokens releases.
 *
 *      This contract is upgradeable using OpenZeppelin's upgradeable contract standard.
 */
contract AthletePool is VestingPool, ScheduledReleasePool {
  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /**
   * @dev Initializes the contract with the token contract address, start time, and duration.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   * @param start_ The start time (timestamp) for the monthly release schedule.
   * @param duration_ The duration (in milliseconds) of the monthly release schedule.
   */
  function initialize(address tokenContract_, uint64 start_, uint64 duration_) public initializer {
    __VestingPool_init(tokenContract_);
    __ScheduledReleasePool_init(tokenContract_, start_, duration_);
  }

  /**
   * @dev Returns the number of tokens currently available for allocation.
   *      The available tokens are calculated as the scheduled released tokens minus
   *      the tokens that are still locked in vesting.
   *
   * @return uint256 The amount of tokens available for immediate distribution.
   */
  function getAvailableTokens() public view override(VestingPool, ScheduledReleasePool) returns (uint256) {
    return ScheduledReleasePool.getAvailableTokens() - VestingPool.getTotalUnreleased();
  }

  /**
   * @dev Allocates a vesting schedule for a beneficiary. The tokens allocated
   *      will be gradually released over a specified period.
   *
   * @notice Only callable by an account with the `POOL_MANAGER_ROLE`.
   *
   * @param _beneficiary The address receiving the allocated tokens.
   * @param _totalAllocation The total amount of tokens allocated for vesting.
   * @param _duration The duration (in milliseconds) of the vesting schedule.
   * @param _cliff The cliff period (in milliseconds) before vesting begins.
   */
  function addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _duration, uint64 _cliff) public onlyRole(POOL_MANAGER_ROLE) {
    _addVesting(_beneficiary, _totalAllocation, uint64(block.timestamp), _duration, _cliff);
  }

  /**
   * @dev Triggers the release of tokens according to the monthly release schedule.
   *      This function moves tokens from the locked state to the available balance.
   *
   * @notice Only callable by an account with the `POOL_PLATFORM_ROLE`.
   */
  function poolRelease() public onlyRole(POOL_PLATFORM_ROLE) {
    _poolRelease();
  }
}
