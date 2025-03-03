// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Pool, MintInstructions } from "./templates/Pool.sol";

/**
 * @title CommunityPool
 * @dev This smart contract is designed to manage tokens distribution to the community
 */
contract CommunityPool is Pool {
  string public constant POOL_NAME = "CommunityPool";

  /*
   * The number of DECIMALS used for ratio
   */
  uint16 public constant RATIO_DECIMALS = 6;

  /**
   * @dev Constructor function. Since this contract is upgradeable,
   *      logic should be initialized via `initialize()` instead of the constructor.
   *
   * @param forwarder Address used for meta-transactions.
   */
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) Pool(forwarder) {}

  /// @custom:storage-location erc7201:communityPool.main
  struct CommunityPoolStorage {
    uint256 released;
    uint256 baseTotal;
  }

  /**
   * @dev Storage location for the community contract
   *      Calculated using keccak256(abi.encode(uint256(keccak256('communityPool.main')) - 1)) & ~bytes32(uint256(0xff));
   */
  bytes32 private constant CommunityPoolStorageLocation = 0x93e7338085e4785aa6d0cd18f3bc69c8746f5c47ea92d8b755e5ebbc0adb8900;

  function _getCommunityPoolStorage() private pure returns (CommunityPoolStorage storage $) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      $.slot := CommunityPoolStorageLocation
    }
  }

  /**
   * @dev Initializes the contract with the token contract address, start time, and duration.
   *      This function is called during the deployment of the transparent proxy
   *
   * @param tokenContract_ The address of the GNZ token contract.
   * @param baseTotal_ The base total, use to calcul how many token we will release.
   */
  function initialize(
    address tokenContract_,
    address adminAddr_,
    address managerAddr_,
    address platformAddr_,
    uint256 baseTotal_
  ) public initializer {
    __Pool_init(tokenContract_, adminAddr_, managerAddr_, platformAddr_);
    _getCommunityPoolStorage().baseTotal = baseTotal_;
    _getCommunityPoolStorage().released = 0;
  }

  event PoolReleaseEvent(uint256 amount, uint64 date);

  /**
   * @notice Returns the total number of tokens released so far.
   */
  function poolReleased() public view virtual returns (uint256) {
    return _getCommunityPoolStorage().released;
  }

  /**
   * @dev Returns the number of tokens currently available for allocation.
   *      This function overrides the base pool’s logic to ensure that
   *      available tokens are calculated correctly based on the monthly release schedule.
   *
   * @return uint256 The amount of tokens available for immediate distribution.
   */
  function getAvailableTokens() public view override returns (uint256) {
    return poolReleased() - getDistributedTokens();
  }

  function baseTotal() public view returns (uint256) {
    return _getCommunityPoolStorage().baseTotal;
  }

  function setBaseTotal(uint256 baseTotal_) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _getCommunityPoolStorage().baseTotal = baseTotal_;
  }

  /**
   * @notice Triggers the release of tokens using the ratios
   *      This function moves tokens from the locked state to the available balance.
   * @param fancardRatio The fancard ratio (in uint with RATIO_DECIMALS).
   * @param userActivityRatio The user activities ratio (in uint with RATIO_DECIMALS).
   * @param pointsRatio The points ratio (in uint with RATIO_DECIMALS).
   * @param priceRatio The price ratio (in uint with RATIO_DECIMALS).
   */
  function poolRelease(
    uint256 fancardRatio,
    uint256 userActivityRatio,
    uint256 pointsRatio,
    uint256 priceRatio
  ) public onlyRole(POOL_PLATFORM_ROLE) {
    uint256 total = (fancardRatio * userActivityRatio * pointsRatio * priceRatio * baseTotal()) / (10 ** (RATIO_DECIMALS * 4));

    require(getTotalAllocation() - poolReleased() >= total, MissingTokens());

    _getCommunityPoolStorage().released += total;

    emit PoolReleaseEvent(total, uint64(block.timestamp));
  }

  /**
   * @notice Batch Mints tokens and transfers them directly to a specified recipient.
   * @dev Ensures that the requested amount does not exceed the available allocation.
   * @param mintInstructions The list of recipient address and tokens to be minted for each.
   */
  function batchTransfer(MintInstructions[] memory mintInstructions) public onlyRole(POOL_PLATFORM_ROLE) {
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < mintInstructions.length; i++) {
      totalAmount += mintInstructions[i].amount;
      require(mintInstructions[i].to != address(0), InvalidInput("address"));
    }
    require(totalAmount <= getAvailableTokens(), MissingTokens());

    _remoteBatchMint(mintInstructions);
  }
}
