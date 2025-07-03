// Metaplex UMI-based NFT detection
class MetaplexNFTDetector {
    constructor() {
        this.isAvailable = false;
        this.checkAvailability();
    }

    checkAvailability() {
        // Check if Metaplex UMI libraries are available
        // Since we can't easily import ES modules in our current setup,
        // we'll use a hybrid approach with fallback
        
        if (typeof window !== 'undefined' && window.MetaplexUmi) {
            this.isAvailable = true;
            console.log('✅ Metaplex UMI library available');
        } else {
            console.log('⚠️ Metaplex UMI not available, using fallback methods');
            this.isAvailable = false;
        }
    }

    async getNFTsWithMetaplex(walletAddress, rpcUrl = 'https://api.mainnet-beta.solana.com') {
        try {
            if (!this.isAvailable) {
                throw new Error('Metaplex UMI not available');
            }

            console.log('🎨 Using Metaplex UMI for NFT detection...');
            
            // This would be the ideal implementation with proper UMI
            const umi = window.MetaplexUmi.createUmi(rpcUrl);
            const ownerPublicKey = window.MetaplexUmi.publicKey(walletAddress);
            
            const allNFTs = await window.MetaplexUmi.fetchAllDigitalAssetWithTokenByOwner(
                umi,
                ownerPublicKey
            );

            console.log(`🎨 ✅ Found ${allNFTs.length} NFTs via Metaplex UMI`);
            
            return {
                success: true,
                nftCount: allNFTs.length,
                nfts: allNFTs.map(nft => ({
                    mint: nft.publicKey.toString(),
                    name: nft.metadata?.name || 'Unknown',
                    symbol: nft.metadata?.symbol || '',
                    uri: nft.metadata?.uri || ''
                })),
                method: 'metaplex_umi'
            };

        } catch (error) {
            console.error('🎨 Metaplex UMI failed:', error);
            throw error;
        }
    }

    async getNFTsWithSimpleUri(walletAddress) {
        try {
            console.log('🎨 Using SimpleHash API for NFT detection...');
            
            // SimpleHash is a great NFT API that supports Solana
            // Free tier: 100 requests/min
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/owners?chains=solana&wallet_addresses=${walletAddress}&limit=50`, {
                headers: {
                    'accept': 'application/json',
                    // 'X-API-KEY': 'your-simplehash-key' // Add if you have one
                }
            });

            if (response.ok) {
                const data = await response.json();
                const nfts = data.nfts || [];
                
                console.log(`🎨 ✅ Found ${nfts.length} NFTs via SimpleHash API`);
                
                return {
                    success: true,
                    nftCount: nfts.length,
                    nfts: nfts.slice(0, 10).map(nft => ({
                        mint: nft.nft_id,
                        name: nft.name || 'Unknown',
                        collection: nft.collection?.name || '',
                        image: nft.previews?.image_medium_url || ''
                    })),
                    method: 'simplehash_api'
                };
            } else {
                throw new Error(`SimpleHash API returned ${response.status}`);
            }

        } catch (error) {
            console.error('🎨 SimpleHash API failed:', error);
            throw error;
        }
    }

    async getNFTsWithHeliusRPC(walletAddress, rpcUrl) {
        try {
            console.log('🎨 Using Helius RPC method for NFT detection...');
            
            // Use Helius RPC method for getting NFTs
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'nft-detection',
                    method: 'getAssetsByOwner',
                    params: {
                        ownerAddress: walletAddress,
                        page: 1,
                        limit: 1000
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.result && data.result.items) {
                    const nfts = data.result.items.filter(item => 
                        item.interface === 'V1_NFT' || 
                        item.interface === 'PROGRAMMABLE_NFT' ||
                        (item.supply && item.supply.print_max_supply === 0)
                    );
                    
                    console.log(`🎨 ✅ Found ${nfts.length} NFTs via Helius RPC`);
                    
                    return {
                        success: true,
                        nftCount: nfts.length,
                        nfts: nfts.slice(0, 10).map(nft => ({
                            mint: nft.id,
                            name: nft.content?.metadata?.name || 'Unknown',
                            symbol: nft.content?.metadata?.symbol || '',
                            image: nft.content?.files?.[0]?.uri || ''
                        })),
                        method: 'helius_rpc'
                    };
                } else {
                    throw new Error('Invalid RPC response format');
                }
            } else {
                throw new Error(`Helius RPC returned ${response.status}`);
            }

        } catch (error) {
            console.error('🎨 Helius RPC failed:', error);
            throw error;
        }
    }

    async detectNFTs(walletAddress, heliusRpcUrl = null) {
        console.log('🎨 Starting comprehensive NFT detection...');
        
        // Try multiple methods in order of preference
        const methods = [
            // Method 1: Metaplex UMI (if available)
            async () => {
                if (this.isAvailable) {
                    return await this.getNFTsWithMetaplex(walletAddress, heliusRpcUrl);
                }
                throw new Error('Metaplex UMI not available');
            },
            
            // Method 2: Helius RPC method
            async () => {
                if (heliusRpcUrl) {
                    return await this.getNFTsWithHeliusRPC(walletAddress, heliusRpcUrl);
                }
                throw new Error('No Helius RPC URL provided');
            },
            
            // Method 3: SimpleHash API
            async () => {
                return await this.getNFTsWithSimpleUri(walletAddress);
            },
            
            // Method 4: Fallback estimation
            async () => {
                console.log('🎨 Using fallback NFT estimation...');
                return {
                    success: false,
                    nftCount: 0,
                    method: 'fallback_estimation',
                    message: 'All NFT detection methods failed'
                };
            }
        ];

        // Try each method until one succeeds
        for (let i = 0; i < methods.length; i++) {
            try {
                const result = await methods[i]();
                if (result.success) {
                    console.log(`🎨 ✅ NFT detection successful using method ${i + 1}`);
                    return result;
                }
            } catch (error) {
                console.log(`🎨 Method ${i + 1} failed: ${error.message}`);
                continue;
            }
        }

        // If all methods fail
        return {
            success: false,
            nftCount: 0,
            method: 'all_methods_failed',
            message: 'Could not detect NFTs using any method'
        };
    }

    // Helper method to load Metaplex UMI dynamically (for future use)
    async loadMetaplexUMI() {
        try {
            // This would dynamically load the Metaplex libraries
            // For now, we'll add instructions for manual inclusion
            console.log('💡 To enable Metaplex UMI detection:');
            console.log('1. Add to your HTML head:');
            console.log('<script src="https://unpkg.com/@metaplex-foundation/umi-bundle-defaults@latest/dist/index.umd.js"></script>');
            console.log('<script src="https://unpkg.com/@metaplex-foundation/mpl-token-metadata@latest/dist/index.umd.js"></script>');
            console.log('2. Reload the page');
            
            return false;
        } catch (error) {
            console.error('Failed to load Metaplex UMI:', error);
            return false;
        }
    }
}

// Create global instance
const metaplexNFTDetector = new MetaplexNFTDetector();