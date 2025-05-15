import '../styles/globals.css';
import type { AppProps } from 'next/app';
import type { Adapter, WalletError } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/tronwallet-abstract-adapter';
// @ts-ignore
import { toast } from 'react-hot-toast';
import { useEffect, useMemo, useState } from 'react';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider } from '@tronweb3/tronwallet-adapter-react-ui';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';
import { LedgerAdapter } from '@tronweb3/tronwallet-adapter-ledger';

// Trust Wallet ID
const TRUST_WALLET_ID = '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0';

export default function App({ Component, pageProps }: AppProps) {
    function onError(e: WalletError) {
        if (e instanceof WalletNotFoundError) {
            toast.error(e.message);
        } else if (e instanceof WalletDisconnectedError) {
            toast.error(e.message);
        } else toast.error(e.message);
    }
    const [adapters, setAdapters] = useState<Adapter[]>([]);
    useEffect(() => {
        import('@tronweb3/tronwallet-adapters').then((res) => {
            const { WalletConnectAdapter } = res;
            
            // Create WalletConnect adapter
            const walletConnectAdapter = new WalletConnectAdapter({
                network: 'Mainnet',
                options: {
                    relayUrl: 'wss://relay.walletconnect.com',
                    projectId: '46ed1c5ab1d1737ebfc6dc593af8880b',
                    metadata: {
                        name: 'TRON Wallet',
                        description: 'Connect your TRON wallet',
                        url: 'https://your-dapp-url.org/',
                        icons: ['https://trustwallet.com/assets/images/favicon.png'],
                    },
                },
                web3ModalConfig: {
                    themeMode: 'dark',
                    themeVariables: {
                        '--wcm-z-index': '1000',
                    },
                    // Trust Wallet
                    explorerRecommendedWalletIds: [TRUST_WALLET_ID]
                },
            });
            
            // Only use WalletConnect adapter
            setAdapters([walletConnectAdapter])
        });
    }, [setAdapters])

    /**
     * wrap your app content with WalletProvider and WalletModalProvider
     * WalletProvider provide some useful properties and methods
     * WalletModalProvider provide a Modal in which you can select wallet you want use.
     *
     * Also you can provide a onError callback to process any error such as ConnectionError
     */
    return (
        <WalletProvider onError={onError} adapters={adapters} disableAutoConnectOnLoad={true}>
            <WalletModalProvider>
                <Component {...pageProps} />
            </WalletModalProvider>
        </WalletProvider>
    );
}
