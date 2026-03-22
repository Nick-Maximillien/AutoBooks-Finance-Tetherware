import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { ethers } from "ethers";
import dotenv from "dotenv";
import cors from "cors"; 

// --- CELO & THIRDWEB IMPORTS ---
import { createThirdwebClient } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";
import { defineChain } from "thirdweb/chains"; 

dotenv.config();

const app = express();

// ==========================================
// 1. ENVIRONMENT VARIABLES & GLOBAL TOGGLE
// ==========================================
const IS_MAINNET = process.env.IS_MAINNET === "true";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC;

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const AGENT_8004_ID = process.env.AGENT_8004_ID || "Node-Relayer-01";

const x402Chain = defineChain(IS_MAINNET ? 42220 : 11142220);

// 1. Split the .env string into an actual array of URLs
const envOrigins = process.env.ALLOWED_ORIGIN 
    ? process.env.ALLOWED_ORIGIN.split(',') 
    : [];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with NO origin (Electron, curl, local files)
        if (!origin || origin === 'null') return callback(null, true);

        // Regex for ANY localhost port (3000, 1420, etc.)
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        // Check against the array we generated from your .env file
        if (envOrigins.includes(origin)) {
            return callback(null, true);
        }

        const msg = `The CORS policy does not allow access from Origin: ${origin}`;
        return callback(new Error(msg), false);
    },
    methods: "POST,GET,OPTIONS", 
    credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

// ==========================================
// 2. MULTICHAIN ROUTER ENGINE (10 CHAINS)
// ==========================================
function getNetworkConfig(networkName) {
    const net = (networkName || "celo").toLowerCase();
    
    let rpcUrl, usdtAddress, chainName, escrowAddress, yieldAddress;

    if (net.includes("ethereum") || net === "sepolia" || net === "ethereum-sepolia") {
        chainName = "Ethereum";
        rpcUrl = IS_MAINNET ? (process.env.ETH_MAINNET_RPC || "https://eth.llamarpc.com") : "https://ethereum-sepolia-rpc.publicnode.com";
        usdtAddress = IS_MAINNET ? "0xdAC17F958D2ee523a2206206994597C13D831ec7" : process.env.ETH_SEPOLIA_USDT || "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"; 
        
        // ✅ NEW: Hardcoded your deployed Sepolia contracts
        escrowAddress = IS_MAINNET ? process.env.TAX_ESCROW_ADDRESS : "0xb904B96259841c92c7F909e2c5e0fdB853573949";
        yieldAddress = IS_MAINNET ? process.env.YIELD_POOL_ADDRESS : "0x9b07b49171a7a75f29720cf82c9ec33b2cb826b4";
    } else if (net.includes("base")) {
        chainName = "Base";
        rpcUrl = IS_MAINNET ? "https://mainnet.base.org" : "https://base-sepolia-rpc.publicnode.com";
        usdtAddress = IS_MAINNET ? "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" : process.env.BASE_SEPOLIA_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("arbitrum")) {
        chainName = "Arbitrum";
        rpcUrl = IS_MAINNET ? "https://arb1.arbitrum.io/rpc" : "https://sepolia-rollup.arbitrum.io/rpc";
        usdtAddress = IS_MAINNET ? "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" : process.env.ARB_SEPOLIA_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("polygon")) {
        chainName = "Polygon";
        rpcUrl = IS_MAINNET ? "https://polygon-rpc.com" : "https://rpc-amoy.polygon.technology";
        usdtAddress = IS_MAINNET ? "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" : process.env.POLYGON_AMOY_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("optimism")) {
        chainName = "Optimism";
        rpcUrl = IS_MAINNET ? "https://mainnet.optimism.io" : "https://sepolia.optimism.io";
        usdtAddress = process.env.OPTIMISM_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("avalanche")) {
        chainName = "Avalanche";
        rpcUrl = IS_MAINNET ? "https://api.avax.network/ext/bc/C/rpc" : "https://api.avax-test.network/ext/bc/C/rpc";
        usdtAddress = process.env.AVALANCHE_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("linea")) {
        chainName = "Linea";
        rpcUrl = IS_MAINNET ? "https://rpc.linea.build" : "https://rpc.sepolia.linea.build";
        usdtAddress = process.env.LINEA_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("scroll")) {
        chainName = "Scroll";
        rpcUrl = IS_MAINNET ? "https://rpc.scroll.io" : "https://sepolia-rpc.scroll.io";
        usdtAddress = process.env.SCROLL_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else if (net.includes("blast")) {
        chainName = "Blast";
        rpcUrl = IS_MAINNET ? "https://rpc.blast.io" : "https://sepolia.blast.l2beat.com";
        usdtAddress = process.env.BLAST_USDT || "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";
    } else {
        chainName = "Celo";
        rpcUrl = IS_MAINNET ? "https://forno.celo.org" : (process.env.CELO_RPC_URL || "https://alfajores-forno.celo-testnet.org");
        usdtAddress = IS_MAINNET ? "0x48065fbBE25f71C9282ddf5e1cD6D6A88248a586" : process.env.CELO_SEPOLIA_USDT || "0x48065fbBE25f71C9282ddf5e1cD6D6A88248a586";
    }

    const fetchReq = new ethers.FetchRequest(rpcUrl);
    fetchReq.timeout = 15000; 
    
    const provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });

    return {
        name: `${chainName} ${IS_MAINNET ? "Mainnet" : "Testnet"}`,
        provider: provider,
        usdtAddress: usdtAddress || process.env.DEFAULT_USDT_ADDRESS,
        escrowAddress: escrowAddress || process.env.TAX_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000",
        yieldAddress: yieldAddress || process.env.YIELD_POOL_ADDRESS || "0x0000000000000000000000000000000000000000"
    };
}

