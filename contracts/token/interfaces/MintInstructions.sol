// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MintInstructions Struct
 * @dev Defines the structure used for minting tokens in batch operations.
 * This struct specifies the recipient address and the amount of tokens to be minted.
 */
struct MintInstructions {
  /**
   * @notice The recipient address that will receive the minted tokens.
   */
  address to;
  /**
   * @notice The amount of tokens to be minted to the recipient.
   */
  uint256 amount;
}
