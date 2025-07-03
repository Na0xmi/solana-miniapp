// Philosopher-based Solana personas with images - much more fun!
const PERSONAS = {
    diogenes: {
        icon: "🏺",
        title: "Diogenes the Cynic",
        description: "You reject all material possessions and live with absolute minimalism. Your wallet contains virtually nothing because you believe true wealth comes from wanting less, not having more. You are the purest form of hodler.",
        gradient: "linear-gradient(135deg, #8B4513 0%, #DEB887 100%)", // Earth tones
        traits: ["Minimalist", "Ascetic", "Anti-materialist", "Pure"],
        imageUrl: "https://via.placeholder.com/400x300/8B4513/FFFFFF?text=Diogenes+🏺", // Replace with actual image
        philosophy: "\"I am looking for an honest coin.\" - Rejects all DeFi complexity for pure hodling."
    },
    schopenhauer: {
        icon: "😤", 
        title: "Schopenhauer the Pessimist",
        description: "You hate everything about crypto and DeFi, yet here you are, trapped in this miserable cycle of financial speculation. Every transaction fills you with existential dread, but you continue because suffering is the human condition.",
        gradient: "linear-gradient(135deg, #2C3E50 0%, #34495E 100%)", // Dark grays
        traits: ["Pessimistic", "Suffering", "Reluctant participant", "Doomed"],
        imageUrl: "https://via.placeholder.com/400x300/2C3E50/FFFFFF?text=Schopenhauer+😤", // Replace with actual image
        philosophy: "\"All trading is suffering.\" - Continues trading despite knowing it will only bring pain."
    },
    camus: {
        icon: "🎭",
        title: "Camus the Absurdist", 
        description: "You embrace the fundamental absurdity of throwing money at cartoon dogs and magic internet money. Life has no meaning, so why not buy $BONK and $WIF? You find joy in the meaningless chaos of memecoin degeneracy.",
        gradient: "linear-gradient(135deg, #E74C3C 0%, #F39C12 100%)", // Vibrant chaos
        traits: ["Absurdist", "Degen", "Embraces chaos", "Memecoin enthusiast"],
        imageUrl: "https://via.placeholder.com/400x300/E74C3C/FFFFFF?text=Camus+🎭", // Replace with actual image
        philosophy: "\"One must imagine $BONK holders happy.\" - Finds meaning in meaningless memecoins."
    },
    marx: {
        icon: "☭",
        title: "Marx the Revolutionary",
        description: "You understand the means of production but are absolutely terrible with money. Your portfolio is a study in how someone can analyze capitalism brilliantly yet lose everything to bad DeFi trades. The revolution will be decentralized!",
        gradient: "linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)", // Revolutionary red
        traits: ["Anti-capitalist", "Bad with money", "DeFi victim", "Revolutionary"],
        imageUrl: "https://via.placeholder.com/400x300/C0392B/FFFFFF?text=Marx+☭", // Replace with actual image
        philosophy: "\"The philosophers have only interpreted the markets; the point is to change them... and lose money doing it.\""
    },
    nietzsche: {
        icon: "⚡",
        title: "Nietzsche the Übermensch",
        description: "You have transcended traditional financial wisdom and created your own values. God is dead, and you killed him with leverage trading. You are building the future of finance through pure will to power and NFT collections.",
        gradient: "linear-gradient(135deg, #8E44AD 0%, #3498DB 100%)", // Bold purple to blue
        traits: ["Übermensch", "Value creator", "Transcendent", "Builder"],
        imageUrl: "https://via.placeholder.com/400x300/8E44AD/FFFFFF?text=Nietzsche+⚡", // Replace with actual image
        philosophy: "\"What does not destroy my portfolio, makes it stronger.\" - Creates new financial paradigms."
    }
};

// Performance analysis for better persona detection
class PerformanceAnalyzer {
    constructor() {
        this.analysisCache = new Map();
    }

