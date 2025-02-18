// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { VestingPool } from './templates/VestingPool.sol';
import { Pool } from './templates/Pool.sol';

/**
 * @title PrivateSalesPool
 * @dev This contract manages the allocation of GNZ tokens for pre-IEO and
 *      token generation event (TGE) sales. It ensures a structured token release
 *      through a cliff period followed by a vesting schedule. This allows
 *      investors to acquire tokens before the TGE while ensuring that
 *      distributions happen gradually over time to prevent market instability.
 *
 *      - Implements VestingPool: Ensures tokens are released based on a
 *        cliff period and a vesting schedule.
 *      - Defines structured storage for vesting configurations.
 *      - Allows administrators to allocate tokens and eventually close the pool.
 *
 *      This contract is upgradeable using OpenZeppelin’s upgradeable contract standard.
 */
contract PrivateSalesPool is VestingPool {
  /// @custom:storage-location erc7201:privateSalesPool.main
  struct PrivateSalesStorage {
    uint64 cliff;
    uint64 duration;
  }

  /**
   * @dev Storage location for the private sales pool contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('privateSalesPool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant PrivateSalesStorageLocation = 0xc6e6a6754b732ec3d6493ec112f82e526b0cfe84d89d06d0651e4108a1f69a00;

  /**
   * @dev Internal function to retrieve the storage struct containing
   *      the vesting parameters for private sales.
   *
   * @return $ PrivateSalesStorage The storage struct containing cliff and duration values.
   */
  function _getPrivateSalesStorage() internal pure returns (PrivateSalesStorage storage $) {
    assembly {
      $.slot := PrivateSalesStorageLocation
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
    PrivateSalesStorage storage $ = _getPrivateSalesStorage();
    $.cliff = cliff_;
    $.duration = duration_;
  }

  /**
   * @dev Allocates a vesting schedule for a private investor.
   *      The allocated tokens will follow the configured vesting schedule.
   *
   * @notice Only callable by an account with the `POOL_MANAGER_ROLE`.
   *
   * @param _beneficiary The address receiving the allocated tokens.
   * @param _totalAllocation The total amount of tokens allocated for vesting.
   */
  function addVesting(address _beneficiary, uint256 _totalAllocation) public onlyRole(POOL_MANAGER_ROLE) {
    PrivateSalesStorage storage $ = _getPrivateSalesStorage();
    _addVesting(_beneficiary, _totalAllocation, uint64(block.timestamp), $.duration, $.cliff);
  }

  /**
   * @dev Closes the Private Sales Pool and transfers any remaining
   *      unallocated tokens to a specified address.
   *
   * @notice Only callable by an account with the `DEFAULT_ADMIN_ROLE`.
   *
   * @param to The address receiving the remaining unallocated tokens.
   */
  function close(address to) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _transferRemainingAllocation(to, getAvailableTokens());
  }
}
