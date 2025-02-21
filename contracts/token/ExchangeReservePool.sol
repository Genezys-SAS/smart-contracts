// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { TransferPool } from "./templates/TransferPool.sol";
import { Pool } from "./templates/Pool.sol";

/**
 * @title ExchangeReservePool
 * @dev This contract manages a reserved supply of tokens for exchange listings
 *      and liquidity pool management. It extends the TransferPool contract,
 *      allowing tokens to be minted and transferred directly to designated
 *      recipients as needed. This ensures that a portion of the token supply
 *      is always available for exchange-related operations.
 *
 *      - Implements TransferPool: Enables direct tokens transfers upon minting.
 *      - Manages liquidity and exchange reserves for market operations.
 *      - Provides an initialization function for setting the associated token contract.
 *
 *      This contract is upgradeable using OpenZeppelin's upgradeable contract standard.
 */
contract ExchangeReservePool is TransferPool {
  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /**
   * @dev Initializes the contract with the specified token contract.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   */
  function initialize(address tokenContract_) public initializer {
    __TransferPool_init(tokenContract_);
  }
}