const defaultCeloConfig = getNetworkConfig("celo");
const masterCeloWallet = ethers.Wallet.fromPhrase(MASTER_MNEMONIC).connect(defaultCeloConfig.provider);


// ==========================================
// 3. THIRDWEB x402 PROTOCOL SETUP
// ==========================================
const thirdwebClient = THIRDWEB_SECRET_KEY ? createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY }) : null;
const x402Facilitator = thirdwebClient ? facilitator({
    client: thirdwebClient,
    serverWalletAddress: masterCeloWallet.address, 
}) : null;

// ==========================================
// 4. COMMON ABIs & UTILS
// ==========================================
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address owner) view returns (uint256)"
];

// ✅ NEW: ABIs for data extraction
const TAX_ESCROW_ABI = [
    "function taxDeposits(address) view returns (uint256)",
    "event TaxDeposited(address indexed entity, uint256 amount)"
];

const YIELD_VAULT_ABI = [
    "event LiquidityWithdrawn(address indexed token, address indexed destination, uint256 amount)"
];

// --- ENTRYPOINT ABI (v0.6 used by Tether WDK) ---
const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const ENTRYPOINT_ABI = [
    "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)"
];

// --- PURE WEB3 BROADCASTER (SELF-BUNDLING) ---
async function broadcastSignedPayload(signed_payload, is_user_op, config) {
    if (is_user_op) {
        console.log(`🤖 Node Relayer: Acting as Bundler. Submitting to EntryPoint on ${config.name}...`);
        
        const masterWallet = ethers.Wallet.fromPhrase(MASTER_MNEMONIC).connect(config.provider);
        const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, masterWallet);

        const op = {
            sender: signed_payload.sender,
            nonce: BigInt(signed_payload.nonce),
            initCode: signed_payload.initCode || "0x",
            callData: signed_payload.callData,
            callGasLimit: BigInt(signed_payload.callGasLimit),
            verificationGasLimit: BigInt(signed_payload.verificationGasLimit),
            preVerificationGas: BigInt(signed_payload.preVerificationGas),
            maxFeePerGas: BigInt(signed_payload.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(signed_payload.maxPriorityFeePerGas),
            paymasterAndData: signed_payload.paymasterAndData || "0x",
            signature: signed_payload.signature === "0x" ? "0x" + "00".repeat(65) : signed_payload.signature
        };

        const tx = await entryPoint.handleOps([op], masterWallet.address, {
            gasLimit: 5000000 
        });
        
        console.log(`⏳ Transaction submitted! Hash: ${tx.hash}`);
        console.log(`⏳ Waiting for block inclusion...`);
        
        try {
            await tx.wait();
            console.log(`✅ Transaction confirmed on-chain.`);
        } catch (err) {
            console.log(`⚠️ Transaction reverted on-chain, but hash generated: ${tx.hash}`);
        }

        return tx.hash;
    } else {
        const txResponse = await config.provider.broadcastTransaction(signed_payload);
        return txResponse.hash;
    }
}

// =========================================================
// 5. MASTER TREASURY ACTIONS (Platform-Level Operations)
// =========================================================

