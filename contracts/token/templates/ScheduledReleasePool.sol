// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Pool, MintInstructions } from './Pool.sol';

/**
 * @title ScheduledReleasePool Abstract Contract
 * @dev This contract gradually releases tokens over a fixed vesting period, following a monthly schedule.
 * Instead of making all tokens immediately available, tokens are released in portions over time.
 * This prevents large, immediate withdrawals and enforces a controlled distribution schedule.
 */
abstract contract ScheduledReleasePool is Pool {
  /// @custom:storage-location erc7201:monthlyReleasePool.main
  struct ScheduledReleasePoolStorage {
    uint64 start;
    uint64 duration;
    uint256 released;
  }

  /**
   * @dev Storage location for the monthly release pool contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('monthlyReleasePool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant ScheduledReleasePoolStorageLocation = 0xadf138f4d15d0770eed348171f34ea63ca3799a2f2de6bf7adfaf498cb834000;

  function _getScheduledReleasePoolStorage() internal pure returns (ScheduledReleasePoolStorage storage $) {
    assembly {
      $.slot := ScheduledReleasePoolStorageLocation
    }
  }

  /**
   * @notice Initializes the monthly release pool with a token contract, start date, and duration.
   * @param tokenContract_ The address of the GNZ token contract.
   * @param start_ The timestamp when the vesting starts.
   * @param duration_ The total duration of the vesting period.
   */
  function __ScheduledReleasePool_init(address tokenContract_, uint64 start_, uint64 duration_) internal onlyInitializing {
    ScheduledReleasePoolStorage storage $ = _getScheduledReleasePoolStorage();
    __Pool_init(tokenContract_);
    $.start = start_;
    $.duration = duration_;
    $.released = 0;
  }

  /**
   * @notice Returns the total number of tokens released so far.
   */
  function poolReleased() public view virtual returns (uint256) {
    return _getScheduledReleasePoolStorage().released;
  }

  /**
   * @notice Returns the start time of the vesting schedule.
   */
  function poolStart() public view virtual returns (uint256) {
    return _getScheduledReleasePoolStorage().start;
  }

  /**
   * @notice Returns the end time of the vesting schedule.
   */
  function poolEnd() public view virtual returns (uint256) {
    return poolStart() + poolDuration();
  }

  /**
   * @notice Returns the duration of the vesting period.
   */
  function poolDuration() public view virtual returns (uint256) {
    return _getScheduledReleasePoolStorage().duration;
  }

  /**
   * @notice Returns the number of tokens available for release.
   */
  function getAvailableTokens() public view virtual override returns (uint256) {
    return poolReleased() - getDistributedTokens();
  }

  /**
   * @notice Returns the number of tokens that are eligible for release based on the schedule.
   */
  function poolReleasable() public view virtual returns (uint256) {
    return poolVestedAmount(uint64(block.timestamp)) - poolReleased();
  }

  /**
   * @notice Releases the available tokens based on the vesting schedule.
   */
  function _poolRelease() internal {
    _getScheduledReleasePoolStorage().released += poolReleasable();
  }

  /**
   * @notice Forces the release of a specified amount of tokens before they are fully vested.
   * @param amount The amount of tokens to be forcefully released.
   */
  function _poolForceRelease(uint256 amount) internal {
    require(getTotalAllocation() - poolReleased() >= amount, 'Missing token in pool');
    _getScheduledReleasePoolStorage().released += amount;
  }

  /**
   * @notice Returns the number of tokens vested based on the vesting schedule.
   * @param timestamp The current timestamp.
   */
  function poolVestedAmount(uint64 timestamp) public view virtual returns (uint256) {
    return _poolVestingSchedule(timestamp);
  }

  /**
   * @dev Implements the vesting formula, determining how many tokens have vested over time.
   * @param timestamp The current timestamp.
   */
  function _poolVestingSchedule(uint64 timestamp) internal view virtual returns (uint256) {
    if (timestamp < poolStart()) {
      return 0;
    } else if (timestamp >= poolEnd()) {
      return getTotalAllocation();
    } else {
      return (getTotalAllocation() * (timestamp - poolStart())) / poolDuration();
    }
  }
}
