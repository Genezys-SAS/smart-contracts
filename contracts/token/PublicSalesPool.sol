// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { TransferPool } from "./templates/TransferPool.sol";
import { VestingPool } from "./templates/VestingPool.sol";
import { Pool } from "./templates/Pool.sol";

/**
 * @title PublicSalesPool
 * @dev This contract is responsible for managing the allocation of GNZ tokens for
 *      public sales through IEOs (Initial Exchange Offerings) and partner launchpads
 *      before the Token Generation Event (TGE).
 *
 *      Unlike private sales or partner pools, this contract does not enforce a cliff
 *      or vesting period, as those conditions are managed externally by the exchanges
 *      and launchpads. Instead, it facilitates a secure and structured token distribution.
 *
 *      - Implements TransferPool: Allows tokens to be directly minted and transferred.
 *      - Implements VestingPool: Provides optional support for vesting schedules,
 *        should they be required by external platforms.
 *      - Ensures that all tokens allocated to public sales are managed securely.
 *
 *      This contract is upgradeable using OpenZeppelin’s upgradeable contract standard.
 */
contract PublicSalesPool is TransferPool, VestingPool {
  string public constant POOL_NAME = "PublicSalesPool";

  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /**
   * @dev Initializes the contract with the token contract address.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   */
  function initialize(address tokenContract_, address adminAddr_, address managerAddr_, address platformAddr_) public initializer {
    __TransferPool_init(tokenContract_, adminAddr_, managerAddr_, platformAddr_);
    __VestingPool_init(tokenContract_, adminAddr_, managerAddr_, platformAddr_);
  }

  /**
   * @dev Returns the number of tokens currently available for allocation.
   *      This function overrides the base pool’s logic to ensure that
   *      available tokens are calculated correctly when vesting is involved.
   *
   * @return uint256 The amount of tokens available for immediate distribution.
   */
  function getAvailableTokens() public view virtual override(Pool, VestingPool) returns (uint256) {
    return VestingPool.getAvailableTokens();
  }

  /**
   * @dev Allocates a vesting schedule for a public sale investor.
   *      While this contract does not enforce a cliff or vesting period,
   *      exchanges or launchpads may require a vesting mechanism. This function
   *      allows setting a release date for token distribution.
   *
   * @notice Only callable by an account with the `POOL_MANAGER_ROLE`.
   *
   * @param _beneficiary The address receiving the allocated tokens.
   * @param _totalAllocation The total amount of tokens allocated for vesting.
   * @param _releaseDate The date when tokens become available for withdrawal.
   */
  function addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _releaseDate) public onlyRole(POOL_MANAGER_ROLE) {
    _addVesting(_beneficiary, _totalAllocation, _releaseDate, 0, 0);
  }

  /**
   * @dev Closes the Public Sales Pool and transfers any remaining
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
