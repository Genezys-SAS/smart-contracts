# GNZ Token Smart Contracts Documentation

**Version 0.1**

## Table of Contents

- [References](#references)
- [Smart Contracts Overview](#smart-contracts-overview)
- [Deploying a “Pool” Smart Contract](#deploying-a-pool-smart-contract)
- [Abstract Contracts](#abstract-contracts)
  - [Transfer Pool](#transfer-pool)
  - [Vesting Pool](#vesting-pool)
  - [Scheduled Release Pool](#scheduled-release-pool)
- [Smart Contracts](#smart-contracts)
  - [GNZ Token Smart Contract](#gnz-token-smart-contract)
  - [Exchange Reserve Smart Contract](#exchange-reserve-smart-contract)
  - [Team Pool Smart Contract](#team-pool-smart-contract)
  - [Private Sales Pool Smart Contract](#private-sales-pool-smart-contract)
  - [Public Sales Pool Smart Contract](#public-sales-pool-smart-contract)
  - [Athlete Pool Smart Contract](#athlete-pool-smart-contract)
  - [Partner Program Smart Contract](#partner-program-smart-contract)
  - [Core Contract Functions](#core-contract-functions)
  - [Treasury Pool Smart Contract](#treasury-pool-smart-contract)
  - [Exchange Overflow Reserve Pool Smart Contract](#exchange-overflow-reserve-pool-smart-contract)

---

## References

[1] [Genezys Whitepaper EN](https://drive.google.com/file/d/1XRfD-IRZeeT6TiWrexoPaxznUViS4E-K/view), [Genezys Whitepaper FR](https://drive.google.com/file/d/1cmPq3lGXLCfqAidsZTBjVqawda9gzrRl/view)

[2] [Open Zeppelin ERC20 Documentation](https://docs.openzeppelin.com/contracts/4.x/erc20)

[3] [Open Zeppelin Smart Contracts](https://docs.openzeppelin.com/contracts/4.x/)

[4] [Writing Upgradable Contracts with Open Zeppelin](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)

[5] [Access Control with Open Zeppelin](https://docs.openzeppelin.com/contracts/3.x/access-control)


## Smart Contracts Overview

A set of smart contracts have been developed to implement the tokenomics outlined in the Genezys whitepaper [1].

The maximum total supply of the GNZ token is: **6,000,000,000 (six billion)**

The following smart contracts have been developed:

- **GNZ Token smart contract**: This is an upgradeable, and secure implementation of an ERC20 [2] token with pool-based minting capabilities. It introduces functionalities that allow specific smart contract pools to register and reserve a portion of the total token supply. These pools can later mint the reserved tokens, enabling controlled token distribution.

A set of **"Pool" smart contracts** that can register to the GNZ Token Smart Contract and reserve a partition of the GNZ token supply. These are:

- **Private Sales Pool smart contract (4.24%)**: This contract is used to provide GNZ tokens to be sold during a set of private sales phases. The contract implements a cliff and vesting period that are gradually released to investors, preventing large sell-offs and maintaining token stability.

- **Public Sales Pool smart contract (3.65%)**: This contract is used to provide GNZ tokens to be sold during launchpad and IEO sales phases. With no enforced cliff or vesting periods, it ensures immediate token allocation. Vesting schedules are managed by the exchange and launchpad partners.

- **Community Pool smart contract (45.00%)**: This contract manages the GNZ tokens allocated for rewarding the Genezys community. The gamification of the platform is structured to reward the active community on the platform with a monthly distribution of GNZ tokens. The total amount of GNZ tokens to be distributed each month is defined in advance. The methodology ensures that the distribution of $GNZ token rewards is both equitable and adaptive, encouraging participation and ongoing user engagement, while supporting the long-term stability and growth of the $GNZ token economy.

- **Athlete Pool smart contract (12.00%)**: This contract provides a reserved pool of GNZ tokens that can be distributed to athletes and clubs that contribute to the Genezys ecosystem. By implementing a gradual monthly minting process, it ensures a steady release of tokens over 60 months.

- **Partner Program smart contract (3.00%)**: This contract provides a reserved pool of GNZ tokens that can be distributed to partners and ambassadors that help the Genezys ecosystem. By implementing a gradual monthly minting process, it ensures a steady release of tokens over 30 months.

- **Exchange Reserve Pool smart contract (15.11%)**: This contract manages tokens reserved for listing the GNZ token on new exchanges or to increase liquidity pools on existing exchanges.

- **Treasury Pool smart contract (12.00%)**: This contract manages reserved GNZ tokens for operational activities. By implementing a gradual monthly minting process, it ensures a steady release of tokens over 60 months, preventing market oversupply while maintaining liquidity for business operations, marketing, legal, and platform expenses.

- **Team Pool smart contract (5.00%)**: This contract provides a reserved pool of GNZ tokens that can be distributed to the Genezys team as part of an incentives program within the company. The entire pool is immediately available for the incentive program, however, a cliff and vesting schedule is enforced when tokens are allocated to an employee.

- **Exchange Overflow Pool smart contract**: This contract serves as a flexible and efficient repository for unallocated and unsold GNZ tokens from the private and public sales process. By collecting tokens from various sources, it ensures that surplus tokens remain available for future sales directly from the Genezys platform.

All of the smart contracts have been developed using OpenZepplin’s [3] smart contract framework. The following contracts have been used:

- `ERC20Upgradeable` [4]: This contract provides a standard template for creating upgradeable ERC-20 tokens, meaning the token's functionality can be improved over time without breaking existing deployments.
- `ERC20CappedUpgradeable` [4]: This is an extension of `ERC20Upgradeable` that adds a maximum supply cap, ensuring that no more tokens can be minted beyond a set limit.
- `AccessControlUpgradeable` [5]: This contract allows developers to defi ne different roles and permissions for users, making it easy to manage administrative functions such as minting, pausing, or upgrading smart contracts.
- `ERC2771ContextUpgradeable` [4]: This contract enables meta-transactions, which allow users to perform actions on the blockchain without directly paying gas fees, by using a trusted relayer to submit transactions on their behalf.

## Deploying a “Pool” Smart Contract

A Pool smart contract is a key component of the GNZ token ecosystem. It acts as a digital escrow system that reserves, tracks, and distributes GNZ tokens. It ensures that tokens are properly allocated and securely minted when needed, with built-in checks and permissions to prevent misuse.

### **Registration Process**
When a new Pool contract is deployed, it includes the address of the GNZ Token smart contract. During deployment, the `registerPool()` function is called to register the new Pool contract’s address within the GNZ Token smart contract. This function also specifies the amount of tokens to be reserved for the Pool contract.

After registration, the GNZ Token smart contract invokes `addTokenAllocation()` to allocate the reserved tokens to the Pool smart contract.

### **Other Main Features of Pool Smart Contracts**
1. **Managing Reserved and Distributed Tokens**:
   - **Reserved Tokens**: These are tokens that have been allocated for future distribution but haven’t been sent out yet.
   - **Distributed Tokens**: These are tokens that have already been sent out to users.
   - The total allocation is simply the sum of these two amounts.

2. **Allocating More Tokens**:
   - For certain pools, the contract allows the GNZ Token smart contract to increase the reserved amount. This means that more GNZ tokens can be assigned to the Pool for distribution.

3. **Minting New Tokens**:
   - When it's time to distribute tokens, the Pool mints new tokens directly to recipients.
   - The Pool also supports **batch minting**, which allows multiple recipients to receive tokens in one transaction.

   It ensures that:
   - The recipient is valid (not a zero address).
   - The requested amount does not exceed the reserved amount.
   - The minting process succeeds.

4. **Transferring Unused Tokens**:
   - For certain pool types (for example, **Private and Public Sales Pools**), if the Pool doesn’t use all its reserved tokens, it can transfer the remaining allocation to another address. This helps in reallocating unused tokens efficiently.

5. **Role-Based Access Control**:
   - Only certain roles (like the `POOL_MANAGER_ROLE`) have the authority to modify allocations and manage distributions. This ensures security and prevents unauthorized access.

Any smart contract wishing to be a pool implements the **Pool contract**.

---

## Abstract Contracts

In addition to the Pool contract, other abstract contracts have been developed to implement common themes.

### **Transfer Pool**
The Transfer Pool is a specialized type of **Pool Smart Contract** that allows tokens to be minted and directly transferred to a specified recipient. Unlike standard pools that may reserve and distribute tokens over time, the Transfer Pool is designed for immediate token transfers while still enforcing allocation limits.

- When a `POOL_MANAGER_ROLE` authorized user requests a transfer, the contract ensures that the requested amount does not exceed the available token balance.
- Once verified, it **mints the tokens and sends them** to the specified recipient in a single transaction.
- This makes the Transfer Pool **ideal for on-demand token distribution**, such as payouts, rewards, or other immediate transfers within the GNZ ecosystem.

By inheriting from the base **Pool contract**, the `TransferPool` retains all core functionalities like tracking reserved and distributed tokens while adding the ability to transfer tokens instantly.

---

### **Vesting Pool**
The Vesting Pool Smart Contract is a specialized version of a Pool Smart Contract, designed to manage token vesting. This means it ensures that tokens are distributed gradually over time, rather than all at once. It enforces cliff periods and vesting schedules to control when and how recipients can claim their allocated tokens.

- A cliff period ensures that recipients wait a set period before receiving any tokens.
- Tokens are then vested linearly over the total vesting duration.
- Beneficiaries can manually claim their vested tokens, while platform administrators have the authority to release tokens on behalf of multiple users at once.
- To enhance efficiency, the contract processes vesting releases in batches, reducing gas costs.

Once a beneficiary has received their full token allocation, their vesting schedule is removed from the system to keep it optimized.

The Vesting Pool works in the following way:

1. **Allocating Tokens for Vesting**:
   - When tokens are assigned to a beneficiary, they are not immediately available.
   - Instead, a **vesting schedule** is created, which includes:
     - **Total Allocation** – The total amount of tokens assigned.
     - **Cliff Period** – The initial waiting period before any tokens are released.
     - **Start Time** – When the vesting period begins.
     - **Vesting Duration** – The total time over which the tokens will be released.
   - The contract ensures that the **total allocated tokens do not exceed the available pool**.

2. **Tracking Vesting Schedules**:
   - Each beneficiary has a vesting schedule stored in the contract.
   - The contract keeps track of:
     - How many tokens have been released so far.
     - How many tokens are still locked and not yet claimable.
     - How many tokens are available for release at any given time.

3. **Releasing Tokens Over Time**:
   - Tokens are released gradually according to a linear vesting schedule.
   - If a beneficiary tries to claim their tokens before the cliff period, they receive zero tokens.
   - After the cliff, tokens start becoming available proportionally over time** until the vesting period ends.
   - Beneficiaries can manually claim their vested tokens, or an admin can release tokens for multiple beneficiaries in a batch.

4. **Batch Processing for Efficiency**:
   - To optimize gas costs, the contract allows processing vesting releases in batches.
   - Instead of releasing tokens for all beneficiaries at once, it processes them in groups of 100 (max batch size).

5. **Handling Fully Released Allocations**:
   - Once a beneficiary has received all their vested tokens, their schedule is removed from the system.
   - The contract includes a function to clean up completed vesting schedules, keeping it efficient.

6. **Security & Permissions**:
   - Only users with the `POOL_PLATFORM_ROLE` can manually trigger batch releases.
   - Beneficiaries can only claim their own vested tokens.

### **Scheduled Release Pool**

The **Scheduled Release Pool** is a specialized smart contract designed to gradually release tokens over a fixed vesting period, following a 30-day schedule. Instead of making all tokens immediately available, this contract ensures that tokens are released in portions over time.

When the contract is initialized, it sets a start date and a vesting duration.
The total allocated tokens are then released in a linear fashion, meaning that each month a portion of the tokens becomes available for use.
This prevents large, immediate withdrawals and enforces a controlled distribution schedule.

The contract keeps track of how many tokens have been released so far, ensuring that no more than the intended amount is accessed at any given time. Beneficiaries or authorized roles can check how many tokens are currently releasable based on the passage of time. Additionally, there is a function that allows for a forced release of tokens, which can be useful if an administrator needs to unlock additional tokens under specific conditions.

By using this structure, the **Scheduled Release Pool** ensures a predictable, transparent, and gradual token distribution process**, making it ideal for scenarios like Vesting schedules, controlled liquidity releases and long-term incentive programs.

## Smart Contracts

### **GNZ Token Smart Contract**

The **GNZ Token Smart Contract** is an ERC-20 utility token based on OpenZeppelin's upgradeable contract framework. It introduces functionalities that allow other smart contracts (known as “Pools”) to register and reserve a portion of the total token supply. These smart contracts can later mint the reserved tokens, enabling controlled token distribution.

The total max supply of GNZ tokens will be **6,000,000,000** (six billion tokens).

This contract plays a crucial role in managing the GNZ ecosystem while preventing unauthorized token minting.

#### **Key Features**

The GNZ Token Smart Contract follows the **ERC-20 standard** for token functionality, leveraging OpenZeppelin's `ERC20Upgradeable`. The **maximum token supply** is capped at **6 billion GNZ tokens** through the use of `ERC20CappedUpgradeable`, ensuring that tokens can only be minted up to this predefined limit. This contract is designed with an upgradeable architecture, utilizing OpenZeppelin's framework to enable future upgrades without redeploying the contract. Instead of constructors, it employs an `initialize` function for setting up initial parameters.

For security and permission management, the contract uses `AccessControlUpgradeable`, allowing for role-based access control. The deployer is assigned the `DEFAULT_ADMIN_ROLE`, granting administrative privileges. Additionally, smart contract pools that register for token allocation receive the `POOL_ROLE`, which restricts them to minting only their reserved tokens.

The contract includes a minting mechanism that ensures only pools with the `POOL_ROLE` can mint tokens. Minting can be done in two ways:

- **Single minting** : where a pool mints tokens for a single address GNZ Token
- **Batch minting** : enabling pools to distribute tokens to multiple addresses in a single transaction. Batch minting is limited to a maximum batch size of 100 to optimize efficiency and security.

Additionally, pools have the ability to transfer portions of their reserved token allocations to other registered pools. This ensures flexibility in managing token distribution across various pools while maintaining strict control over token supply. The recipient must be a valid registered pool to receive transferred allocations.

To enhance security and efficiency, the contract integrates `ERC2771ContextUpgradeable`, which enables meta-transactions. This reduces gas costs and improves transaction handling.

The `_msgSender()` function is overridden to ensure proper context handling for transactions.

#### Summary of Key Features

- Implements the ERC20 standard with OpenZeppelin’s `ERC20Upgradeable`.
- Enforces a maximum supply of 6 billion GNZ tokens via `ERC20CappedUpgradeable`.
- Uses `AccessControlUpgradeable` for role-based permissions, granting `DEFAULT_ADMIN_ROLE` to the deployer and `POOL_ROLE` to registered pools.
- Allows smart contract pools to be registered and allocate the correct amount of reserved tokens to them. The tokens are allocated via the `addTokenAllocation()` method as part of the registration process.
- Supports single and batch minting (up to 100 transactions in a batch) for efficient token distribution.
- Enables token allocation transfers between registered pools for flexible distribution.
- Integrates `ERC2771ContextUpgradeable` to support meta-transactions.

### Core Contract Functions

`
initialize()
`

- Initializes the contract with a token name, symbol, and max supply.
- Grants the deployer admin privileges (`DEFAULT_ADMIN_ROLE`).

`
registerPool(address pool, uint256 amount)
`

- Registers a smart contract pool and sets its reserved token amount.
- Allocates the tokens required to the pool determined by amount
- Ensures that the total allocated tokens do not exceed the capped supply.
- Grants `POOL_ROLE` to the pool.

`
mint(address to, uint256 amount)
`

- Allows a pool with `POOL_ROLE` to mint tokens.
- Ensures the pool does not exceed its reserved allocation.

`
batchMint(MintInstructions[] memory mintInstructions)
`

- Enables a pool to mint tokens in bulk (up to 100 recipients in one transaction).
- Ensures the pool has enough reserved tokens for the total mint amount.

`
transferAllocation(address to, uint256 amount)
`

- Allows a pool to transfer part of its reserved allocation to another pool.
- Ensures the recipient is a valid registered pool.

`
isValidPool(address pool) → bool
`

- Returns true if the provided address is a registered pool.

`
getPool(address pool) → Pool
`

- Returns details about a specific pool, including its reserved and minted tokens.

`
getTotalAllocatedTokens() → uint256
`

- Returns the total number of tokens allocated across all registered pools.

## Exchange Reserve Smart Contract

The **Exchange Reserve** smart contract is a specialized Pool contract designed to manage a reserved supply of **906,600,000 GNZ tokens** for exchange listings and liquidity pool management.

The tokens are **reserved but not yet minted**, allowing controlled issuance as required for liquidity, staking, or expansion to new exchanges.

### Key Features

- The **Exchange Reserve** contract is built upon the `Pool` and `TransferPool` frameworks, which provide functionalities for reserving and managing GNZ tokens in a controlled and efficient manner. Instead of minting all tokens upfront, the contract ensures that tokens remain reserved and are only minted when needed. This mechanism allows precise control over liquidity deployment across various exchanges and staking mechanisms.
- The contract enforces strict role-based access control, meaning that only addresses with the `POOL_MANAGER_ROLE` can initiate minting transactions. This prevents unauthorized minting and ensures that only pre-approved entities can allocate tokens for exchange liquidity and staking.

In addition to single-token minting, the contract supports batch minting, allowing multiple minting transactions to be executed in one go. This improves efficiency for large-scale distributions, particularly when onboarding new exchanges or setting up liquidity pools.

A transfer mechanism is also included to enable the movement of reserved tokens to external smart contracts deployed on Exchanges. Transfers will be used to support new exchange listings or to increase liquidity on current listings. This ensures flexibility in allocation, allowing the company to distribute tokens across various exchanges and staking platforms as required.

#### Summary of Key Features

- **Token Reservation & Controlled Minting**: Tokens remain reserved and are only minted when needed for exchange liquidity or staking.
- **Role-Based Access Control**: Only entities with the `POOL_MANAGER_ROLE` can mint and allocate tokens.
- **Batch and Single Minting**: The contract supports both individual and batch minting operations for efficient distribution.
- **Token Transfer Mechanism**: Reserved tokens can be transferred between pools within the GNZ ecosystem to optimize allocation.
- **Meta-Transaction Support**: Utilizes `ERC2771ContextUpgradeable` to support meta-transactions.
- **Upgradeable Architecture**: The contract is structured for future upgrades while ensuring robust security measures.

### Core Contract Components

#### Exchange Reserve Smart Contract 

- Extends the `TransferPool` contract to inherit token transfer and minting functionalities.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract.
- Ensures that token allocation and minting adhere to strict control mechanisms.

#### Pool Contract (`Pool`)

- The foundational contract for managing reserved token pools.
- Implements token reservation, distribution tracking, and role-based access control.
- Restricts minting operations to ensure tokens are only issued from pre-reserved allocations.
- Stores pool-specific data such as `reservedTokens`, `distributedTokens`, and the `tokenContract` address.
- Implements a secure minting mechanism that interacts with the GNZ Token contract.

#### TransferPool Contract (`TransferPool`)

- Extends `Pool` and introduces additional minting and transfer functionalities.
- Implements `transfer()`, allowing authorized entities to mint tokens for a beneficiary.
- Restricts execution of token minting to addresses with the `POOL_MANAGER_ROLE`.

### Core Contract Functions

`
initialize(address tokenContract_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Ensures proper setup of inherited contract functionalities.

`
transfer(address to, uint256 amount)
`

- Allows authorized users (with `POOL_MANAGER_ROLE`) to mint tokens and transfer them to an address in a single transaction.
- Ensures that the requested mint amount does not exceed the available reserved token supply.

`
_remoteMint(address to, uint256 amount)
`

- Internal function to securely mint tokens.
- Ensures tokens are only minted from the pre-allocated reserves.
- Interacts with the GNZ Token contract to execute the minting process.

`
_remoteBatchMint(MintInstructions[] memory mintInstructions)
`

- Enables batch minting of tokens to multiple recipients in a single transaction (up to a max batch size of 100).
- Ensures minting does not exceed reserved allocations.
- Improves efficiency for large-scale token distributions.

`
_transferRemainingAllocation(address to, uint256 amount)
`

- Transfers unused reserved tokens to another pool in the GNZ ecosystem.
- Ensures that the recipient is a valid, registered pool.

`
addTokenAllocation(uint256 reservedAmount_)
`

- Updates the reserved token allocation.
- Ensures that only the GNZ Token contract can call this function.

`
getReservedTokens() → uint256
`

- Returns the total number of reserved tokens available for minting.

`
getDistributedTokens() → uint256
`

- Returns the total number of tokens that have already been minted and distributed.

`
getTotalAllocation() → uint256
`

- Returns the sum of reserved tokens and distributed tokens.

### Security & Access Control

- **Only authorized roles can mint tokens**: The `POOL_MANAGER_ROLE` is required for executing mint operations.
- **Meta-Transaction Support**: The contract uses `ERC2771ContextUpgradeable` to support meta-transactions.
- **Strict Token Allocation Control**: Tokens cannot be minted beyond the reserved allocation, ensuring secure supply management.
- **Upgradeable & Secure Storage**: Uses a structured storage pattern to facilitate future upgrades while maintaining contract security.

## Team Pool Smart Contract

The **Team Pool** smart contract is designed to manage the allocation of **300,000,000 GNZ tokens** for Genezys team incentives. Instead of distributing tokens immediately, the contract follows a vesting schedule, ensuring that tokens are locked and gradually unlocked over time.

Each team member added to the pool will have their tokens vested based on the following schedule:

- **Cliff Period**: 12 months
- **Vesting Duration**: 36 months

The tokens are not immediately minted; instead, they remain reserved and are only released according to the vesting schedule. The contract extends functionalities from the `VestingPool` and `Pool` contracts. The contract ensures that tokens are gradually released, preventing immediate liquidation and aligning incentives with long-term company growth.

### Key Features

The Team Pool contract is built upon the `VestingPool` and `Pool` abstract contracts, which provide mechanisms for reserving, vesting, and distributing GNZ tokens in a structured manner. Instead of immediately distributing tokens, this contract ensures that tokens are gradually released to team members over a set period.

To enforce structured token distribution, the contract implements role-based access control, where only addresses with the `POOL_MANAGER_ROLE` can add new team members and assign token allocations. Once a team member is added, their tokens are subject to a 12-month cliff period before any unlocking occurs, after which tokens vest over 36 months.

The contract includes a vesting schedule tracking system, ensuring that each beneficiary's vesting schedule is uniquely recorded. Beneficiaries can check their total allocation, tokens released so far, and remaining vested tokens.

Additionally, the contract supports batch processing of token releases, allowing multiple vesting schedules to be updated in a single transaction. This increases efficiency, especially when handling a large number of beneficiaries.

#### Summary of Key Features

- **Cliff and Vesting Schedule**: Tokens are locked for 12 months, then gradually released over 36 months.
- **Role-Based Access Control**: Only addresses with `POOL_MANAGER_ROLE` can add beneficiaries.
- **Gradual Token Release**: Ensures structured and controlled distribution of GNZ tokens.
- **Batch Processing Support**: Allows multiple vesting releases in a single transaction.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` for future enhancements.

### Core Contract Components

#### Team Pool Smart Contract (`TeamPool`)

- Extends the `VestingPool` contract to inherit vesting and release functionalities.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract and vesting parameters.
- Manages individual vesting schedules for team members.

#### VestingPool Contract (`VestingPool`)

- Implements vesting schedules, token release tracking, and role-based access control.
- Stores vesting-specific data, including total allocation, tokens released, start time, and vesting duration.
- Ensures tokens are only released according to the vesting timeline.

#### Pool Contract (`Pool`)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions 

`
initialize(address tokenContract_, uint64 cliff_, uint64 duration_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets the cliff period and vesting duration for all beneficiaries.

`
addVesting(address _beneficiary, uint256 _totalAllocation)
`

- Assigns a vesting schedule to a team member.
- Ensures the total allocation does not exceed the available reserved tokens.
- Does not allow the same beneficiary to be added multiple times.

`
releaseMe()
`

- Allows a beneficiary to release their vested tokens that are currently available.
- Ensures tokens are only released according to the vesting schedule.

`
release(address _beneficiary)
`

- Allows an administrator to release vested tokens for a specific beneficiary.
- Ensures that only vested amounts are transferred.

`
releaseAll(uint16 page)
`

- Releases all vested tokens for a batch of beneficiaries.
- Increases efficiency when handling multiple team members at once.

`
totalAllocation(address _beneficiary) → uint256
`

- Returns the total number of GNZ tokens allocated to a specific beneficiary.

`
released(address _beneficiary) → uint256
`

- Returns the number of tokens already released to a beneficiary.

`
releasable(address _beneficiary) → uint256
`

- Returns the number of tokens that can be released at the current timestamp.

`
vestedAmount(address _beneficiary, uint64 timestamp) → uint256
`

- Calculates how many tokens a beneficiary has vested up to a given timestamp.


### Security & Access Control

- **Only authorized roles can add vesting schedules**: The `POOL_MANAGER_ROLE` is required to assign new vesting schedules.
- **Cliff & Vesting Enforced**: The contract enforces a strict 12-month cliff and 36-month vesting period to prevent early withdrawals.
- **Batch Processing for Efficiency**: Allows multiple vesting schedules to be processed in a single transaction.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.

## Private Sales Pool Smart Contract

The **Private Sales Pool** smart contract is designed to manage the allocation of **254,400,000 GNZ tokens** for pre-IEO and TGE token sales. This pool allows investors to purchase GNZ tokens before the official token generation event (TGE), with a structured cliff and vesting schedule ensuring a gradual token release over time.

Each investor added to the pool will have their tokens vested based on the following schedule:

- **Cliff Period**: 12 months (no tokens released during this period).
- **Vesting Period**: 20 months (tokens are unlocked in equal portions each month after the cliff period).

The tokens are reserved but not immediately minted, ensuring that they are only issued according to the vesting schedule. The contract extends functionalities from `VestingPool` and `Pool`.

### Key Features

The Private Sales Pool contract is built on top of the `VestingPool` abstract contract, which provides mechanisms for reserving, vesting, and distributing GNZ tokens. Instead of allowing immediate distribution, this contract ensures that tokens are gradually unlocked each month over a 20-month vesting period following a 12-month cliff.

To maintain structured token sales and distribution, the contract enforces role-based access control using `POOL_MANAGER_ROLE`. Only authorized accounts can add new investors and assign token allocations. The vesting schedule is applied separately for each investor, ensuring that each allocation follows the correct vesting timeline.

The contract also implements a vesting schedule tracking system, allowing beneficiaries to check their total allocation, tokens released so far, and remaining vested tokens. Additionally, it includes a contract closure function, enabling the transfer of any remaining allocation to another address upon completion of the private sales phase.

The Private Sales Pool contract is also upgradeable via `ERC2771ContextUpgradeable`.

#### Summary of Key Features

- **Cliff and Vesting Schedule**: 12-month cliff followed by a 20-month vesting period with monthly (every 30 days) unlocks.
- **Role-Based Access Control**: Only `POOL_MANAGER_ROLE` accounts can add investors and assign vesting schedules.
- **Gradual Token Release**: Ensures structured token distribution over time.
- **Contract Closure Mechanism**: Allows remaining unallocated tokens to be transferred at the end of the vesting process.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` to support future contract enhancements.

### Core Contract Components

#### Private Sales Pool Smart Contract (`PrivateSalesPool`)

- Extends the `VestingPool` contract to inherit vesting and release functionalities.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract and vesting parameters.
- Manages individual vesting schedules for investors.

#### VestingPool Contract (`VestingPool`)

- Implements vesting schedules, token release tracking, and role-based access control.
- Stores vesting-specific data, including total allocation, tokens released, start time, and vesting duration.
- Ensures tokens are only released according to the vesting timeline.

#### Pool Contract (`Pool`)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions

`
initialize(address tokenContract_, uint64 cliff_, uint64 duration_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets the cliff period and vesting duration for all beneficiaries.

`
addVesting(address _beneficiary, uint256 _totalAllocation)
`

- Assigns a vesting schedule to an investor.
- Ensures that the total allocation does not exceed the available reserved tokens.

`
releaseMe()
`

- Allows a beneficiary to release their vested tokens that are currently available.
- Ensures tokens are only released according to the vesting schedule.

`
release(address _beneficiary)
`

- Allows an administrator to release vested tokens for a specific beneficiary.
- Ensures that only vested amounts are transferred.

`
releaseAll(uint16 page)
`

- Releases all vested tokens for a batch of investors.
- Increases efficiency when handling multiple beneficiaries at once.

`
totalAllocation(address _beneficiary) → uint256
`

- Returns the total number of GNZ tokens allocated to a specific investor.

`
released(address _beneficiary) → uint256
`

- Returns the number of tokens already released to an investor.

`
releasable(address _beneficiary) → uint256
`

- Returns the number of tokens that can be released at the current timestamp.

`
vestedAmount(address _beneficiary, uint64 timestamp) → uint256
`

- Calculates how many tokens a beneficiary has vested up to a given timestamp.

`
close(address to)
`

- Transfers any remaining unallocated tokens to a specified address.
- Used when the private sale phase is complete to manage leftover allocations.

### Security & Access Control

- **Only authorized roles can add vesting schedules**: The `POOL_MANAGER_ROLE` is required to assign new vesting schedules.
- **Cliff & Vesting Enforced**: The contract enforces a strict 12-month cliff and 20-month vesting period with monthly (every 30 days) unlocks.
- **Batch Processing for Efficiency**: Allows multiple vesting schedules to be processed in a single transaction.
- **Contract Closure Mechanism**: Ensures leftover tokens can be reallocated at the end of the private sale phase.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades. GNZ Token

## Public Sales Pool Smart Contract

The **Public Sales Pool** smart contract is responsible for managing the allocation of **219,000,000 GNZ tokens** designated for public sales via IEOs and partner launchpads prior to the Token Generation Event (TGE). Unlike other pools, this contract does not enforce a cliff or vesting period because these conditions are determined and managed by the exchanges or launchpads based on pre-agreed terms with the Genezys team.

This contract facilitates the secure distribution of GNZ tokens to investors through public sales and ensures that all tokens allocated to the public sale pool are managed in a structured and controlled manner.

### Key Features

The Public Sales Pool contract is built on the `TransferPool` and `VestingPool` frameworks, combining functionalities that allow token transfers and optional vesting, even though vesting is not required in this particular case.

This contract allows instant allocation and distribution of GNZ tokens, with public sale allocations being assigned directly to buyers through partner exchanges and launchpads. While the contract includes vesting functionalities inherited from `VestingPool`, they are not actively utilized unless specified by an exchange or launchpad.

The contract is fully controlled through role-based access, ensuring that only authorized accounts with the `POOL_MANAGER_ROLE` can allocate tokens, while administrators with the `DEFAULT_ADMIN_ROLE` can close the contract and transfer any remaining unallocated tokens.

The contract also includes a closure mechanism, which allows any remaining unallocated tokens to be transferred to another address once public sales are complete (see Overflow Smart Contract).

#### Summary of Key Features

- **No Cliff or Vesting Required**: Vesting, if applicable, is managed externally by exchanges or launchpads.
- **Immediate Token Allocation**: Tokens can be allocated and transferred directly to investors as per pre-agreed terms.
- **Role-Based Access Control**: Only `POOL_MANAGER_ROLE` accounts can allocate tokens, and `DEFAULT_ADMIN_ROLE` can close the contract.
- **Contract Closure Mechanism**: Allows transfer of any remaining unallocated tokens after the public sale phase is complete.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` to support future contract enhancements.

### Core Contract Components

#### Public Sales Pool Smart Contract (`PublicSalesPool`)

- Extends the `TransferPool` contract for secure token transfers.
- Inherits from `VestingPool`, but does not enforce vesting.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract.
- Ensures authorized allocation and contract closure functionalities.

#### TransferPool Contract (`TransferPool`)

- Extends `Pool` and introduces minting and token transfer functionalities.
- Implements `transfer()`, allowing authorized entities to mint tokens and transfer them in a single step.
- Restricts execution of token minting to addresses with the `POOL_MANAGER_ROLE`.

#### VestingPool Contract (`VestingPool`)

- Implements vesting schedules, token release tracking, and role-based access control.
- Though this contract inherits from `VestingPool`, its vesting functionalities are not actively used in this case.

#### Pool Contract (`Pool`)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions

`
initialize(address tokenContract_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets up the transfer and vesting functionalities (vesting is optional in this pool).

`
getAvailableTokens() → uint256
`

- Returns the total number of GNZ tokens available for public sales.
- Overrides functions from both `Pool` and `VestingPool`, ensuring consistency.

`
addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _releaseDate)
`

- Assigns a vesting schedule to a beneficiary if required by an exchange or launchpad.
- Uses a zero cliff and zero duration, allowing tokens to be accessed immediately.
- This function is optional and would only be used if a specific launchpad requests vesting within this contract.

`
close(address to)
`

- Transfers any remaining unallocated tokens to a specified address.
- Used when the public sale phase is complete to manage leftover allocations.

### Security & Access Control

- **Only authorized roles can allocate tokens**: The `POOL_MANAGER_ROLE` is required for assigning allocations.
- **No Cliff or Vesting**: Tokens are immediately available upon allocation unless vesting is requested by an exchange or launchpad.
- **Contract Closure Mechanism**: Ensures remaining unallocated tokens can be transferred at the end of the public sale phase.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.

## Athlete Pool Smart Contract

The **Athlete Pool** smart contract is designed to manage the allocation of **720,000,000 GNZ tokens** for compensating athletes and clubs at the discretion of Genezys. This pool follows a structured monthly (every 30 days) release schedule, ensuring a gradual distribution of tokens into an available balance before being distributed to athletes, clubs, or other designated recipients.

The vesting and release schedule for the Athlete Pool consists of two key stages:

1. **Scheduled Token Release**: Each month, 0.2% of the total allocation is minted over a period of 60 months, creating a pool of available tokens.
2. **Token Distribution**: Tokens from the available pool can be allocated to athletes or clubs, and these allocations may have separate vesting and cliff schedules, depending on contractual agreements.

The contract extends functionalities from `VestingPool`, `ScheduledReleasePool` and `Pool`.

### Key Features

The Athlete Pool contract is structured to gradually release tokens over time and then allow for customized vesting schedules when tokens are allocated to beneficiaries. Instead of providing immediate access to the entire allocation, tokens are minted at a fixed rate of 0.2% per month over a total period of 60 months, preventing oversupply and ensuring sustainable distribution.

The contract allows for flexible distribution mechanisms, meaning that once tokens are available, they can be distributed to specific athletes, clubs, or even platform wallets based on the needs of Genezys. Each recipient may also have an additional vesting or cliff period, ensuring customized payouts based on individual agreements.

Role-based access control is strictly enforced, ensuring that only authorized accounts with the `POOL_MANAGER_ROLE` can allocate tokens and that only the `POOL_PLATFORM_ROLE` can trigger the monthly release mechanism.

The contract also includes upgradeable architecture, leveraging `ERC2771ContextUpgradeable` to support potential future improvements.

#### Summary of Key Features

- **Scheduled Token Release**: 0.2% of the total allocation is minted each month for 60 months.
- **Controlled Distribution**: Tokens can be sent to athletes, clubs, or platform wallets based on discretionary allocation.
- **Custom Vesting Schedules**: Each recipient may have a unique vesting and cliff schedule for their allocation.
- **Strict Role-Based Access**: Only authorized roles (`POOL_MANAGER_ROLE` and `POOL_PLATFORM_ROLE`) can manage token allocations and releases.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` to allow for future modifications.

### Core Contract Components

#### Athlete Pool Smart Contract (`AthletePool`)

- Extends `VestingPool` and `ScheduledReleasePool` to inherit both vesting and gradual release functionalities.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract and schedule parameters.
- Ensures controlled minting and structured token allocations.

#### Scheduled Release Pool Contract (`ScheduledReleasePool`)

- Implements a scheduled release mechanism, minting 0.2% of the total allocation each month (every 30 days).
- Ensures that only the designated role (`POOL_PLATFORM_ROLE`) can trigger the minting process.

#### Vesting Pool Contract (`VestingPool`)

- Implements vesting schedules, token release tracking, and role-based access control.
- Allows each recipient to have their own vesting duration and cliff period.

#### Pool Contract (`Pool`)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions

`
initialize(address tokenContract_, uint64 start_, uint64 duration_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets up the start date and duration for the monthly release schedule.

`
getAvailableTokens() → uint256
`

- Returns the total number of GNZ tokens available for allocation.
- Ensures that tokens already allocated through vesting are excluded from the available supply.

`
addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _duration, uint64 _cliff)
`

- Assigns a vesting schedule to an athlete, club, or other recipient.
- Ensures that the total allocation does not exceed the available token balance.

`
poolRelease()
`

- Triggers the scheduled token minting process, increasing the available token pool.
- Ensures that only 0.2% of the total allocation is minted each month.
- Can only be called by accounts with the `POOL_PLATFORM_ROLE`.

### Security & Access Control

- **Only authorized roles can allocate tokens**: The `POOL_MANAGER_ROLE` is required to assign new vesting schedules.
- **Strict Scheduled Minting**: Only 0.2% per month is minted to maintain sustainable token distribution.
- **Batch Processing for Efficiency**: Allows multiple vesting schedules to be processed in a single transaction.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.

## Partner Program Smart Contract

The **Partner Program** smart contract is designed to manage the allocation of **180,000,000 GNZ tokens** to partners and ambassadors at the discretion of Genezys. This pool ensures a structured and controlled distribution of tokens over time.

The vesting and release schedule for the Partner Program consists of two key stages:

1. **Scheduled Token Release**: Each month, 0.1% of the total allocation is minted over a period of 30 months, creating a pool of available tokens.
2. **Token Distribution**: Once tokens are available, they can be allocated to partners, and these allocations may have separate vesting and cliff schedules based on contractual agreements.

The contract extends functionalities from `VestingPool`, `ScheduledReleasePool` and `Pool`,

### Key Features

The Partner Program contract ensures a gradual and controlled release of tokens, preventing oversupply while allowing Genezys to allocate tokens as needed. Tokens are minted at a fixed rate of 0.1% per month over 30 months, ensuring long-term sustainability.

Once tokens are available, they can be distributed to specific partners, ambassadors, or platform wallets. Each recipient may have a custom vesting schedule and cliff period based on signed agreements with Genezys.

The contract enforces strict role-based access control, ensuring that only authorized accounts with the `POOL_MANAGER_ROLE` can allocate tokens, while the monthly release mechanism can only be triggered by accounts with the `POOL_PLATFORM_ROLE`.

The contract is upgradeable, leveraging `ERC2771ContextUpgradeable`, allowing future improvements.

#### Summary of Key Features

- **Scheduled Token Release**: 0.1% of the total allocation is minted each month for 30 months.
- **Controlled Distribution**: Tokens can be sent to partners or platform wallets based on agreements.
- **Custom Vesting Schedules**: Each recipient may have a unique vesting and cliff schedule.
- **Strict Role-Based Access**: `POOL_MANAGER_ROLE` manages allocations, and `POOL_PLATFORM_ROLE` triggers the monthly minting.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` for future modifications.

### Core Contract Components

#### Partner Program Smart Contract (`PartnerPool`)

- Extends `VestingPool` and `ScheduledReleasePool` to inherit vesting and gradual release functionalities.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract and schedule parameters.
- Ensures controlled minting and structured token allocations.

#### Scheduled Release Pool Contract (`ScheduledReleasePool`)

- Implements a monthly (every 30 days) release mechanism, minting 0.1% of the total allocation each month.
- Ensures that only the designated role (`POOL_PLATFORM_ROLE`) can trigger the minting process.

#### Vesting Pool Contract (`VestingPool`)

- Implements vesting schedules, token release tracking, and role-based access control.
- Allows each recipient to have their own vesting duration and cliff period.

#### Pool Contract (`Pool`)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions

`
initialize(address tokenContract_, uint64 start_, uint64 duration_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets up the start date and duration for the monthly release schedule.

`
getAvailableTokens() → uint256
`

- Returns the total number of GNZ tokens available for allocation.
- Ensures that tokens already allocated through vesting are excluded from the available supply.

`addVesting(address _beneficiary, uint256 _totalAllocation, uint64 _duration, uint64 _cliff)
`

- Assigns a vesting schedule to a partner or ambassador.
- Ensures that the total allocation does not exceed the available token balance.

`
poolRelease()
`

- Triggers the monthly token minting process, increasing the available token pool.
- Ensures that only 0.1% of the total allocation is minted each month.
- Can only be called by accounts with the `POOL_PLATFORM_ROLE`.

### Security & Access Control

- **Only authorized roles can allocate tokens**: The `POOL_MANAGER_ROLE` is required to assign new vesting schedules.
- **Strict Scheduled Minting**: Only 0.1% per month is minted to maintain sustainable token distribution.
- **Batch Processing for Efficiency**: Allows multiple vesting schedules to be processed in a single transaction.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.

## Treasury Pool Smart Contract

The **Treasury Pool** smart contract is designed to manage the allocation of **720,000,000 GNZ tokens** for operational activities within Genezys. This pool provides a structured mechanism for gradually releasing tokens to support various functions, including business development, marketing, legal, and platform operations.

The vesting and release schedule for the Treasury Pool follows:

1. **Scheduled Token Release**: Each month, 0.2% of the total allocation is minted over a period of 60 months, creating a pool of available tokens.
2. **Token Utilization**: Once minted, tokens are available for use in operational expenses or other business-related expenditures as deemed necessary by Genezys.

The contract extends functionalities from `TransferPool`, `ScheduledReleasePool`, and `Pool`.

### Key Features

The **Treasury Pool** contract ensures a gradual and controlled release of tokens, preventing oversupply while maintaining a consistent token supply for operational needs. Tokens are minted at a fixed rate of 0.2% per month over 60 months, ensuring a steady flow of GNZ tokens to cover ongoing business expenses.

Once tokens become available, they can be used for operational activities, including but not limited to:

- Business development initiatives.
- Marketing and promotional expenses.
- Legal and regulatory costs.
- Platform operations and infrastructure.

The contract enforces strict role-based access control, ensuring that only authorized accounts with the `POOL_PLATFORM_ROLE` can trigger the monthly release mechanism, while token transfers and utilization are controlled by other role-based permissions as needed.

The contract is upgradeable, leveraging `ERC2771ContextUpgradeable`, allowing future improvements.

#### Summary of Key Features

- **Scheduled Token Release**: 0.2% of the total allocation is minted each month for 60 months.
- **Operational Flexibility**: Tokens can be used for business development, marketing, legal, and platform operations.
- **Role-Based Access Control**: `POOL_PLATFORM_ROLE` triggers the monthly minting, while other roles manage fund allocations.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` for future modifications.

### Core Contract Components

#### Treasury Pool Smart Contract (TreasuryPool)

- Extends `TransferPool` and `ScheduledReleasePool` to inherit both transfer functionalities and gradual release mechanisms.
- Implements an `initialize` function to set up the contract with the GNZ Token smart contract and schedule parameters.
- Ensures controlled minting and structured token usage.

#### Scheduled Release Pool Contract (ScheduledReleasePool)

- Implements a monthly release mechanism, minting 0.2% of the total allocation each month.
- Ensures that only the designated role (`POOL_PLATFORM_ROLE`) can trigger the minting process.

#### Transfer Pool Contract (TransferPool)

- Provides secure transfer functionalities for distributing tokens as needed.
- Ensures that GNZ tokens can be allocated for business operations in a controlled manner.

#### Pool Contract (Pool)

- Provides foundational functions for managing reserved token pools.
- Implements token reservation, distribution tracking, and secure allocation mechanisms.

### Core Contract Functions

`
initialize(address tokenContract_, uint64 start_, uint64 duration_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Sets up the start date and duration for the monthly release schedule.

`
getAvailableTokens() → uint256
`

- Returns the total number of GNZ tokens available for operational use.

`
poolRelease()
`

- Triggers the monthly token minting process, increasing the available token pool.
- Ensures that only 0.2% of the total allocation is minted each month.
- Can only be called by accounts with the `POOL_PLATFORM_ROLE`.

### Security & Access Control

- **Only authorized roles can manage tokens**: The `POOL_PLATFORM_ROLE` is required to trigger monthly releases.
- **Strict Scheduled Minting**: Only 0.2% per month is minted to maintain sustainable token distribution.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.

## Exchange Overflow Reserve Pool Smart Contract

The **Exchange Overflow Reserve Pool** smart contract is designed to manage unallocated and unsold GNZ tokens from various sources. Unlike other pools, this contract does not have an initial allocation but can receive tokens from:

- Unminted reserved tokens from other smart contracts.
- Already minted but unsold tokens from the Public Sales Pool and Private Sales Pool.
- Unsold tokens from launchpads and IEOs.

Once received, these tokens can be used later to sell directly from the Genezys platform, ensuring efficient token redistribution and liquidity management.

### Key Features

The Exchange Overflow Reserve Pool acts as a flexible reserve for GNZ tokens, allowing the platform to manage surplus tokens effectively. Since tokens are not pre-allocated, the contract serves as a repository for unutilized GNZ tokens, ensuring that they remain available for future sales or strategic distribution.

The contract includes secure token transfer functionalities, allowing authorized entities to transfer tokens to specific addresses when required. These transfers are controlled via role-based access management, ensuring that only authorized users with the `MANAGER_ROLE` can execute token transfers.

Additionally, the contract implements meta-transaction support through `ERC2771ContextUpgradeable`.

#### Summary of Key Features

- **No Initial Token Allocation**: Tokens are received from unsold and unminted allocations.
- **Flexible Redistribution**: Tokens can be later sold directly from the Genezys platform.
- **Controlled Transfers**: Only users with `MANAGER_ROLE` can distribute tokens.
- **Balance Tracking**: Allows retrieval of current token balance.
- **Upgradeable Architecture**: Uses `ERC2771ContextUpgradeable` for future modifications.

### Core Contract Components

#### Exchange Overflow Reserve Pool Smart Contract (`ExchangeOverflowReservePool`)

- Implements token storage, access control, and secure transfer functionalities.
- Ensures that unsold or unminted tokens are collected and made available for future use.
- Provides functions to retrieve token balance and execute transfers securely.

#### ERC20 Token Interface (`IERC20`)

- Standard ERC20 interface for checking token balance and executing transfers.
- Ensures compatibility with GNZ token functionalities.

#### Access Control System (`AccessControlUpgradeable`)

- Implements role-based permissions, allowing only `MANAGER_ROLE` holders to transfer tokens.
- Ensures that unauthorized access is prevented, securing token reserves.

#### Meta-Transaction Support (`ERC2771ContextUpgradeable`)

- Enables gas-efficient meta-transactions, improving the usability of the contract.
- Ensures compatibility with trusted forwarders for executing transactions.

### Core Contract Functions

`
initialize(address tokenContract_)
`

- Initializes the contract and links it to the GNZ Token smart contract.
- Grants `DEFAULT_ADMIN_ROLE` and `MANAGER_ROLE` to the deployer.

`
getTokenContract() → address
`

- Returns the address of the GNZ token contract associated with this pool.

`
getBalance() → uint256
`

- Returns the current GNZ token balance of the contract.

`
transferToken(address to, uint256 amount)
`

- Transfers GNZ tokens to a specified address.
- Ensures the recipient is not a zero address.
- Requires the amount to be greater than zero and less than or equal to the available balance.
- Can only be executed by users with the `MANAGER_ROLE`.

`
_msgSender()
`

- Overrides the standard `_msgSender()` function to support meta-transactions.

`
_msgData()
`

- Overrides `_msgData()` to ensure correct transaction context handling.

`
_contextSuffixLength()
`

- Required override to choose `ERC2771ContextUpgradeable` implementation.

### Security & Access Control

- **Only authorized roles can manage tokens**: The `MANAGER_ROLE` is required to transfer tokens.
- **No Initial Token Supply**: Prevents unnecessary token inflation by only collecting unsold or unminted tokens.
- **Balance Tracking**: Ensures transparency by allowing anyone to check the current token balance.
- **Upgradeable & Secure Storage**: Uses structured storage patterns to facilitate future contract upgrades.
