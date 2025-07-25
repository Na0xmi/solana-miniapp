// Wallet connection and management
class WalletManager {
    constructor() {
        this.connectedWallet = null;
        this.isDemoMode = false;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for wallet events
        if (window.phantom?.solana) {
            window.phantom.solana.on('connect', () => {
                console.log('Phantom connected');
            });
            
            window.phantom.solana.on('disconnect', () => {
                console.log('Phantom disconnected');
                if (this.connectedWallet?.type === 'phantom') {
                    this.disconnect();
                }
            });
        }
    }

    async connectPhantom() {
        if (this.isDemoMode) {
            this.simulateConnection('phantom', 'Demo-Diogenes-Address-111111111111111');
            return;
        }

        try {
            if (window.app) {
                window.app.updateLoadingState('Connecting to Phantom...', 'Opening wallet...');
            }
            
            if (window.phantom?.solana?.isPhantom) {
                const response = await window.phantom.solana.connect();
                const address = response.publicKey.toString();
                this.setConnectedWallet('phantom', address);
            } else {
                throw new Error('Phantom wallet not found. Please install Phantom from phantom.app');
            }
        } catch (error) {
            if (window.app) {
                window.app.showError(error.message);
            }
            console.error('Phantom connection error:', error);
        } finally {
            if (window.app) {
                window.app.hideLoading();
            }
        }
    }

    async connectSolflare() {
        if (this.isDemoMode) {
            this.simulateConnection('solflare', 'Demo-Nietzsche-Address-555555555555555');
            return;
        }

        try {
            if (window.app) {
                window.app.updateLoadingState('Connecting to Solflare...', 'Opening wallet...');
            }
            
            if (window.solflare?.isSolflare) {
                const response = await window.solflare.connect();
                const address = response.publicKey.toString();
                this.setConnectedWallet('solflare', address);
            } else {
                throw new Error('Solflare wallet not found. Please install Solflare from solflare.com');
            }
        } catch (error) {
            if (window.app) {
                window.app.showError(error.message);
            }
            console.error('Solflare connection error:', error);
        } finally {
            if (window.app) {
                window.app.hideLoading();
            }
        }
    }

    async connectBackpack() {
        if (this.isDemoMode) {
            this.simulateConnection('backpack', 'Demo-Camus-Address-333333333333333');
            return;
        }

        try {
            if (window.app) {
                window.app.updateLoadingState('Connecting to Backpack...', 'Opening wallet...');
            }
            
            if (window.backpack?.isBackpack) {
                const response = await window.backpack.connect();
                const address = response.publicKey.toString();
                this.setConnectedWallet('backpack', address);
            } else {
                throw new Error('Backpack wallet not found. Please install Backpack from backpack.app');
            }
        } catch (error) {
            if (window.app) {
                window.app.showError(error.message);
            }
            console.error('Backpack connection error:', error);
        } finally {
            if (window.app) {
                window.app.hideLoading();
            }
        }
    }

    connectManual() {
        document.getElementById('manualModal').style.display = 'flex';
    }

    closeManualModal() {
        document.getElementById('manualModal').style.display = 'none';
        document.getElementById('manualWalletInput').value = '';
    }

    connectManualWallet() {
        const address = document.getElementById('manualWalletInput').value.trim();
        if (!this.isValidSolanaAddress(address)) {
            alert('Please enter a valid Solana wallet address');
            return;
        }
        
        this.setConnectedWallet('manual', address);
        this.closeManualModal();
    }

    simulateConnection(walletType, address) {
        if (window.app) {
            window.app.updateLoadingState(`Connecting to ${walletType}...`, 'Demo mode connection...');
        }
        setTimeout(() => {
            this.setConnectedWallet(walletType, address);
            if (window.app) {
                window.app.hideLoading();
            }
        }, 1000);
    }

    setConnectedWallet(walletType, address) {
        this.connectedWallet = { type: walletType, address };
        
        document.getElementById('walletDisconnected').style.display = 'none';
        document.getElementById('walletConnected').style.display = 'block';
        document.getElementById('walletAddress').textContent = `${address.slice(0, 8)}...${address.slice(-8)}`;
        
        // Clear any previous results
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
        
        // Make sure wallet section is visible
        document.getElementById('walletSection').style.display = 'block';
    }

    disconnect() {
        this.connectedWallet = null;
        
        document.getElementById('walletDisconnected').style.display = 'block';
        document.getElementById('walletConnected').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
        
        // Show wallet section and card header again when disconnecting
        document.getElementById('walletSection').style.display = 'block';
        const cardHeader = document.querySelector('.card-header');
        if (cardHeader) {
            cardHeader.style.display = 'block';
        }
    }

    isValidSolanaAddress(address) {
        return address && address.length >= 32 && address.length <= 44 && /^[A-Za-z0-9]+$/.test(address);
    }

    setDemoMode(enabled) {
        this.isDemoMode = enabled;
        if (this.connectedWallet) {
            this.disconnect();
        }
    }

    getConnectedWallet() {
        return this.connectedWallet;
    }
}

// Create global wallet instance
window.wallet = new WalletManager();