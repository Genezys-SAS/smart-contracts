// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { ERC2771ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { IPool } from "../interfaces/IPool.sol";
import { IToken } from "../interfaces/IToken.sol";
import { MintInstructions } from "../interfaces/MintInstructions.sol";

/**
 * @title Pool Abstract Contract
 * @dev This abstract contract defines the structure and core functionalities for a pool smart contract
 * that interacts with the GNZ Token contract. It includes methods for token allocation, minting, and transfers.
 */
abstract contract Pool is ERC2771ContextUpgradeable, AccessControlUpgradeable, IPool {
  uint16 public constant MAX_BATCH_SIZE = 100;

  /// @custom:storage-location erc7201:pool.main
  struct PoolStorage {
    uint256 reservedTokens;
    uint256 distributedTokens;
    address tokenContract;
  }

  /**
   * @dev Storage location for the pool contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('pool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant PoolStorageLocation = 0x7dcbc62ebc188fd22ac87cc31fd73ccee1ef02b1f9292e0907c4d69cb4b7c800;

  function _getPoolStorage() internal pure returns (PoolStorage storage $) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      $.slot := PoolStorageLocation
    }
  }

  /// @notice Role for manual pool operations like minting and transfers
  bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
  /// @notice Role for automated pool operations like scheduled releases
  bytes32 public constant POOL_PLATFORM_ROLE = keccak256("POOL_PLATFORM_ROLE");

  // Do not use constructor because is unsafe, except for ERC2771ContextUpgradeable that need constructor even if is upgradable contract
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) ERC2771ContextUpgradeable(forwarder) {}

  /**
   * @notice Initializes the pool contract with a specified token contract address.
   * @param tokenContract_ The address of the GNZ token contract.
   */
  function __Pool_init(address tokenContract_) internal onlyInitializing {
    __AccessControl_init();

    _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

    PoolStorage storage $ = _getPoolStorage();
    $.reservedTokens = 0;
    $.distributedTokens = 0;
    $.tokenContract = tokenContract_;
  }

  /**
   * @notice Adds a specified amount of tokens to the pool's reserved allocation.
   * @param reservedAmount_ The number of tokens to allocate.
   * @return success True if allocation was successful.
   */
  function addTokenAllocation(uint256 reservedAmount_) external returns (bool success) {
    PoolStorage storage $ = _getPoolStorage();
    require(_msgSender() == $.tokenContract, InvalidInput("Only contract can call this"));
    $.reservedTokens += reservedAmount_;
    success = true;
  }

  /**
   * @notice Returns the GNZ token contract address
   */
  function getTokenContract() public view returns (address) {
    return _getPoolStorage().tokenContract;
  }

  /**
   * @notice Returns the total number of tokens that have been distributed.
   */
  function getDistributedTokens() public view returns (uint256) {
    return _getPoolStorage().distributedTokens;
  }

  /**
   * @notice Returns the total number of tokens currently reserved in the pool.
   */
  function getReservedTokens() public view returns (uint256) {
    return _getPoolStorage().reservedTokens;
  }

  /**
   * @notice Returns the total allocation of the pool (distributed + reserved tokens).
   */
  function getTotalAllocation() public view returns (uint256) {
    return getDistributedTokens() + getReservedTokens();
  }

  /**
   * @notice Returns the number of tokens available for minting.
   */
  function getAvailableTokens() public view virtual returns (uint256) {
    return getReservedTokens();
  }

  /**
   * @notice Mints tokens to a recipient address, ensuring enough tokens are reserved.
   * @param to The recipient address.
   * @param amount The number of tokens to mint.
   * @return success True if minting was successful.
   */
  function _remoteMint(address to, uint256 amount) internal returns (bool success) {
    PoolStorage storage $ = _getPoolStorage();
    require(to != address(0), InvalidInput("to"));
    require(amount > 0, InvalidInput("amount"));
    require(amount <= $.reservedTokens, MissingTokens());

    $.reservedTokens -= amount;
    $.distributedTokens += amount;

    success = IToken($.tokenContract).mint(to, amount);
    require(success, MintFailed());
  }

  /**
   * @notice Performs batch minting based on an array of MintInstructions.
   * @param mintInstructions An array containing recipient addresses and minting amounts.
   * @return success True if batch minting was successful.
   */
  function _remoteBatchMint(MintInstructions[] memory mintInstructions) internal returns (bool success) {
    PoolStorage storage $ = _getPoolStorage();
    require(mintInstructions.length > 0, InvalidInput("Size empty"));
    require(mintInstructions.length <= MAX_BATCH_SIZE, InvalidInput("Size too large"));

    uint256 totalAmount = 0;
    for (uint256 i = 0; i < mintInstructions.length; i++) {
      totalAmount += mintInstructions[i].amount;
      require(mintInstructions[i].to != address(0), InvalidInput("address"));
    }
    require(totalAmount <= $.reservedTokens, MissingTokens());

    $.reservedTokens -= totalAmount;
    $.distributedTokens += totalAmount;

    success = IToken($.tokenContract).batchMint(mintInstructions);
    require(success, MintFailed());
  }

  /**
   * @notice Transfers the remaining token allocation to another pool.
   * @param to The recipient pool address.
   * @param amount The number of tokens to transfer.
   */
  function _transferRemainingAllocation(address to, uint256 amount) internal {
    PoolStorage storage $ = _getPoolStorage();
    require($.reservedTokens >= amount, MissingTokens());

    $.reservedTokens -= amount;

    bool success = IToken($.tokenContract).transferAllocation(to, amount);
    require(success, TransferRemainingAllocationFailed());
  }

  // ===== ERC2771ContextUpgradeable =====
  // Choose the correct parent inheritance function, and ERC2771ContextUpgradeable
  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ERC2771ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ERC2771ContextUpgradeable._msgData();
  }

  function _contextSuffixLength() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
    return ERC2771ContextUpgradeable._contextSuffixLength();
  }

  error MintFailed();
  error TransferRemainingAllocationFailed();
  error MissingTokens();
  error InvalidInput(string);
}
