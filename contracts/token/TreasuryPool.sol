// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { TransferPool } from "./templates/TransferPool.sol";
import { ScheduledReleasePool } from "./templates/ScheduledReleasePool.sol";
import { Pool } from "./templates/Pool.sol";

/**
 * @title TreasuryPool
 * @dev This smart contract manages the allocation of 720,000,000 GNZ tokens
 *      for operational activities within Genezys. It follows a structured
 *      release schedule to ensure tokens are gradually made available
 *      for essential business functions such as:
 *
 *      - Business development
 *      - Marketing and community engagement
 *      - Legal and compliance
 *      - Platform operations and maintenance
 *
 *      - Implements TransferPool: Allows direct token transfers upon release.
 *      - Implements ScheduledReleasePool: Ensures tokens are gradually released on a monthly schedule.
 *      - The `POOL_PLATFORM_ROLE` can trigger monthly releases.
 *
 *      This contract is upgradeable using OpenZeppelin’s upgradeable contract standard.
 */
contract TreasuryPool is TransferPool, ScheduledReleasePool {
  string public constant POOL_NAME = "TreasuryPool";

  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /**
   * @dev Initializes the contract with the token contract address,
   *      start time, and duration of the monthly release schedule.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   * @param start_ The start time (timestamp) for the monthly release schedule.
   * @param duration_ The duration (in milliseconds) of the monthly release schedule.
   */
  function initialize(
    address tokenContract_,
    address adminAddr_,
    address managerAddr_,
    address platformAddr_,
    uint64 start_,
    uint64 duration_
  ) public initializer {
    __TransferPool_init(tokenContract_, adminAddr_, managerAddr_, platformAddr_);
    __ScheduledReleasePool_init(tokenContract_, adminAddr_, managerAddr_, platformAddr_, start_, duration_);
  }

  /**
   * @dev Returns the number of tokens currently available for allocation.
   *      This function overrides the base pool’s logic to ensure that
   *      available tokens are calculated correctly based on the monthly release schedule.
   *
   * @return uint256 The amount of tokens available for immediate distribution.
   */
  function getAvailableTokens() public view override(Pool, ScheduledReleasePool) returns (uint256) {
    return ScheduledReleasePool.getAvailableTokens();
  }
}
