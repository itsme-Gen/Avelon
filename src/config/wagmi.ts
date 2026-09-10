import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { createAppKit } from "@reown/appkit-react-native";
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
  url: "https://avelon.app",
  icons: ["https://avelon.app/icon.png"],
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
  storage: AsyncStorage as any,
});
