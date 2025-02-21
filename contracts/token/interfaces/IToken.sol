// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import { MintInstructions } from "./MintInstructions.sol";

/**
 * @title IToken Interface
 * @dev Defines the minting and allocation transfer functions for the GNZ Token.
 * This interface allows for controlled token distribution through pools registered with the GNZ Token Smart Contract.
 */
interface IToken {
  /**
   * @notice Mints a specified amount of tokens to a given address.
   * @param to The recipient address of the minted tokens.
   * @param amount The number of tokens to mint.
   * @return success True if minting was successful.
   */
  function mint(address to, uint256 amount) external returns (bool success);

  /**
   * @notice Performs batch minting based on an array of MintInstructions.
   * @param mintInstructions An array of instructions containing recipient addresses and amounts.
   * @return success True if batch minting was successful.
   */
  function batchMint(MintInstructions[] memory mintInstructions) external returns (bool success);

  /**
   * @notice Transfers a portion of token allocation from one pool to another.
   * @param to The recipient pool address.
   * @param amount The number of tokens to transfer.
   * @return success True if the allocation transfer was successful.
   */
  function transferAllocation(address to, uint256 amount) external returns (bool success);
}
