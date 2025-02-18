// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Pool, MintInstructions } from './Pool.sol';

/**
 * @title VestingPool Abstract Contract
 * @dev This contract manages token vesting by distributing tokens gradually over time.
 * It enforces cliff periods and vesting schedules, controlling when and how recipients
 * can claim their allocated tokens.
 */
abstract contract VestingPool is Pool {
  struct VestingSchedule {
    uint256 totalAllocation;
    uint256 released;
    uint64 start;
    uint64 duration;
  }

  /// @custom:storage-location erc7201:vestingPool.main
  struct VestingPoolStorage {
    mapping(address => VestingSchedule) vestings;
    address[] vestingsAddress;
    uint256 getTotalUnreleased;
  }

  /**
   * @dev Storage location for the vesting pool contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('vestingPool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant VestingPoolStorageLocation = 0x01cac614b2a9a311e6b360e7633f3a18303d726228ce123b6206b00e2f3ecf00;

  function _getVestingPoolStorage() internal pure returns (VestingPoolStorage storage $) {
    assembly {
      $.slot := VestingPoolStorageLocation
    }
  }

  /**
   * @notice Initializes the vesting pool with a specified token contract.
   * @param tokenContract_ The address of the GNZ token contract.
   */
  function __VestingPool_init(address tokenContract_) internal onlyInitializing {
    __Pool_init(tokenContract_);
    _getVestingPoolStorage().getTotalUnreleased = 0;
  }

  /**
   * @notice Adds a new vesting schedule for a beneficiary.
   * @param _beneficiary The recipient of the vested tokens.
   * @param _totalAllocation The total number of tokens allocated.
   * @param _start The start time of the vesting schedule.
   * @param _duration The duration of the vesting period.
   * @param _cliff The cliff period before vesting begins.
   */
  function _addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _start, uint64 _duration, uint64 _cliff) internal {
    VestingPoolStorage storage $ = _getVestingPoolStorage();

    require(_totalAllocation <= getAvailableTokens(), 'Missing token Pool');
    require($.vestings[_beneficiary].totalAllocation == 0, 'Already vested');
    require(_totalAllocation > 0, 'Could not distribute 0 tokens');

    $.getTotalUnreleased += _totalAllocation;
    $.vestingsAddress.push(_beneficiary);
    $.vestings[_beneficiary] = VestingSchedule(_totalAllocation, 0, _start + _cliff, _duration);
  }

  /**
   * @notice Returns the number of tokens available for vesting.
   */
  function getAvailableTokens() public view virtual override returns (uint256) {
    return getReservedTokens() - getTotalUnreleased();
  }

  /**
   * @notice Returns the total amount of tokens that have not been released yet.
   */
  function getTotalUnreleased() public view virtual returns (uint256) {
    return _getVestingPoolStorage().getTotalUnreleased;
  }

  /**
   * @notice Returns the start timestamp of vesting for a beneficiary.
   */
  function start(address _beneficiary) public view virtual returns (uint256) {
    return _getVestingPoolStorage().vestings[_beneficiary].start;
  }

  /**
   * @notice Returns the vesting duration for a beneficiary.
   */
  function duration(address _beneficiary) public view virtual returns (uint256) {
    return _getVestingPoolStorage().vestings[_beneficiary].duration;
  }

  /**
   * @notice Returns the end timestamp of vesting for a beneficiary.
   */
  function end(address _beneficiary) public view virtual returns (uint256) {
    return start(_beneficiary) + duration(_beneficiary);
  }

  /**
   * @notice Returns the amount of tokens already released to a beneficiary.
   */
  function released(address _beneficiary) public view virtual returns (uint256) {
    return _getVestingPoolStorage().vestings[_beneficiary].released;
  }

  /**
   * @notice Returns the amount of vested but unreleased tokens for a beneficiary.
   */
  function releasable(address _beneficiary) public view virtual returns (uint256) {
    return vestedAmount(_beneficiary, uint64(block.timestamp)) - released(_beneficiary);
  }

  /**
   * @dev Getter for the amount of total allocation token.
   */
  function totalAllocation(address _beneficiary) public view virtual returns (uint256) {
    return _getVestingPoolStorage().vestings[_beneficiary].totalAllocation;
  }

  /**
   * @notice Releases vested tokens to the beneficiary.
   * @return success True if the release was successful.
   */
  function releaseMe() public virtual returns (bool success) {
    success = _release(_msgSender());
  }

  /**
   * @notice Releases vested tokens for a specified beneficiary.
   * @param _beneficiary The recipient of the released tokens.
   * @return success True if the release was successful.
   */
  function release(address _beneficiary) public virtual onlyRole(POOL_PLATFORM_ROLE) returns (bool success) {
    success = _release(_beneficiary);
  }

  function _release(address _beneficiary) internal returns (bool success) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();
    VestingSchedule storage beneficiary = $.vestings[_beneficiary];
    uint256 amount = releasable(_beneficiary);
    if (amount > 0) {
      beneficiary.released += amount;
      $.getTotalUnreleased -= amount;
      success = _remoteMint(_beneficiary, amount);
      require(success, 'Failed to mint');
    }
  }

  function _getRangeItemsOfPage(uint16 page) internal view returns (uint256 first, uint256 last) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();
    require(page * MAX_BATCH_SIZE < $.vestingsAddress.length, 'No page found');

    first = page * MAX_BATCH_SIZE;
    if ((page + 1) * MAX_BATCH_SIZE <= $.vestingsAddress.length) {
      last = (page + 1) * MAX_BATCH_SIZE;
    } else {
      last = $.vestingsAddress.length;
    }
  }

  /**
   * @dev Release all the token that have already vested.
   */
  function releaseAll(uint16 page) public virtual onlyRole(POOL_PLATFORM_ROLE) returns (bool success) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();

    (uint256 first, uint256 last) = _getRangeItemsOfPage(page);
    MintInstructions[] memory mintInstructions = new MintInstructions[](last - first);

    uint8 index = 0;
    for (uint256 i = first; i < last; i++) {
      VestingSchedule storage beneficiary = $.vestings[$.vestingsAddress[i]];
      uint256 amount = releasable($.vestingsAddress[i]);
      beneficiary.released += amount;
      $.getTotalUnreleased -= amount;
      mintInstructions[index] = MintInstructions($.vestingsAddress[i], amount);
      index++;
    }

    success = _remoteBatchMint(mintInstructions);
    require(success, 'Failed to mint');
  }

  function isAllReleaseable(uint16 page) public view returns (bool) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();

    (uint256 first, uint256 last) = _getRangeItemsOfPage(page);

    for (uint256 i = first; i < last; i++) {
      uint256 amount = releasable($.vestingsAddress[i]);
      if (amount > 0) {
        return true;
      }
    }
    return false;
  }

  function getPagination() public view virtual returns (uint256) {
    uint256 length = _getVestingPoolStorage().vestingsAddress.length;
    return length / MAX_BATCH_SIZE + (length % MAX_BATCH_SIZE == 0 ? 0 : 1);
  }

  function isCleanable() public view virtual returns (bool) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();
    for (uint256 i = 0; i < $.vestingsAddress.length; i++) {
      if ($.vestings[$.vestingsAddress[i]].totalAllocation == $.vestings[$.vestingsAddress[i]].released) {
        return true;
      }
    }
    return false;
  }

  /*
   * @dev Not required, just remove finished vestings for vestings list to reduce cost of release all
   */
  function cleanReleased() public virtual onlyRole(POOL_PLATFORM_ROLE) returns (bool) {
    VestingPoolStorage storage $ = _getVestingPoolStorage();

    uint256 i = 0;
    while (i < $.vestingsAddress.length) {
      if ($.vestings[$.vestingsAddress[i]].totalAllocation == $.vestings[$.vestingsAddress[i]].released) {
        address last = $.vestingsAddress[$.vestingsAddress.length - 1];
        $.vestingsAddress[i] = last;
        $.vestingsAddress.pop();
        // Not icrement i, need to check new/last value
      } else {
        i++;
      }
    }
    return true;
  }

  /**
   * @notice Returns the amount of tokens that have vested based on a linear vesting schedule.
   * @param _beneficiary The recipient of the vested tokens.
   * @param timestamp The current timestamp.
   */
  function vestedAmount(address _beneficiary, uint64 timestamp) public view virtual returns (uint256) {
    return _vestingSchedule(_beneficiary, timestamp);
  }

  /**
   * @dev Virtual implementation of the vesting formula. Returns the vested amount based on time elapsed.
   */
  function _vestingSchedule(address _beneficiary, uint64 timestamp) internal view virtual returns (uint256) {
    if (timestamp < start(_beneficiary)) {
      return 0;
    } else if (timestamp >= end(_beneficiary)) {
      return totalAllocation(_beneficiary);
    } else {
      return (totalAllocation(_beneficiary) * (timestamp - start(_beneficiary))) / duration(_beneficiary);
    }
  }
}
