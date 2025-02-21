// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { ERC2771ForwarderUpgradeable } from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ForwarderUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Forwarder is ERC2771ForwarderUpgradeable, OwnableUpgradeable {
  error ForwarderUseNonceFailed(uint256 currentNonce, uint256 nonce);

  function initialize(string memory name) public virtual override initializer {
    __ERC2771Forwarder_init(name);
    __Ownable_init(_msgSender());
  }

  function useNonce(address receiver, uint256 nonce) public onlyOwner {
    uint256 currentNonce = _useNonce(receiver);
    if (currentNonce != nonce) {
      revert ForwarderUseNonceFailed(currentNonce, nonce);
    }
  }
}
