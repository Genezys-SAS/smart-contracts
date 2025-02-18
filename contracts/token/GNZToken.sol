// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title GNZ Token Smart Contract
 * @dev This contract implements an upgradeable ERC20 token with capped supply and pool-based minting capabilities.
 * It allows specific smart contract pools to register and reserve a portion of the token supply,
 * which can later be minted in a controlled manner. The contract is designed to be secure, upgradeable,
 * and compliant with OpenZeppelin standards.
 */
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { ContextUpgradeable } from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import { ERC2771ContextUpgradeable } from '@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol';

import { IPool } from './interfaces/IPool.sol';
import { IToken } from './interfaces/IToken.sol';
import { MintInstructions } from './interfaces/MintInstructions.sol';

struct Pool {
  address pool;
  uint256 reservedTokens;
  uint256 mintedTokens;
}

contract GNZToken is ERC20Upgradeable, ERC20CappedUpgradeable, AccessControlUpgradeable, ERC2771ContextUpgradeable, IToken {
  // Don't change the order of the declaration
  uint16 public constant MAX_BATCH_SIZE = 100;

  /// @notice Role for the registered pool allowing them to mint and transfer their allocation
  bytes32 public constant POOL_ROLE = keccak256('POOL_ROLE');

  /// @custom:storage-location erc7201:gnztoken.main
  struct TokenStorage {
    mapping(address => Pool) pools;
    uint256 totalAllocatedTokens;
  }

  /**
   * @dev Storage location for the token contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('gnztoken.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant TokenStorageLocation = 0x0e2385ab6c223b07bb59e216ad8a8d80666689837fc52b28b56abcfa9954e000;

  function _getTokenStorage() private pure returns (TokenStorage storage $) {
    assembly {
      $.slot := TokenStorageLocation
    }
  }

  /// @notice Constructor for setting the trusted forwarder for meta-transactions.
  /// @dev The contract is upgradeable, so a constructor is not used for initialization.
  // Do not use constructor because is unsafe, except for ERC2771ContextUpgradeable that need constructor even if is upgradable contract
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) ERC2771ContextUpgradeable(forwarder) {}

  /**
   * @notice Initializes the token contract with a name, ticker, and maximum supply.
   * @dev Grants the deployer the admin role and sets the total allocated tokens to zero.
   * @param tokenName The name of the token.
   * @param tokenTicker The symbol of the token.
   * @param tokenSupply The maximum supply of the token (in whole units, scaled by decimals).
   */
  function initialize(string memory tokenName, string memory tokenTicker, uint256 tokenSupply) public initializer {
    __ERC20_init(tokenName, tokenTicker);
    __ERC20Capped_init(tokenSupply * 10 ** decimals());
    __AccessControl_init();

    // Grant the admin role to the wallet deploying the contract
    _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

    // Initialize the total allocated token
    _getTokenStorage().totalAllocatedTokens = 0;
  }

  function _update(address from, address to, uint256 value) internal virtual override(ERC20Upgradeable, ERC20CappedUpgradeable) {
    super._update(from, to, value);
  }

  /**
   * @notice Mints tokens to a specified address, ensuring the caller has enough reserved tokens.
   * @param to The recipient of the minted tokens.
   * @param amount The number of tokens to mint.
   * @return success True if minting was successful.
   */
  function mint(address to, uint256 amount) public onlyRole(POOL_ROLE) returns (bool success) {
    TokenStorage storage $ = _getTokenStorage();
    if (amount > 0) {
      require($.pools[_msgSender()].reservedTokens >= amount, 'Insufficient reserved tokens');

      $.pools[_msgSender()].reservedTokens -= amount;
      $.pools[_msgSender()].mintedTokens += amount;

      _mint(to, amount);
    }

    success = true;
  }

  /**
   * @notice Batch mints tokens based on an array of MintInstructions.
   * @param mintInstructions Array of minting instructions containing recipient addresses and amounts.
   * @return success True if batch minting was successful.
   */
  function batchMint(MintInstructions[] memory mintInstructions) public onlyRole(POOL_ROLE) returns (bool success) {
    TokenStorage storage $ = _getTokenStorage();
    require(mintInstructions.length > 0, 'No mint instructions to process');
    require(mintInstructions.length <= MAX_BATCH_SIZE, 'Batch size too large');

    uint256 totalAmount = 0;
    for (uint256 i = 0; i < mintInstructions.length; i++) {
      totalAmount += mintInstructions[i].amount;
    }
    require($.pools[_msgSender()].reservedTokens >= totalAmount, 'Insufficient reserved tokens');

    $.pools[_msgSender()].reservedTokens -= totalAmount;
    $.pools[_msgSender()].mintedTokens += totalAmount;

    for (uint256 i = 0; i < mintInstructions.length; i++) {
      _mint(mintInstructions[i].to, mintInstructions[i].amount);
    }

    success = true;
  }

  /**
   * @notice Registers a pool and allocates a portion of the token supply.
   * @param pool The address of the pool contract.
   * @param amount The number of tokens allocated to the pool.
   */
  function registerPool(address pool, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
    TokenStorage storage $ = _getTokenStorage();
    require(!isValidPool(pool), 'Pool already registered');
    require(cap() - $.totalAllocatedTokens >= amount, 'Insufficient token supply');

    $.pools[pool].pool = pool;
    _grantRole(POOL_ROLE, pool);

    $.pools[pool].mintedTokens = 0;
    $.pools[pool].reservedTokens = amount;
    $.totalAllocatedTokens += amount;

    bool success = IPool(pool).addTokenAllocation(amount);
    require(success, 'Token allocation failed');
  }

  /**
   * @notice Transfers token allocation from one pool to another.
   * @param to The recipient pool address.
   * @param amount The number of tokens to transfer.
   * @return success True if transfer was successful.
   */
  function transferAllocation(address to, uint256 amount) public onlyRole(POOL_ROLE) returns (bool success) {
    TokenStorage storage $ = _getTokenStorage();
    require(isValidPool(to), 'Invalid recipient address');
    require($.pools[_msgSender()].pool != $.pools[to].pool, 'Cannot transfer to the same pool');
    require($.pools[_msgSender()].reservedTokens >= amount, 'Cannot transfer more than reserved');

    $.pools[_msgSender()].reservedTokens -= amount;
    $.pools[to].reservedTokens += amount;

    success = IPool(to).addTokenAllocation(amount);
    require(success, 'Token allocation transfer failed');
  }

  /**
   * @notice Checks if a given address is a registered pool.
   * @param pool The address to check.
   * @return True if the address corresponds to a registered pool, otherwise false.
   */
  function isValidPool(address pool) public view returns (bool) {
    return _getTokenStorage().pools[pool].pool != address(0);
  }

  /**
   * @notice Retrieves pool information for a given address.
   * @param pool The address of the pool.
   * @return Pool struct containing the pool's details.
   */
  function getPool(address pool) public view returns (Pool memory) {
    return _getTokenStorage().pools[pool];
  }

  /**
   * @notice Returns the total amount of tokens allocated across all pools.
   * @return The total allocated token amount.
   */
  function getTotalAllocatedTokens() public view returns (uint256) {
    return _getTokenStorage().totalAllocatedTokens;
  }

  // To choose the good parent inheritance function, and choose ERC2771ContextUpgradeable
  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ERC2771ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ERC2771ContextUpgradeable._msgData();
  }

  function _contextSuffixLength() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
    return ERC2771ContextUpgradeable._contextSuffixLength();
  }
}
