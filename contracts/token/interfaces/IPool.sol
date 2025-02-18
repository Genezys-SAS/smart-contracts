// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IPool Interface
 * @dev Defines the structure for pool-based minting and allocation within the GNZ Token ecosystem.
 * A pool smart contract can register with the GNZ Token Smart Contract and reserve a portion of the GNZ token supply.
 */
interface IPool {
  /**
   * @notice Adds a specified amount of tokens to the pool's reserved allocation.
   * @param reservedAmount The number of tokens to allocate to the pool.
   * @return success True if the allocation was successful.
   */
  function addTokenAllocation(uint256 reservedAmount) external returns (bool success);

  /**
   * @notice Retrieves the total number of tokens distributed by the pool.
   * @return The number of tokens that have been distributed.
   */
  function getDistributedTokens() external view returns (uint256);

  /**
   * @notice Retrieves the number of tokens currently reserved by the pool.
   * @return The number of reserved tokens.
   */
  function getReservedTokens() external view returns (uint256);
}
