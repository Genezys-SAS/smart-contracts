// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { VestingPool } from './templates/VestingPool.sol';
import { Pool } from './templates/Pool.sol';

/**
 * @title TeamPool
 * @dev This contract is designed to manage the allocation of 300,000,000 GNZ tokens
 *      for Genezys team incentives. Instead of immediate token distribution, this
 *      contract enforces a structured vesting schedule, ensuring that tokens remain
 *      locked and are gradually released over time.
 *
 *      - Implements VestingPool: Ensures team tokens follow a cliff period and vesting duration.
 *      - Uses a dedicated storage structure for cliff and duration settings.
 *      - Allows the `POOL_MANAGER_ROLE` to allocate vesting schedules to team members.
 *
 *      This contract is upgradeable using OpenZeppelin’s upgradeable contract standard.
 */
contract TeamPool is VestingPool {
  /// @custom:storage-location erc7201:teamPool.main
  struct TeamPoolStorage {
    uint64 cliff;
    uint64 duration;
  }

  /**
   * @dev Storage location for the team pool contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('teamPool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant TeamPoolStorageLocation = 0x99df105f0928319205c75379239c4909fdc9148c942a837e07ae8a6fd92f8b00;

  /**
   * @dev Internal function to retrieve the storage struct containing
   *      the vesting parameters for the team pool.
   *
   * @return $ TeamPoolStorage The storage struct containing cliff and duration values.
   */
  function _getTeamStorage() internal pure returns (TeamPoolStorage storage $) {
    assembly {
      $.slot := TeamPoolStorageLocation
    }
  }

  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /**
   * @dev Initializes the contract with the token contract address, cliff period, and vesting duration.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   * @param cliff_ The cliff period (in milliseconds) before vesting starts.
   * @param duration_ The total duration (in milliseconds) of the vesting period.
   */
  function initialize(address tokenContract_, uint64 cliff_, uint64 duration_) public initializer {
    __VestingPool_init(tokenContract_);
    TeamPoolStorage storage $ = _getTeamStorage();
    $.cliff = cliff_;
    $.duration = duration_;
  }

  /**
   * @dev Allocates a vesting schedule for a team member.
   *      The allocated tokens will follow the configured vesting schedule.
   *
   * @notice Only callable by an account with the `POOL_MANAGER_ROLE`.
   *
   * @param _beneficiary The address receiving the allocated tokens.
   * @param _totalAllocation The total amount of tokens allocated for vesting.
   */
  function addVesting(address _beneficiary, uint256 _totalAllocation) public onlyRole(POOL_MANAGER_ROLE) {
    TeamPoolStorage storage $ = _getTeamStorage();
    _addVesting(_beneficiary, _totalAllocation, uint64(block.timestamp), $.duration, $.cliff);
  }
}
