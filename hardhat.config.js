require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });

const network = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || "testnet").toLowerCase() === "mainnet"
  ? "mainnet"
  : "testnet";

function envForNetwork(baseKey, selectedNetwork) {
  const suffix = selectedNetwork === "mainnet" ? "MAINNET" : "TESTNET";
  const suffixed = process.env[`${baseKey}_${suffix}`];
  if (suffixed) return suffixed;
  if (selectedNetwork === "mainnet") return "";
  return process.env[baseKey];
}

function deployerAccounts(selectedNetwork) {
  const key = (envForNetwork("DEPLOYER_PRIVATE_KEY", selectedNetwork) || "").trim().replace(/^0x/, "");
  return key ? [key] : [];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monad: {
      url: envForNetwork("MONAD_RPC_URL", network) || (network === "mainnet" ? "https://rpc.monad.xyz" : "https://testnet-rpc.monad.xyz"),
      chainId: Number(envForNetwork("NEXT_PUBLIC_CHAIN_ID", network) || (network === "mainnet" ? "143" : "10143")),
      accounts: deployerAccounts(network),
    },
    monadTestnet: {
      url: envForNetwork("MONAD_RPC_URL", "testnet") || "https://testnet-rpc.monad.xyz",
      chainId: Number(envForNetwork("NEXT_PUBLIC_CHAIN_ID", "testnet") || "10143"),
      accounts: deployerAccounts("testnet"),
    },
    monadMainnet: {
      url: envForNetwork("MONAD_RPC_URL", "mainnet") || "https://rpc.monad.xyz",
      chainId: Number(envForNetwork("NEXT_PUBLIC_CHAIN_ID", "mainnet") || "143"),
      accounts: deployerAccounts("mainnet"),
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "no-api-key-needed",
    customChains: [
      {
        network: "monadMainnet",
        chainId: 143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=143",
          browserURL: "https://monadvision.com",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};
