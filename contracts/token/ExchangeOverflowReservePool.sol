// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { ERC2771ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

contract ExchangeOverflowReservePool is AccessControlUpgradeable, ERC2771ContextUpgradeable {
  /// @custom:storage-location erc7201:exchangeOverflowReservePool.main
  struct OverflowPoolStorage {
    address tokenContract;
  }

  /**
   * @dev Storage location for the token contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('exchangeOverflowReservePool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant OverflowPoolStorageLocation = 0xc0e3473abb0f8aa743a6a0a6b25dc474792d3d77ac789ddb13cfb19a0f549400;

  function _getOverflowPoolStorage() private pure returns (OverflowPoolStorage storage $) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      $.slot := OverflowPoolStorageLocation
    }
  }

  /// @notice Role for the manager of the pool allowing them to transfer the pool tokens
  bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) ERC2771ContextUpgradeable(forwarder) {}

  function initialize(address tokenContract_) public initializer {
    __AccessControl_init();

    // Setup roles
    _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _grantRole(MANAGER_ROLE, _msgSender());

    OverflowPoolStorage storage $ = _getOverflowPoolStorage();
    $.tokenContract = tokenContract_;
  }

  /**
   * @dev Returns the GNZ token contract address
   */
  function getTokenContract() public view returns (address) {
    return _getOverflowPoolStorage().tokenContract;
  }

  /**
   * @dev Returns the current token balance of this pool
   */
  function getBalance() public view returns (uint256) {
    return IERC20(getTokenContract()).balanceOf(address(this));
  }

  /**
   * @dev Transfer tokens to a specified address
   * @param to The address to transfer tokens to
   * @param amount The amount of tokens to transfer
   */
  function transferToken(address to, uint256 amount) public onlyRole(MANAGER_ROLE) {
    require(to != address(0), InvalidInput("address"));
    require(amount > 0, InvalidInput("amount"));
    require(amount <= getBalance(), MissingTokens());

    bool success = IERC20(getTokenContract()).transfer(to, amount);
    require(success, TransferToken());
  }

  /**
   * @dev Required override to pick ERC2771Context implementation
   */
  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ERC2771ContextUpgradeable._msgSender();
  }

  /**
   * @dev Required override to pick ERC2771Context implementation
   */
  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ERC2771ContextUpgradeable._msgData();
  }

  /**
   * @dev Required override to pick ERC2771Context implementation
   */
  function _contextSuffixLength() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
    return ERC2771ContextUpgradeable._contextSuffixLength();
  }

  error MintFailed();
  error TransferToken();
  error MissingTokens();
  error InvalidInput(string);
}
