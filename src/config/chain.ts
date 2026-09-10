import { baseSepolia, hardhat, sepolia } from "wagmi/chains";

/**
 * Single source for the deployment target. Kept free of side effects so the
 * providers and hooks can import it without pulling in AppKit setup.
 *
 * EXPO_PUBLIC_CHAIN_ID picks the chain:
 *   31337    — the local Hardhat node, for development on this machine
 *   11155111 — Ethereum Sepolia, for builds installed on a real phone
 *   anything else, including unset — Base Sepolia, the deployment target
 *
 * A distributed build must not select 31337: Hardhat's RPC is
 * http://127.0.0.1:8545, which on someone else's phone means their phone, and
 * Android release builds block cleartext HTTP anyway.
 */
const CHAIN_ID = process.env.EXPO_PUBLIC_CHAIN_ID;

const isLocal = CHAIN_ID === "31337";
const isSepolia = CHAIN_ID === "11155111";

export const appChain = isLocal ? hardhat : isSepolia ? sepolia : baseSepolia;

export const CHAIN_NAME = isLocal
  ? "Hardhat (local)"
  : isSepolia
    ? "Sepolia"
    : "Base Sepolia";

export const EXPLORER_BASE = isLocal
  ? ""
  : isSepolia
    ? "https://sepolia.etherscan.io"
    : "https://sepolia.basescan.org";

/** Local chains have no block explorer, so callers must not render a link. */
export const HAS_EXPLORER = !isLocal;
