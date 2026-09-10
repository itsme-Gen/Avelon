import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { wagmiConfig, appKit } from '@/config/wagmi';
import type { ReactNode } from 'react';

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: ReactNode }) {
    return (
        <AppKitProvider instance={appKit}>
            <WagmiProvider config={wagmiConfig}>
                <QueryClientProvider client={queryClient}>
                    {children}
                    {/* AppKitProvider only supplies context. Without this the connect
                        modal has nothing to render and open() appears to do nothing. */}
                    <AppKit />
                </QueryClientProvider>
            </WagmiProvider>
        </AppKitProvider>
    );
}
