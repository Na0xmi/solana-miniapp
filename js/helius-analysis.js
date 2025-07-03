// Helius API integration for real Solana data
class HeliusAnalyzer {
    constructor() {
        // Check if CONFIG is available
        if (typeof CONFIG !== 'undefined' && CONFIG.isConfigured()) {
            this.apiKey = CONFIG.helius.apiKey;
            this.baseUrl = CONFIG.helius.baseUrl;
            this.rpcUrl = CONFIG.getRpcUrl();
            this.useFallback = false;
            console.log('✅ Helius API configured from config file');
        } else {
            this.apiKey = null;
            this.baseUrl = 'https://api.helius.xyz/v0';
            this.rpcUrl = null;
            this.useFallback = true;
            console.log('⚠️ No Helius API key configured, using fallback mode');
            console.log('💡 Add your API key to js/config.js or use the UI input');
        }
        
        // Use token lists from config if available
        this.knownTokens = {
            memecoins: new Set(CONFIG?.tokens?.memecoins || [
                'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
                'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
                'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
                '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WEN
                'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC'  // HELP
            ]),
            stablecoins: new Set(CONFIG?.tokens?.stablecoins || [
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
            ]),
            defiPrograms: new Set(CONFIG?.tokens?.defiPrograms || [
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
                throw new Error(`Helius API error: ${response.status}`);
            }

            const data = await response.json();
            
            // Analyze tokens for memecoins and DeFi
            const analysis = this.analyzeTokenBalances(data.tokens || []);
            
            return {
                success: true,
                totalTokens: data.tokens?.length || 0,
                ...analysis
            };

        } catch (error) {
            console.error('Token balances API failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getNFTs(walletAddress) {
        try {
            console.log('🎨 Starting enhanced NFT detection...');
            
            // Use the new comprehensive NFT detector
            const result = await metaplexNFTDetector.detectNFTs(walletAddress, this.rpcUrl);
            
            if (result.success && result.nftCount > 0) {
                console.log(`🎨 ✅ Successfully detected ${result.nftCount} NFTs using ${result.method}`);
                return result;
            } else {
                console.log(`🎨 ⚠️ NFT detection returned 0 NFTs using ${result.method}`);
                
                // If the sophisticated methods return 0, try our basic RPC fallback
                console.log('🎨 Trying basic RPC fallback as final attempt...');
                return await this.getNFTsBasicRPCFallback(walletAddress);
            }

        } catch (error) {
            console.error('🎨 Enhanced NFT detection failed:', error);
            return await this.getNFTsBasicRPCFallback(walletAddress);
        }
    }

    async getNFTsBasicRPCFallback(walletAddress) {
        try {
            console.log('🎨 Basic RPC NFT fallback...');
            
            const connection = new solanaWeb3.Connection(this.rpcUrl || 'https://api.mainnet-beta.solana.com');
            const publicKey = new solanaWeb3.PublicKey(walletAddress);
            
            // Get all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            });

            console.log(`🎨 Found ${tokenAccounts.value.length} total token accounts`);

            // Filter for NFT-like tokens
            const nftLikeTokens = tokenAccounts.value.filter(account => {
                const tokenAmount = account.account.data.parsed.info.tokenAmount;
                return tokenAmount.amount === "1" && tokenAmount.decimals === 0;
            });

            console.log(`🎨 Found ${nftLikeTokens.length} tokens with NFT characteristics`);

            if (nftLikeTokens.length === 0) {
                return {
                    success: true,
                    nftCount: 0,
                    method: 'rpc_fallback_no_nfts',
                    totalTokenAccounts: tokenAccounts.value.length
                };
            }

            // For tokens that look like NFTs, assume they are NFTs
            // This is a reasonable assumption since most amount=1, decimals=0 tokens are NFTs
            console.log(`🎨 Assuming all ${nftLikeTokens.length} NFT-like tokens are actual NFTs`);

            return {
                success: true,
                nftCount: nftLikeTokens.length,
                method: 'rpc_fallback_assumption',
                totalTokenAccounts: tokenAccounts.value.length,
                nfts: nftLikeTokens.slice(0, 5).map(account => ({
                    mint: account.account.data.parsed.info.mint,
                    amount: account.account.data.parsed.info.tokenAmount.amount
                }))
            };

        } catch (error) {
            console.error('🎨 Basic RPC fallback failed:', error);
            return {
                success: false,
                nftCount: 0,
                error: error.message,
                method: 'complete_failure'
            };
        }
    }

    async getNFTsAlternative(walletAddress) {
        try {
            console.log('🎨 Advanced NFT detection via RPC...');
            
            const connection = new solanaWeb3.Connection(this.rpcUrl || 'https://api.mainnet-beta.solana.com');
            const publicKey = new solanaWeb3.PublicKey(walletAddress);
            
            // Get all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            });

            console.log(`🎨 Found ${tokenAccounts.value.length} total token accounts`);

            // NFTs have specific characteristics: amount = 1, decimals = 0
            const nftLikeTokens = tokenAccounts.value.filter(account => {
                const tokenAmount = account.account.data.parsed.info.tokenAmount;
                const amount = tokenAmount.amount;
                const decimals = tokenAmount.decimals;
                
                // NFTs should have exactly 1 token with 0 decimals
                return amount === "1" && decimals === 0;
            });

            console.log(`🎨 Found ${nftLikeTokens.length} tokens with NFT characteristics (amount=1, decimals=0)`);

            if (nftLikeTokens.length === 0) {
                console.log('🎨 No NFT-like tokens found via RPC');
                return {
                    success: true,
                    nftCount: 0,
                    method: 'rpc_no_nfts_found',
                    totalTokenAccounts: tokenAccounts.value.length
                };
            }

            // Try to verify these are actually NFTs by checking metadata
            let verifiedNFTs = 0;
            const sampleSize = Math.min(nftLikeTokens.length, 10);
            
            console.log(`🎨 Verifying ${sampleSize} potential NFTs for metadata...`);

            for (let i = 0; i < sampleSize; i++) {
                const mint = nftLikeTokens[i].account.data.parsed.info.mint;
                try {
                    const hasMetadata = await this.checkForNFTMetadata(connection, mint);
                    if (hasMetadata) {
                        verifiedNFTs++;
                        console.log(`🎨 ✅ Verified NFT: ${mint.substring(0, 8)}...`);
                    } else {
                        console.log(`🎨 ❌ Not an NFT: ${mint.substring(0, 8)}... (no metadata)`);
                    }
                } catch (metaError) {
                    console.log(`🎨 ⚠️ Couldn't verify ${mint.substring(0, 8)}...: ${metaError.message}`);
                }
            }

            // Calculate final NFT count
            let finalNFTCount;
            if (verifiedNFTs > 0) {
                // Scale up based on verification rate
                finalNFTCount = Math.round(nftLikeTokens.length * (verifiedNFTs / sampleSize));
                console.log(`🎨 Estimated ${finalNFTCount} NFTs (${verifiedNFTs}/${sampleSize} verified, scaled up)`);
            } else {
                // If no metadata found, but tokens exist, they might still be NFTs
                // Some NFTs don't have standard Metaplex metadata
                finalNFTCount = nftLikeTokens.length;
                console.log(`🎨 Assuming ${finalNFTCount} NFTs (no metadata found, but tokens match NFT pattern)`);
            }

            return {
                success: true,
                nftCount: Math.max(finalNFTCount, 0),
                method: 'rpc_advanced_analysis',
                potentialNFTs: nftLikeTokens.length,
                verifiedSample: verifiedNFTs,
                sampleSize: sampleSize,
                totalTokenAccounts: tokenAccounts.value.length,
                nfts: nftLikeTokens.slice(0, 3).map(account => ({
                    mint: account.account.data.parsed.info.mint,
                    amount: account.account.data.parsed.info.tokenAmount.amount
                }))
            };

        } catch (altError) {
            console.error('🎨 Advanced NFT detection failed:', altError);
            
            // Final manual estimate - if user says they have NFTs, believe them :)
            return {
                success: false,
                nftCount: 3, // Fallback to a reasonable estimate
                error: `NFT detection failed: ${altError.message}`,
                method: 'manual_fallback_estimate'
            };
        }
    }

    async checkForNFTMetadata(connection, mintAddress) {
        try {
            // Check for Metaplex metadata account
            const metadataPDA = await this.getMetadataPDA(mintAddress);
            const metadataAccount = await connection.getAccountInfo(metadataPDA);
            
            if (metadataAccount && metadataAccount.data.length > 0) {
                return true; // Has Metaplex metadata
            }

            // Also check if it's a compressed NFT or other standard
            // (This is a simplified check)
            return false;
            
        } catch (error) {
            console.log(`🎨 Metadata check failed for ${mintAddress}: ${error.message}`);
            return false;
        }
    }

    async getMetadataPDA(mintAddress) {
        // Calculate Metaplex metadata PDA (Program Derived Address)
        const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        const seeds = [
            Buffer.from('metadata'),
            new solanaWeb3.PublicKey(METADATA_PROGRAM_ID).toBuffer(),
            new solanaWeb3.PublicKey(mintAddress).toBuffer(),
        ];
        
        const [metadataPDA] = await solanaWeb3.PublicKey.findProgramAddress(
            seeds,
            new solanaWeb3.PublicKey(METADATA_PROGRAM_ID)
        );
        
        return metadataPDA;
    }

    async getTransactionHistory(walletAddress) {
        try {
            console.log('📊 Fetching transaction history from Helius...');
            
            // Try Helius enhanced transactions endpoint
            const response = await fetch(`${this.baseUrl}/addresses/${walletAddress}/transactions?api-key=${this.apiKey}&limit=50&type=TRANSFER`);
            
            if (!response.ok) {
                console.log(`Transaction API returned ${response.status}, trying RPC fallback...`);
                return await this.getTransactionHistoryRPC(walletAddress);
            }

            const data = await response.json();
            
            // Analyze transactions for DeFi and trading activity
            const analysis = this.analyzeTransactionHistory(data);
            
            return {
                success: true,
                totalTransactions: data.length,
                ...analysis
            };

        } catch (error) {
            console.error('Transaction history API failed:', error);
            return await this.getTransactionHistoryRPC(walletAddress);
        }
    }

    async getTransactionHistoryRPC(walletAddress) {
        try {
            console.log('📊 Falling back to RPC for transaction count...');
            
            const connection = new solanaWeb3.Connection(this.rpcUrl || 'https://api.mainnet-beta.solana.com');
            const publicKey = new solanaWeb3.PublicKey(walletAddress);
            
            const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 100 });
            
            return {
                success: true,
                totalTransactions: signatures.length,
                defiActivity: Math.floor(signatures.length * 0.1), // Estimate
                memecoinActivity: Math.floor(signatures.length * 0.15), // Estimate
                volume: Math.floor(signatures.length * 0.5), // Estimate
                method: 'rpc_fallback'
            };

        } catch (rpcError) {
            console.error('RPC transaction fallback failed:', rpcError);
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
        const knownMemecoins = new Set([
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
            'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF  
            'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
            '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WEN
            'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC'  // HELP
        ]);

        const stablecoins = new Set([
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
        ]);

        let memecoinHoldings = 0;
        let defiTokens = 0;
        let totalValue = 0;

        tokens.forEach(token => {
            const mint = token.mint || token.address;
            const amount = token.amount || 0;
            
            if (knownMemecoins.has(mint)) {
                memecoinHoldings++;
            }
            
            // LP tokens and yield farming tokens typically have specific characteristics
            if (amount > 0 && amount < 1000 && !stablecoins.has(mint) && !knownMemecoins.has(mint)) {
                defiTokens++;
            }
            
            totalValue += token.usdValue || 0;
        });

        return {
            memecoinHoldings,
            defiTokens,
            totalValue: Math.round(totalValue * 100) / 100,
            // Estimate trading activity based on holdings
            estimatedMemecoinTrades: memecoinHoldings * 8,
            estimatedDefiInteractions: defiTokens * 5
        };
    }

    analyzeTransactionHistory(transactions) {
        if (!Array.isArray(transactions)) {
            return { defiActivity: 0, memecoinActivity: 0, volume: 0 };
        }

        let defiActivity = 0;
        let memecoinActivity = 0;
        let totalVolume = 0;

        // Extended DeFi program IDs including more protocols
        const defiPrograms = new Set([
            // DEXs
            '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Serum
            'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter v6
            'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',  // Jupiter v4
            'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo',  // Jupiter v3
            
            // Perpetuals & Derivatives
            'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',  // Drift Protocol
            'ALP8SdU9oARYVLgLR7LrqMNCYBnhtnQy1cKXmxwZwR', // Drift (alternative)
            'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb',  // OpenBook
            'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',  // Serum (old)
            
            // Lending & Borrowing
            'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',  // Solend
            'LendZqTs7gn5CTSJU1jWKhKuVpjFGom45nnwPb2AMTi',  // Port Finance
            'FC81tbGt6JWRXidaWYFXxGnTk4VgobhJHATvTRVMqgWj', // Francium
            'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',  // Marinade
            
            // Yield Farming
            'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs',  // Tulip
            'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',  // Saber
            'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky', // Mercurial
            '9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z', // Orca Whirlpools
            
            // Staking
            '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC', // Marinade
            'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi', // Lido
            'StakeSSzfxn391k3LveFLFo6EDABhMGH5AZ5Pg2fBvKY',  // Stake Pool
            
            // Options & Structured Products
            'PsyFiqqjiv41G7o5SMRzDJCu4psptThNR2GtfeGHfSq',  // PsyOptions
            'DtmE9D2CSB4L5D6A15mraeEjrGMm6auWVzgaD4jVDOZb',  // Dual Finance
            
            // Cross-chain
            'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb',  // Wormhole
            'A2yFwEqAMgczr4pGSKeMDFjp6K3Gm8SJ7YECCvHQrm1J',  // AllBridge
        ]);

        console.log(`📊 Analyzing ${transactions.length} transactions for DeFi activity...`);

        transactions.slice(0, 50).forEach((tx, index) => {
            try {
                // Check for DeFi interactions in instructions
                if (tx.instructions) {
                    tx.instructions.forEach(instruction => {
                        const programId = instruction.programId;
                        if (programId && defiPrograms.has(programId)) {
                            defiActivity++;
                            console.log(`📊 ✅ Found DeFi interaction with ${this.getProtocolName(programId)} in tx ${index + 1}`);
                        }
                    });
                }

                // Also check account keys for program interactions
                if (tx.accountKeys) {
                    tx.accountKeys.forEach(accountKey => {
                        if (defiPrograms.has(accountKey)) {
                            defiActivity++;
                            console.log(`📊 ✅ Found DeFi account interaction with ${this.getProtocolName(accountKey)} in tx ${index + 1}`);
                        }
                    });
                }

                // Check for program interactions in a different format
                if (tx.type && (tx.type.includes('SWAP') || tx.type.includes('TRADE') || tx.type.includes('STAKE'))) {
                    defiActivity++;
                    console.log(`📊 ✅ Found DeFi activity type: ${tx.type} in tx ${index + 1}`);
                }

                // Estimate volume from transaction
                if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                    tx.nativeTransfers.forEach(transfer => {
                        totalVolume += Math.abs(transfer.amount || 0) / 1e9; // Convert lamports to SOL
                    });
                }

                // Check for token transfers (potential memecoin trading)
                if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                    // Check if any token transfers involve known memecoins
                    tx.tokenTransfers.forEach(transfer => {
                        if (transfer.mint && this.knownTokens.memecoins.has(transfer.mint)) {
                            memecoinActivity++;
                            console.log(`📊 ✅ Found memecoin transfer: ${transfer.mint.substring(0, 8)}... in tx ${index + 1}`);
                        }
                    });
                    
                    // General token transfer activity (potential trading)
                    if (tx.tokenTransfers.length > 1) {
                        memecoinActivity++; // Multi-token transfers often indicate trading
                    }
                }

            } catch (txError) {
                console.log(`📊 Error analyzing transaction ${index + 1}:`, txError.message);
            }
        });

        console.log(`📊 DeFi Analysis Results: ${defiActivity} interactions found`);
        console.log(`📊 Memecoin Analysis Results: ${memecoinActivity} activities found`);

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
            '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC': 'Marinade',
            'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb': 'OpenBook'
        };
        
