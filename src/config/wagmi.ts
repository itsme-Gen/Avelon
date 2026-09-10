import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { createAppKit } from "@reown/appkit-react-native";
import type { Storage } from "@reown/appkit-common-react-native";
import { WagmiAdapter, formatNetwork } from "@reown/appkit-wagmi-react-native";
import { baseSepolia, sepolia } from "wagmi/chains";
import { appChain } from "./chain";

const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID!;

if (!projectId) {
  throw new Error("EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID is required");
}

const metadata = {
  name: "Avelon",
  description: "Decentralized Lending Platform",
  // Shown by the wallet as the requesting site. The relay does not check this —
  // it authorises on the bundle id from expo-application instead — so keep it a
  // stable name rather than deriving it from whichever tunnel is up today.
  url: "https://avelon.app",
  // avelon.app is parked: it accepts the connection and never answers, so an icon
  // hosted there hangs the wallet's prompt instead of 404ing. No icon is better.
  icons: [],
  redirect: {
    // Expo Go never registers the app's own scheme, so a hardcoded avelon:// is a
    // dead address there and the wallet has no way back. createURL resolves to
    // whatever actually reopens the running build.
    native: Linking.createURL(""),
  },
};

// Convert wagmi chain → Reown AppKit network format
const appNetwork = formatNetwork(appChain);

// Chains offered in the WalletConnect session proposal.
//
// Offering only 31337 gives a wallet nothing it can approve — no phone wallet has
// the local Hardhat chain — so the request reaches MetaMask and renders nothing at
// all. Listing public testnets alongside it means every wallet finds common ground
// and the approval prompt appears. Transactions are unaffected: ensureNetwork()
// switches to appChain first, and fails loudly if the wallet cannot.
const proposedChains = [appChain, sepolia, baseSepolia].filter(
  (chain, i, all) => all.findIndex((c) => c.id === chain.id) === i,
);
const networks = proposedChains.map(formatNetwork);

// AsyncStorage is not a Reown Storage, and passing it directly is why a wallet
// never showed a connection prompt: WalletConnect keeps its keychain, pairings
// and session proposals here, so the pairing URI was still generated and the
// wallet still opened, but the proposal itself was never usable.
//
// Three mismatches, not one. getKeys/getEntries do not exist at all — the names
// are getAllKeys/multiGet — and AsyncStorage stores strings, so getItem returns
// raw text where a parsed value is expected and setItem mangles anything that
// isn't already a string. Serialisation has to happen here.
const walletStorage: Storage = {
  async getKeys() {
    return [...(await AsyncStorage.getAllKeys())];
  },

  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    return entries.map(([key, value]) => [key, parse<T>(value)] as [string, T]);
  },

  async getItem<T = unknown>(key: string) {
    return parse<T>(await AsyncStorage.getItem(key));
  },

  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

// The app keeps its own plain-string keys in the same AsyncStorage, and one
// throw inside getEntries would break enumeration for every key at once.
function parse<T>(value: string | null): T | undefined {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

// Create the wagmi adapter for EVM chains
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any,
});

// Export the wagmi config from the adapter for WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Initialise the Reown AppKit singleton
export const appKit = createAppKit({
  projectId,
  metadata,
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: appNetwork,
  storage: walletStorage,
});
