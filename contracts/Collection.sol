// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { ERC721Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import { ERC721URIStorageUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { ContextUpgradeable } from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import { ERC2771ContextUpgradeable } from '@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol';
import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Collection is ERC721URIStorageUpgradeable, OwnableUpgradeable, ERC2771ContextUpgradeable {
  /// @custom:storage-location erc7201:collection.main
  struct MainStorage {
    string baseURI;
    // https://eips.ethereum.org/EIPS/eip-7201
  }

  /*
   * Calculate with function like this
    function getStorage() public pure returns (bytes32) {
      return keccak256(abi.encode(uint256(keccak256('collection.main')) - 1)) & ~bytes32(uint256(0xff));
    }
  */
  bytes32 private constant MAIN_STORAGE_LOCATION = 0xbadcc9e240f39e6a3ec92bb7676afab89e84facafd785fed92f58eace7109e00;

  function _getMainStorage() private pure returns (MainStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  // Do not use constructor because is unsafe, except for ERC2771ContextUpgradeable that need constructor even if is upgradable contract
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address forwarder) ERC2771ContextUpgradeable(forwarder) {}

  function initialize(string memory collectionName, string memory collectionTag, string memory baseURI) public initializer {
    __ERC721_init(collectionName, collectionTag);
    __Ownable_init(_msgSender());
    _getMainStorage().baseURI = baseURI;
  }

  struct CardToMint {
    uint256 number;
    uint8 rarity;
    uint8 cardMetadataIndex;
  }

  function mint(CardToMint[] memory cardsToMint, address receiver) public onlyOwner {
    for (uint8 i = 0; i < cardsToMint.length; i++) {
      _safeMint(receiver, cardsToMint[i].number);
      _setTokenURI(cardsToMint[i].number, _getCardSpecificURI(cardsToMint[i].cardMetadataIndex, cardsToMint[i].rarity));
    }
  }

  function batchSafeTransferFrom(address from, address to, uint256[] calldata tokenIds) external {
    require(to != address(0), 'Cannot transfer to zero address');
    require(tokenIds.length > 0, 'No tokens to transfer');
    require(tokenIds.length <= 100, 'Batch size too large');

    for (uint256 i = 0; i < tokenIds.length; i++) {
      safeTransferFrom(from, to, tokenIds[i]);
    }
  }

  function _getCardSpecificURI(uint8 cardMetadataIndex, uint8 rarity) internal pure returns (string memory) {
    return string.concat(Strings.toString(cardMetadataIndex), '/', Strings.toString(rarity)); // Only store "${cardMetadataIndex}/${rarity}" in nft
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    return string.concat(super.tokenURI(tokenId), '.json');
  }

  function _baseURI() internal view override returns (string memory) {
    MainStorage storage $ = _getMainStorage();
    return $.baseURI;
  }

  function setBaseURI(string memory baseURI) public onlyOwner {
    _getMainStorage().baseURI = baseURI;
  }

  function getBaseURI() public view returns (string memory) {
    return _getMainStorage().baseURI;
  }

  // For choice the good parent inheritance function, and choose ERC2771ContextUpgradeable
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
