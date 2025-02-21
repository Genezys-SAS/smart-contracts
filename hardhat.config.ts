import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades'; // For hardhat upgrade
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-solhint';

// If not found use default wallet of localnet, but is recommanded to use this own key. Not work outside localnet
const wallet = process.env.BASE_WALLET_KEY || '';
const basescanApiKey = process.env.BASESCAN_API_KEY as string;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.27',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // Connect to blokchain
  networks: {
    // for mainnet
    'base-mainnet': {
      url: 'https://mainnet.base.org',
      accounts: [wallet],
      gasPrice: 1000000000,
    },
    // for testnet
    'base-sepolia': {
      url: 'https://sepolia.base.org',
      accounts: [wallet],
      gasPrice: 1000000000,
    },
    // for local dev environment
    'base-local': {
      url: 'http://localhost:8545',
      accounts: [wallet],
      gasPrice: 1000000000,
    },
  },
  // Connect to api
  etherscan: {
    apiKey: {
      // Need valid api key in in mainet, not use quota, https://basescan.org/myapikey
      'base-sepolia': basescanApiKey,
    },
    customChains: [
      {
        network: 'base-sepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
  defaultNetwork: 'hardhat',
};

export default config;
