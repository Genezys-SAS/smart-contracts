// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Pool } from "./Pool.sol";

/**
 * @title TransferPool Abstract Contract
 * @dev This contract extends the Pool contract, allowing tokens to be minted and immediately transferred
 * to a specified recipient. Unlike standard pools that reserve and distribute tokens over time,
 * the TransferPool is designed for immediate token transfers while still enforcing allocation limits.
 */
abstract contract TransferPool is Pool {
  function __TransferPool_init(address tokenContract_) internal onlyInitializing {
    __Pool_init(tokenContract_);
  }

  /**
   * @notice Mints tokens and transfers them directly to a specified recipient.
   * @dev Ensures that the requested amount does not exceed the available allocation.
   * @param to The recipient address for the minted tokens.
   * @param amount The number of tokens to mint and transfer.
   */
  function transfer(address to, uint256 amount) public onlyRole(POOL_MANAGER_ROLE) {
    require(amount <= getAvailableTokens(), MissingTokens());

    _remoteMint(to, amount);
  }
}