app.get("/api/x402/audit-ledger", async (req, res) => {
    if (!x402Facilitator) return res.status(500).json({ error: "Thirdweb x402 not configured." });
    const paymentData = req.headers["payment-signature"] || req.headers["x-payment"];
    try {
        const result = await settlePayment({
            resourceUrl: `${ALLOWED_ORIGIN}/api/x402/audit-ledger`,
            method: "GET",
            paymentData,
            payTo: masterCeloWallet.address,
            network: x402Chain, 
            price: "$0.10", 
            facilitator: x402Facilitator,
        });

        if (result.status === 200) {
            return res.json({ 
                certified_by_agent: AGENT_8004_ID,
                status: "success",
                message: `IFRS Audit Complete. 0.10 stablecoin fee received.`,
                data: { warning: "Sample data" } 
            });
        } else {
            return res.status(result.status).set(result.responseHeaders).json(result.responseBody);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/request-liquidity", async (req, res) => {
    try {
        const { wallet_address, amount_usdt, network } = req.body; 
        if (!wallet_address || !amount_usdt) return res.status(400).json({ error: "Missing agent wallet or loan amount" });

        const config = getNetworkConfig(network);
        console.log(`🏦 Protocol Lending: Disbursing ${amount_usdt} USDT to ${wallet_address} on ${config.name}`);

        const masterWallet = ethers.Wallet.fromPhrase(MASTER_MNEMONIC).connect(config.provider);
        const usdtContract = new ethers.Contract(config.usdtAddress, ERC20_ABI, masterWallet);

        const parsedAmount = ethers.parseUnits(amount_usdt.toString(), 6);
        const usdtTx = await usdtContract.transfer(wallet_address, parsedAmount);
        await usdtTx.wait();

        console.log(`✅ Loan Disbursed! Hash: ${usdtTx.hash}`);
        return res.json({ success: true, txHash: usdtTx.hash });

    } catch (err) {
        console.error("❌ Lending Disbursement Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// TREASURY BALANCE CHECKER
// ==========================================
app.get("/wallet-balance/:address/:network", async (req, res) => {
    try {
        const config = getNetworkConfig(req.params.network);
        
        const usdtContract = new ethers.Contract(config.usdtAddress, ERC20_ABI, config.provider);
        const balance = await usdtContract.balanceOf(req.params.address);
        const formattedBalance = ethers.formatUnits(balance, 6);
        
        res.json({ balance: formattedBalance });
    } catch (err) {
        console.error("❌ Balance Fetch Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ✅ NEW: DEFI ANALYTICS ENDPOINTS
// ==========================================
app.get("/api/defi/tax-escrow/:walletAddress/:network", async (req, res) => {
    try {
        const { walletAddress, network } = req.params;
        const config = getNetworkConfig(network);
        
        if (!config.escrowAddress || config.escrowAddress === "0x0000000000000000000000000000000000000000") {
            return res.status(400).json({ error: "Tax Escrow address not configured for this network." });
        }

        const escrowContract = new ethers.Contract(config.escrowAddress, TAX_ESCROW_ABI, config.provider);
        
        // 1. Get Current Total Escrowed
        const rawBalance = await escrowContract.taxDeposits(walletAddress);
        const totalEscrowed = ethers.formatUnits(rawBalance, 6); // Assuming 6 decimals for USDT

        // 2. Get Historical Event Logs
        const filter = escrowContract.filters.TaxDeposited(walletAddress);
        const currentBlock = await config.provider.getBlockNumber();
        const logs = await escrowContract.queryFilter(filter, currentBlock - 100000, "latest");

        const history = await Promise.all(logs.map(async (log) => {
            const block = await log.getBlock();
            return {
                txHash: log.transactionHash,
                amount: ethers.formatUnits(log.args[1], 6),
                timestamp: block.timestamp * 1000,
                date: new Date(block.timestamp * 1000).toISOString()
            };
        }));

        res.json({
            vault_address: walletAddress,
            contract_address: config.escrowAddress,
            total_escrowed_usdt: totalEscrowed,
            history: history.reverse() // Newest first
        });

    } catch (err) {
        console.error("❌ Tax Escrow Analytics Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/defi/yield-vault/:walletAddress/:network", async (req, res) => {
    try {
        const { walletAddress, network } = req.params;
        const config = getNetworkConfig(network);
        
        if (!config.yieldAddress || config.yieldAddress === "0x0000000000000000000000000000000000000000") {
            return res.status(400).json({ error: "Yield Vault address not configured." });
        }

        const usdtContract = new ethers.Contract(config.usdtAddress, ERC20_ABI, config.provider);
        const yieldContract = new ethers.Contract(config.yieldAddress, YIELD_VAULT_ABI, config.provider);

        // 1. Get Total Active Yield
        const rawBalance = await usdtContract.balanceOf(config.yieldAddress);
        const activeYield = ethers.formatUnits(rawBalance, 6);

        // 2. Get Withdrawal Events
        const filter = yieldContract.filters.LiquidityWithdrawn(null, walletAddress);
        const currentBlock = await config.provider.getBlockNumber();
        const logs = await yieldContract.queryFilter(filter, currentBlock - 100000, "latest");

        const history = await Promise.all(logs.map(async (log) => {
            const block = await log.getBlock();
            return {
                txHash: log.transactionHash,
                amount: ethers.formatUnits(log.args[2], 6),
                token: log.args[0],
                timestamp: block.timestamp * 1000,
                date: new Date(block.timestamp * 1000).toISOString()
            };
        }));

        res.json({
            vault_address: walletAddress,
            yield_contract: config.yieldAddress,
            total_active_yield_usdt: activeYield,
            withdrawal_history: history.reverse()
        });

    } catch (err) {
        console.error("❌ Yield Analytics Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================================
// 6. ECONOMIC BEHAVIORS (RELAYED FROM OPENCLAW)
// =========================================================

app.post("/web3/settle-bill", async (req, res) => {
    try {
        const { signed_payload, network, is_user_op } = req.body;
        const config = getNetworkConfig(network);
        
        console.log(`🤖 Relaying signed UserOperation for Vault: ${signed_payload.sender || 'Unknown'}`);

        const txHash = await broadcastSignedPayload(signed_payload, is_user_op, config);

        res.json({ success: true, txHash: txHash, network: config.name, agent_id: AGENT_8004_ID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/web3/batch-payroll", async (req, res) => {
    try {
        const { signed_payload, network, is_user_op } = req.body;
        const config = getNetworkConfig(network);
        
        console.log(`🤖 Relaying signed batch-payroll UserOperation for Vault: ${signed_payload.sender || 'Unknown'}`);

        const txHash = await broadcastSignedPayload(signed_payload, is_user_op, config);

        res.json({ success: true, txHash: txHash, agent_id: AGENT_8004_ID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/web3/distribute-dividends", async (req, res) => {
    try {
        const { signed_payload, network, is_user_op } = req.body;
        const config = getNetworkConfig(network);
        
        console.log(`🤖 Relaying signed dividend distribution for Vault: ${signed_payload.sender || 'Unknown'}`);

        const txHash = await broadcastSignedPayload(signed_payload, is_user_op, config);

        res.json({ success: true, txHash: txHash, agent_id: AGENT_8004_ID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/web3/fund-tax-escrow", async (req, res) => {
    try {
        const { signed_payload, network, is_user_op } = req.body;
        const config = getNetworkConfig(network);
        
        console.log(`🤖 Relaying signed transaction locking funds into Tax Escrow for Vault: ${signed_payload.sender || 'Unknown'}`);

        const txHash = await broadcastSignedPayload(signed_payload, is_user_op, config);

        res.json({ success: true, txHash: txHash, escrow_vault: config.escrowAddress });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/web3/deploy-yield", async (req, res) => {
    try {
        const { signed_payload, network, is_user_op } = req.body;
        const config = getNetworkConfig(network);
        
        console.log(`🤖 Relaying signed transaction deploying funds to Yield Pool for Vault: ${signed_payload.sender || 'Unknown'}`);

        const txHash = await broadcastSignedPayload(signed_payload, is_user_op, config);

        res.json({ success: true, txHash: txHash, protocol: config.yieldAddress });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/relay-transaction", async (req, res) => {
    try {
        const { signed_tx, signed_payload, network, is_user_op } = req.body;
        const payloadToRelay = signed_payload || signed_tx;
        const config = getNetworkConfig(network);

        console.log(`📡 Relaying generic transaction to ${config.name}...`);
        
        const txHash = await broadcastSignedPayload(payloadToRelay, is_user_op, config);

        console.log(`✅ Broadcast Successful. Hash: ${txHash}`);
        res.json({ success: true, txHash: txHash, network: config.name });

    } catch (err) {
        console.error("❌ Relayer Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "node-web3-router", is_mainnet: IS_MAINNET });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Node Web3 Router running on port ${PORT} [Mode: ${IS_MAINNET ? "MAINNET" : "TESTNET"}]`);
});