    async analyzePerformance(walletAddress, transactionData, tokenBalances) {
        try {
            console.log('💰 Analyzing wallet performance...');
            
            const performance = {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                estimatedPnL: 0,
                riskProfile: 'unknown',
                tradingPattern: 'unknown'
            };

            // Analyze token swap patterns for profit/loss estimation
            if (transactionData && transactionData.length > 0) {
                performance.totalTrades = this.countTradingTransactions(transactionData);
                
                // Estimate win/loss ratio from trading patterns
                const tradingAnalysis = this.analyzeTrading (transactionData);
                performance.winningTrades = tradingAnalysis.estimatedWins;
                performance.losingTrades = tradingAnalysis.estimatedLosses;
                performance.winRate = performance.totalTrades > 0 ? 
                    (performance.winningTrades / performance.totalTrades) * 100 : 0;
            }

            // Analyze current portfolio value vs activity
            if (tokenBalances && tokenBalances.length > 0) {
                performance.estimatedPnL = this.estimatePortfolioPerformance(tokenBalances);
            }

            // Determine risk profile and trading patterns
            performance.riskProfile = this.determineRiskProfile(transactionData, tokenBalances);
            performance.tradingPattern = this.identifyTradingPattern(transactionData);

            console.log('💰 Performance analysis result:', performance);
            return performance;

        } catch (error) {
            console.error('💰 Performance analysis failed:', error);
            return {
                totalTrades: 0,
                winRate: 50, // Neutral assumption
                estimatedPnL: 0,
                riskProfile: 'conservative',
                tradingPattern: 'hodler'
            };
        }
    }

    countTradingTransactions(transactions) {
        return transactions.filter(tx => 
            tx.tokenTransfers && tx.tokenTransfers.length >= 2 || // Swaps
            tx.type && tx.type.includes('SWAP') ||
            tx.description && tx.description.toLowerCase().includes('swap')
        ).length;
    }

    analyzeTradingPatterns(transactions) {
        let estimatedWins = 0;
        let estimatedLosses = 0;
        let quickTrades = 0;
        let hodlPeriods = 0;

        // Simple heuristics for win/loss estimation
        transactions.forEach((tx, index) => {
            // Quick successive trades often indicate losses (panic selling)
            if (index > 0) {
                const timeDiff = tx.timestamp - transactions[index - 1].timestamp;
                if (timeDiff < 3600) { // Less than 1 hour
                    quickTrades++;
                    estimatedLosses++; // Quick trades often = bad decisions
                } else if (timeDiff > 86400 * 7) { // More than 1 week
                    hodlPeriods++;
                    estimatedWins++; // Patience often = better outcomes
                }
            }

            // High gas fees relative to transaction value suggests desperation
            if (tx.fee && tx.nativeTransfers) {
                const feeRatio = tx.fee / (tx.nativeTransfers[0]?.amount || 1);
                if (feeRatio > 0.05) { // Fee > 5% of transaction
                    estimatedLosses++;
                }
            }
        });

        return {
            estimatedWins: Math.max(estimatedWins, Math.floor(transactions.length * 0.3)),
            estimatedLosses: Math.max(estimatedLosses, Math.floor(transactions.length * 0.2)),
            quickTrades,
            hodlPeriods
        };
    }

    estimatePortfolioPerformance(tokenBalances) {
        // Simplified portfolio value estimation
        let totalValue = 0;
        let suspiciousHoldings = 0;

        tokenBalances.forEach(token => {
            totalValue += token.usdValue || 0;
            
            // Check for "bag holding" patterns (lots of small value tokens)
            if (token.usdValue < 1 && token.amount > 100) {
                suspiciousHoldings++;
            }
        });

        // High number of small-value holdings suggests poor trading decisions
        const bagHoldingRatio = suspiciousHoldings / tokenBalances.length;
        
        if (bagHoldingRatio > 0.5) {
            return -1; // Likely losing money
        } else if (bagHoldingRatio < 0.2 && totalValue > 100) {
            return 1; // Likely profitable
        }
        
        return 0; // Neutral
    }

    determineRiskProfile(transactions, tokenBalances) {
        const memecoinCount = tokenBalances?.filter(token => 
            token.symbol && (token.symbol.includes('INU') || 
                           token.symbol.includes('DOGE') ||
                           token.symbol.includes('BONK'))
        ).length || 0;

        const defiComplexity = transactions?.filter(tx =>
            tx.instructions && tx.instructions.length > 3
        ).length || 0;

        if (memecoinCount > 5) return 'degen';
        if (defiComplexity > 10) return 'sophisticated';
        if (transactions?.length < 20) return 'conservative';
        return 'moderate';
    }

    identifyTradingPattern(transactions) {
        if (!transactions || transactions.length < 5) return 'hodler';
        
        const avgTimeBetween = this.calculateAverageTimeBetweenTx(transactions);
        
        if (avgTimeBetween < 3600) return 'hyperactive'; // < 1 hour
        if (avgTimeBetween < 86400) return 'active'; // < 1 day  
        if (avgTimeBetween < 86400 * 7) return 'weekly'; // < 1 week
        return 'hodler'; // > 1 week
    }