        return protocolNames[programId] || `Unknown Protocol (${programId.substring(0, 8)}...)`;
    }

    combineHeliusResults(balancesResult, nftResult, transactionsResult, walletAddress) {
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
            transactions.memecoinActivity || 0
        );
        
        // Get DeFi count from both sources
        const defiCount = Math.max(
            balances.estimatedDefiInteractions || 0,
            transactions.defiActivity || 0
        );

        const totalVolume = transactions.volume || balances.totalValue || 0;
        
        // Calculate account age estimate
        const accountAge = Math.max(30, Math.floor(totalTxs / 2));

        const basicStats = {
            totalTxs,
            nftCount,
            memecoinTrades,
            defiCount,
            totalVolume,
            uniquePrograms: Math.floor(totalTxs / 15) + 5,
            accountAge,
            isVirgin: totalTxs === 0,
            dataSource: 'helius_api',
            apiResults: {
                balances: balances.success || false,
                nfts: nfts.success || false,
                transactions: transactions.success || false
            }
        };

        // Try to add performance analysis
        try {
            if (typeof performanceAnalyzer !== 'undefined') {
                console.log('💰 Adding performance analysis...');
                // Note: We'll do this async in the main analysis function
                basicStats.hasPerformanceData = false;
            }
        } catch (perfError) {
            console.log('💰 Performance analyzer not available:', perfError.message);
        }

        // Use the enhanced persona determination
        const persona = this.determinePersonaEnhanced(basicStats);
        
        return {
            ...basicStats,
            persona
        };
    }

    // Enhanced persona determination with backward compatibility
    determinePersonaEnhanced(stats, performance = null) {
        console.log('🏛️ Determining philosopher persona...');
        
        if (performance && typeof determinePersonaWithPerformance === 'function') {
            return determinePersonaWithPerformance(stats, performance);
        } else if (typeof determinePersona === 'function') {
            return determinePersona(stats);
        } else {
            // Fallback logic built-in
            return this.fallbackPersonaDetermination(stats);
        }
    }

    // Fallback persona determination if external functions fail
    fallbackPersonaDetermination(stats) {
        console.log('🏛️ Using fallback persona determination...');
        
        // Diogenes - The minimalist
        if (stats.totalTxs === 0 || stats.isVirgin) {
            return 'diogenes';
        }
        
        // Camus - High memecoin activity (chaos embraced)
        if (stats.memecoinTrades >= 10) {
            return 'camus';
        }
        
        // Marx - High DeFi activity
        if (stats.defiCount >= 5) {
            return 'marx';
        }
        
        // Nietzsche - High NFT activity
        if (stats.nftCount >= 5) {
            return 'nietzsche';
        }
        
        // Default to Schopenhauer
        return 'schopenhauer';
    }

    generateSmartFallback(walletAddress) {
        console.log('🎯 Generating smart fallback for demo...');
        
        // Generate deterministic but realistic data
        const hash = this.hashString(walletAddress);
        const random = (hash % 10000) / 10000;
        
        // Create different user archetypes
        if (random < 0.1) {
            return { // Virgin
                totalTxs: 0, nftCount: 0, memecoinTrades: 0, defiCount: 0,
                totalVolume: 0, uniquePrograms: 0, accountAge: 0, isVirgin: true,
                dataSource: 'fallback_virgin'
            };
        } else if (random < 0.3) {
            return { // Novice
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
            return { // Active
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
            return { // Builder/Power User
                totalTxs: Math.floor(400 + random * 600),
                nftCount: Math.floor(15 + random * 60),
                memecoinTrades: Math.floor(40 + random * 120),
                defiCount: Math.floor(50 + random * 100),
                totalVolume: Math.floor(2500 + random * 7500),
                uniquePrograms: Math.floor(20 + random * 40),
                accountAge: Math.floor(120 + random * 300),
                isVirgin: false,
                dataSource: 'fallback_builder'
            };
        } else {
            return { // Degen
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
        console.log('✅ Helius API key configured');
    }
}

// Create global instance
const heliusAnalyzer = new HeliusAnalyzer();