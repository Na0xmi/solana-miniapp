// Helius API integration for real Solana data
class HeliusAnalyzer {
    constructor() {
        // Better CONFIG handling with error checking
        let configAvailable = false;
        try {
            configAvailable = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.helius);
        } catch (e) {
            console.log('⚠️ CONFIG not available during HeliusAnalyzer init');
        }

        if (configAvailable && CONFIG.helius.apiKey && CONFIG.helius.apiKey.length > 0) {
            this.apiKey = CONFIG.helius.apiKey;
            this.baseUrl = CONFIG.helius.baseUrl;
            this.rpcUrl = CONFIG.getRpcUrl();
            this.useFallback = false;
            console.log('✅ Helius API configured with key:', this.apiKey.substring(0, 8) + '...');
        } else {
            this.apiKey = null;
            this.baseUrl = 'https://api.helius.xyz/v0';
            this.rpcUrl = 'https://api.mainnet-beta.solana.com';
            this.useFallback = true;
            console.log('⚠️ No Helius API key found, using fallback mode');
            console.log('💡 Add your API key to CONFIG.helius.apiKey in js/config.js');
        }
        
        // Use token lists from config if available
        this.knownTokens = {
            memecoins: new Set((configAvailable ? CONFIG?.tokens?.memecoins : null) || [
                'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
                'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
                'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
                '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WEN
                'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC'  // HELP
            ]),
            stablecoins: new Set((configAvailable ? CONFIG?.tokens?.stablecoins : null) || [
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
            ]),
            defiPrograms: new Set((configAvailable ? CONFIG?.tokens?.defiPrograms : null) || [
                '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Serum
                'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
                '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
                'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'  // Jupiter
            ])
        };
    }

    async analyzeWallet(walletAddress) {
        console.log('🔍 Starting Helius analysis for:', walletAddress);
        
        if (this.useFallback) {
            console.log('📊 Using fallback mode (no API key configured)');
            return this.generateSmartFallback(walletAddress);
        }

        try {
            console.log('🚀 Using real Helius API for analysis');
            
            // Run multiple API calls in parallel with individual error handling
            const [
                balancesResult,
                nftResult,
                transactionsResult
            ] = await Promise.allSettled([
                this.getTokenBalances(walletAddress),
                this.getNFTs(walletAddress),
                this.getTransactionHistory(walletAddress)
            ]);

            // Log results for debugging
            console.log('📊 API Results Summary:', {
                balances: balancesResult.status === 'fulfilled' ? '✅' : '❌',
                nfts: nftResult.status === 'fulfilled' ? '✅' : '❌', 
                transactions: transactionsResult.status === 'fulfilled' ? '✅' : '❌'
            });

            // Combine results (even if some failed)
            const analysis = this.combineHeliusResults(
                balancesResult,
                nftResult,
                transactionsResult,
                walletAddress
            );

            console.log('✅ Helius analysis complete:', analysis);
            return analysis;

        } catch (error) {
            console.error('❌ Helius analysis completely failed:', error);
            console.log('🔄 Falling back to smart estimation...');
            return this.generateSmartFallback(walletAddress);
        }
    }

    async getTokenBalances(walletAddress) {
        try {
            console.log('🪙 Fetching token balances from Helius...');
            
            const response = await fetch(`${this.baseUrl}/addresses/${walletAddress}/balances?api-key=${this.apiKey}`);
            
            if (!response.ok) {
                throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🪙 ✅ Token balances received:', data.tokens?.length || 0, 'tokens');
            
            // Analyze tokens for memecoins and DeFi
            const analysis = this.analyzeTokenBalances(data.tokens || []);
            
            return {
                success: true,
                totalTokens: data.tokens?.length || 0,
                nativeBalance: data.nativeBalance || 0,
                ...analysis
            };

        } catch (error) {
            console.error('🪙 ❌ Token balances API failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getNFTs(walletAddress) {
        try {
            console.log('🎨 Starting NFT detection...');
            
            // Try Helius Digital Assets API first
            const response = await fetch(`${this.baseUrl}/addresses/${walletAddress}/nfts?api-key=${this.apiKey}`);
            
            if (response.ok) {
                const data = await response.json();
                const nftCount = data.length || 0;
                console.log(`🎨 ✅ Found ${nftCount} NFTs via Helius Digital Assets API`);
                
                return {
                    success: true,
                    nftCount: nftCount,
                    method: 'helius_digital_assets',
                    nfts: data.slice(0, 5).map(nft => ({
                        mint: nft.id,
                        name: nft.content?.metadata?.name || 'Unknown NFT',
                        symbol: nft.content?.metadata?.symbol || '',
                        image: nft.content?.files?.[0]?.uri || ''
                    }))
                };
            } else {
                console.log('🎨 ⚠️ Helius Digital Assets API failed, trying RPC fallback');
                return await this.getNFTsRPCFallback(walletAddress);
            }

        } catch (error) {
            console.error('🎨 ❌ NFT detection failed:', error);
            return await this.getNFTsRPCFallback(walletAddress);
        }
    }

    async getNFTsRPCFallback(walletAddress) {
        try {
            console.log('🎨 Using RPC method for NFT detection...');
            
            const connection = new solanaWeb3.Connection(this.rpcUrl);
            const publicKey = new solanaWeb3.PublicKey(walletAddress);
            
            // Get all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            });

            console.log(`🎨 Found ${tokenAccounts.value.length} total token accounts`);

            // Filter for NFT-like tokens (amount = 1, decimals = 0)
            const nftLikeTokens = tokenAccounts.value.filter(account => {
                const tokenAmount = account.account.data.parsed.info.tokenAmount;
                return tokenAmount.amount === "1" && tokenAmount.decimals === 0;
            });

            console.log(`🎨 Found ${nftLikeTokens.length} potential NFTs (amount=1, decimals=0)`);

            return {
                success: true,
                nftCount: nftLikeTokens.length,
                method: 'rpc_fallback',
                totalTokenAccounts: tokenAccounts.value.length,
                nfts: nftLikeTokens.slice(0, 5).map(account => ({
                    mint: account.account.data.parsed.info.mint,
                    amount: account.account.data.parsed.info.tokenAmount.amount
                }))
            };

        } catch (error) {
            console.error('🎨 ❌ RPC NFT fallback failed:', error);
            return {
                success: false,
                nftCount: 0,
                error: error.message,
                method: 'complete_failure'
            };
        }
    }

    async getTransactionHistory(walletAddress) {
        try {
            console.log('📊 Fetching transaction history from Helius...');
            
            // Try Helius enhanced transactions endpoint
            const response = await fetch(`${this.baseUrl}/addresses/${walletAddress}/transactions?api-key=${this.apiKey}&limit=100`);
            
            if (!response.ok) {
                console.log(`📊 ⚠️ Transaction API returned ${response.status}, trying RPC fallback...`);
                return await this.getTransactionHistoryRPC(walletAddress);
            }

            const data = await response.json();
            console.log(`📊 ✅ Received ${data.length} transactions from Helius`);
            
            // Analyze transactions for DeFi and trading activity
            const analysis = this.analyzeTransactionHistory(data);
            
            return {
                success: true,
                totalTransactions: data.length,
                ...analysis
            };

        } catch (error) {
            console.error('📊 ❌ Transaction history API failed:', error);
            return await this.getTransactionHistoryRPC(walletAddress);
        }
    }

    async getTransactionHistoryRPC(walletAddress) {
        try {
            console.log('📊 Using RPC for transaction count...');
            
            const connection = new solanaWeb3.Connection(this.rpcUrl);
            const publicKey = new solanaWeb3.PublicKey(walletAddress);
            
            const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 1000 });
            console.log(`📊 ✅ Found ${signatures.length} transactions via RPC`);
            
            return {
                success: true,
                totalTransactions: signatures.length,
                defiActivity: Math.floor(signatures.length * 0.15), // Estimate
                memecoinActivity: Math.floor(signatures.length * 0.20), // Estimate
                volume: Math.floor(signatures.length * 0.5), // Estimate
                method: 'rpc_fallback'
            };

        } catch (rpcError) {
            console.error('📊 ❌ RPC transaction fallback failed:', rpcError);
            return { 
                success: false, 
                error: rpcError.message, 
                totalTransactions: 0,
                defiActivity: 0,
                memecoinActivity: 0,
                volume: 0
            };
        }
    }

    analyzeTokenBalances(tokens) {
        console.log('🪙 Analyzing', tokens.length, 'token balances...');
        
        let memecoinHoldings = 0;
        let defiTokens = 0;
        let totalValue = 0;

        tokens.forEach(token => {
            const mint = token.mint || token.address;
            const amount = token.amount || 0;
            const usdValue = token.usdValue || 0;
            
            if (this.knownTokens.memecoins.has(mint)) {
                memecoinHoldings++;
                console.log('🎭 Found memecoin:', mint.substring(0, 8) + '...');
            }
            
            // LP tokens and yield farming tokens typically have specific characteristics
            if (amount > 0 && amount < 1000 && !this.knownTokens.stablecoins.has(mint) && !this.knownTokens.memecoins.has(mint)) {
                defiTokens++;
            }
            
            totalValue += usdValue;
        });

        console.log('🪙 Analysis results:', { memecoinHoldings, defiTokens, totalValue });

        return {
            memecoinHoldings,
            defiTokens,
            totalValue: Math.round(totalValue * 100) / 100,
            // Estimate trading activity based on holdings
            estimatedMemecoinTrades: memecoinHoldings * 12,
            estimatedDefiInteractions: defiTokens * 8
        };
    }

    analyzeTransactionHistory(transactions) {
        if (!Array.isArray(transactions)) {
            return { defiActivity: 0, memecoinActivity: 0, volume: 0 };
        }

        console.log(`📊 Analyzing ${transactions.length} transactions for DeFi and memecoin activity...`);

        let defiActivity = 0;
        let memecoinActivity = 0;
        let totalVolume = 0;

        // Extended DeFi program IDs
        const defiPrograms = new Set([
            // DEXs
            '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Serum
            'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter v6
            'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',  // Jupiter v4
            
            // Lending & Borrowing
            'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',  // Solend
            'LendZqTs7gn5CTSJU1jWKhKuVpjFGom45nnwPb2AMTi',  // Port Finance
            
            // Staking
            '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC', // Marinade
            'CrX7kMhLC3cSsXJdT7JDgqrRVWGnX3gfEfxxU2NVLi', // Lido
            
            // Perpetuals
            'dRiftyHA39MWEi3m9auncq54JQMS1FGZFVH3oD2AgJb',  // Drift
        ]);

        transactions.slice(0, 100).forEach((tx, index) => {
            try {
                // Check for DeFi interactions
                if (tx.instructions) {
                    tx.instructions.forEach(instruction => {
                        const programId = instruction.programId;
                        if (programId && defiPrograms.has(programId)) {
                            defiActivity++;
                            console.log(`📊 ✅ Found DeFi interaction: ${this.getProtocolName(programId)}`);
                        }
                    });
                }

                // Check for memecoin activity
                if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                    tx.tokenTransfers.forEach(transfer => {
                        if (transfer.mint && this.knownTokens.memecoins.has(transfer.mint)) {
                            memecoinActivity++;
                            console.log(`🎭 ✅ Found memecoin activity: ${transfer.mint.substring(0, 8)}...`);
                        }
                    });
                }

                // Estimate volume
                if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                    tx.nativeTransfers.forEach(transfer => {
                        totalVolume += Math.abs(transfer.amount || 0) / 1e9; // Convert lamports to SOL
                    });
                }

            } catch (txError) {
                console.log(`📊 Error analyzing transaction ${index + 1}:`, txError.message);
            }
        });

        console.log(`📊 Transaction analysis complete:`, {
            defiActivity: defiActivity + ' interactions',
            memecoinActivity: memecoinActivity + ' activities',
            volume: Math.round(totalVolume * 100) / 100 + ' SOL'
        });

        return {
            defiActivity,
            memecoinActivity,
            volume: Math.round(totalVolume * 100) / 100
        };
    }

    getProtocolName(programId) {
        const protocolNames = {
            'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': 'Drift Protocol',
            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
            'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca',
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
            '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Serum',
            'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Solend',
            '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC': 'Marinade'
        };
        
        return protocolNames[programId] || `Protocol (${programId.substring(0, 8)}...)`;
    }

    combineHeliusResults(balancesResult, nftResult, transactionsResult, walletAddress) {
        console.log('🔄 Combining Helius API results...');
        
        // Extract successful results
        const balances = balancesResult.status === 'fulfilled' ? balancesResult.value : {};
        const nfts = nftResult.status === 'fulfilled' ? nftResult.value : {};
        const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : {};

        // Combine data from all sources
        const totalTxs = transactions.totalTransactions || 0;
        const nftCount = nfts.nftCount || 0;
        
        // Get memecoin trades from both token holdings and transaction analysis
        const memecoinTrades = Math.max(
            balances.estimatedMemecoinTrades || 0,
            transactions.memecoinActivity || 0,
            balances.memecoinHoldings * 5 || 0
        );
        
        // Get DeFi count from both sources
        const defiCount = Math.max(
            balances.estimatedDefiInteractions || 0,
            transactions.defiActivity || 0,
            balances.defiTokens * 3 || 0
        );

        const totalVolume = transactions.volume || balances.totalValue || 0;
        
        // Calculate account age estimate based on transaction count
        const accountAge = Math.max(30, Math.floor(totalTxs / 3));

        const analysisResults = {
            totalTxs,
            nftCount,
            memecoinTrades,
            defiCount,
            totalVolume,
            uniquePrograms: Math.floor(totalTxs / 20) + Math.floor(defiCount / 2) + 5,
            accountAge,
            isVirgin: totalTxs === 0,
            dataSource: 'helius_api_real',
            apiResults: {
                balances: balances.success || false,
                nfts: nfts.success || false,
                transactions: transactions.success || false
            },
            // Include raw data for debugging
            rawData: {
                tokenCount: balances.totalTokens || 0,
                nativeBalance: balances.nativeBalance || 0,
                nftMethod: nfts.method || 'unknown',
                txMethod: transactions.method || 'unknown'
            }
        };

        console.log('✅ Combined analysis results:', analysisResults);
        return analysisResults;
    }

    generateSmartFallback(walletAddress) {
        console.log('🎯 Generating smart fallback analysis...');
        
        // Generate deterministic but realistic data based on wallet address
        const hash = this.hashString(walletAddress);
        const random = (hash % 10000) / 10000;
        
        // Create different user archetypes based on wallet characteristics
        if (random < 0.1) {
            return { // Virgin wallet
                totalTxs: 0, nftCount: 0, memecoinTrades: 0, defiCount: 0,
                totalVolume: 0, uniquePrograms: 0, accountAge: 0, isVirgin: true,
                dataSource: 'fallback_virgin'
            };
        } else if (random < 0.3) {
            return { // Novice user
                totalTxs: Math.floor(20 + random * 80),
                nftCount: Math.floor(random * 12),
                memecoinTrades: Math.floor(random * 25),
                defiCount: Math.floor(random * 15),
                totalVolume: Math.floor(random * 500),
                uniquePrograms: Math.floor(5 + random * 15),
                accountAge: Math.floor(45 + random * 120),
                isVirgin: false,
                dataSource: 'fallback_novice'
            };
        } else if (random < 0.6) {
            return { // Active user
                totalTxs: Math.floor(150 + random * 350),
                nftCount: Math.floor(8 + random * 40),
                memecoinTrades: Math.floor(25 + random * 100),
                defiCount: Math.floor(15 + random * 50),
                totalVolume: Math.floor(800 + random * 3000),
                uniquePrograms: Math.floor(10 + random * 25),
                accountAge: Math.floor(90 + random * 200),
                isVirgin: false,
                dataSource: 'fallback_active'
            };
        } else if (random < 0.85) {
            return { // Power user
                totalTxs: Math.floor(400 + random * 600),
                nftCount: Math.floor(15 + random * 60),
                memecoinTrades: Math.floor(40 + random * 120),
                defiCount: Math.floor(50 + random * 100),
                totalVolume: Math.floor(2500 + random * 7500),
                uniquePrograms: Math.floor(20 + random * 40),
                accountAge: Math.floor(120 + random * 300),
                isVirgin: false,
                dataSource: 'fallback_power_user'
            };
        } else {
            return { // Degen trader
                totalTxs: Math.floor(600 + random * 800),
                nftCount: Math.floor(10 + random * 50),
                memecoinTrades: Math.floor(150 + random * 400),
                defiCount: Math.floor(30 + random * 80),
                totalVolume: Math.floor(5000 + random * 15000),
                uniquePrograms: Math.floor(25 + random * 50),
                accountAge: Math.floor(80 + random * 250),
                isVirgin: false,
                dataSource: 'fallback_degen'
            };
        }
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // Method to set API key dynamically
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.rpcUrl = `https://rpc.helius.xyz/?api-key=${apiKey}`;
        this.useFallback = false;
        console.log('✅ Helius API key updated:', apiKey.substring(0, 8) + '...');
    }

    // Method to check if API is working
    async testConnection() {
        if (!this.apiKey) {
            console.log('❌ No API key configured');
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/rpc?api-key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'test',
                    method: 'getHealth'
                })
            });
            
            if (response.ok) {
                console.log('✅ Helius API connection successful');
                return true;
            } else {
                console.log('❌ Helius API connection failed:', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Helius API test failed:', error.message);
            return false;
        }
    }
}

// Create global instance with enhanced error handling
let heliusAnalyzer;
try {
    heliusAnalyzer = new HeliusAnalyzer();
    console.log('✅ HeliusAnalyzer initialized successfully');
    
    // Test the connection if API key is available
    if (!heliusAnalyzer.useFallback) {
        heliusAnalyzer.testConnection();
    }
} catch (error) {
    console.error('❌ HeliusAnalyzer failed to initialize:', error);
    // Create a minimal fallback that won't break the app
    heliusAnalyzer = {
        analyzeWallet: async function(walletAddress) {
            console.log('🔄 Using emergency HeliusAnalyzer fallback');
            const hash = walletAddress.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const random = (hash % 10000) / 10000;
            return {
                totalTxs: Math.floor(random * 300) + 50,
                nftCount: Math.floor(random * 20),
                memecoinTrades: Math.floor(random * 50),
                defiCount: Math.floor(random * 30),
                totalVolume: Math.floor(random * 5000),
                uniquePrograms: Math.floor(random * 20) + 5,
                accountAge: Math.floor(random * 365) + 30,
                dataSource: 'emergency_fallback'
            };
        }
    };
}