    calculateAverageTimeBetweenTx(transactions) {
        if (transactions.length < 2) return Infinity;
        
        const times = transactions.map(tx => tx.timestamp || tx.blockTime || Date.now() / 1000);
        const intervals = [];
        
        for (let i = 1; i < times.length; i++) {
            intervals.push(Math.abs(times[i] - times[i-1]));
        }
        
        return intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
}

// Updated persona determination logic with performance analysis
function determinePersonaWithPerformance(stats, performance) {
    console.log('🏛️ Determining philosopher persona with performance data...');
    console.log('📊 Stats:', stats);
    console.log('💰 Performance:', performance);

    // Diogenes - The ultimate minimalist
    if (stats.totalTxs === 0 || stats.isVirgin) {
        return 'diogenes';
    }
    
    // Marx - High DeFi activity but bad performance
    if (stats.defiCount >= 5 && (performance.estimatedPnL < 0 || performance.winRate < 40)) {
        return 'marx';
    }
    
    // Camus - High memecoin activity (chaos embraced regardless of outcome)
    if (stats.memecoinTrades >= 10 || performance.riskProfile === 'degen') {
        return 'camus';
    }
    
    // Schopenhauer - Moderate activity with pessimistic patterns
    if (stats.totalTxs >= 20 && stats.totalTxs < 200 && 
        (performance.winRate < 50 || performance.tradingPattern === 'hyperactive')) {
        return 'schopenhauer';
    }
    
    // Nietzsche - High NFT activity and/or good performance (value creator)
    if (stats.nftCount >= 5 && (stats.defiCount >= 3 || performance.estimatedPnL > 0)) {
        return 'nietzsche';
    }
    
    // Default to Schopenhauer (the reluctant participant)
    return 'schopenhauer';
}

// Backward compatibility - simple persona determination
function determinePersona(stats) {
    // If no performance data available, use simplified logic
    const mockPerformance = {
        winRate: 50,
        estimatedPnL: 0,
        riskProfile: 'moderate',
        tradingPattern: 'hodler'
    };
    
    return determinePersonaWithPerformance(stats, mockPerformance);
}

// Create global performance analyzer
const performanceAnalyzer = new PerformanceAnalyzer();

// Demo wallet addresses for testing different personas
const DEMO_WALLETS = {
    diogenes: "Demo-Diogenes-Address-111111111111111",
    schopenhauer: "Demo-Schopenhauer-Address-222222222222", 
    camus: "Demo-Camus-Address-333333333333333",
    marx: "Demo-Marx-Address-444444444444444",
    nietzsche: "Demo-Nietzsche-Address-555555555555555"
};

// Generate demo data based on philosopher type
function generatePersonaData(personaType) {
    const baseData = {
        diogenes: { 
            totalTxs: 0, 
            nftCount: 0, 
            memecoinTrades: 0, 
            defiCount: 0, 
            totalVolume: 0, 
            uniquePrograms: 0, 
            accountAge: 365,
            isVirgin: true
        },
        schopenhauer: { 
            totalTxs: 75, 
            nftCount: 2, 
            memecoinTrades: 8, 
            defiCount: 3, 
            totalVolume: 200, 
            uniquePrograms: 6, 
            accountAge: 180
        },
        camus: { 
            totalTxs: 420,
            nftCount: 12, 
            memecoinTrades: 69,
            defiCount: 8, 
            totalVolume: 1337,
            uniquePrograms: 15, 
            accountAge: 90
        },
        marx: { 
            totalTxs: 350, 
            nftCount: 5, 
            memecoinTrades: 25, 
            defiCount: 45,
            totalVolume: 15000,
            uniquePrograms: 25, 
            accountAge: 240
        },
        nietzsche: { 
            totalTxs: 200, 
            nftCount: 35,
            memecoinTrades: 15, 
            defiCount: 20, 
            totalVolume: 5000, 
            uniquePrograms: 30,
            accountAge: 300
        }
    };
    
    return baseData[personaType] || baseData.schopenhauer;
}

// Generate random but realistic data for testing
function generateRandomData(walletAddress) {
    const seed = walletAddress.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const random = (seed * 9301 + 49297) % 233280 / 233280;

    return {
        totalTxs: Math.floor(random * 500) + 1,
        nftCount: Math.floor(random * 50),
        memecoinTrades: Math.floor(random * 100),
        defiCount: Math.floor(random * 40),
        totalVolume: Math.round(random * 10000 * 100) / 100,
        uniquePrograms: Math.floor(random * 25) + 5,
        accountAge: Math.floor(random * 365) + 30
    };
}