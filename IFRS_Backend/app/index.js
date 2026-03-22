import express from "express";
import bodyParser from "body-parser";
import CryptoJS from "crypto-js";
import fetch from "node-fetch";
import { ethers } from "ethers";
import dotenv from "dotenv";
import cors from "cors"; 

// --- NEW CELO & THIRDWEB IMPORTS ---
import { createThirdwebClient } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";
import { celoAlfajores } from "thirdweb/chains"; // Changed to Alfajores Testnet

dotenv.config();

const app = express();

// ==========================================
// 1. ENVIRONMENT VARIABLES (Existing + Celo)
// ==========================================
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const DJANGO_API_URL = process.env.DJANGO_API_URL;
const LISK_RPC_URL = process.env.LISK_RPC_URL;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

// --- CELO TESTNET (ALFAJORES) CONFIGS ---
// Fallbacks are now set directly to the Alfajores Testnet
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://alfajores-forno.celo-testnet.org";
const CUSD_ADDRESS = process.env.CUSD_CONTRACT_ADDRESS || "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"; // Alfajores cUSD
const CKES_ADDRESS = process.env.CKES_CONTRACT_ADDRESS || "0x456a3D042C0A57588b394A7086dbEeA7DFEE325b"; // Mock/Testnet cKES
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const AGENT_8004_ID = process.env.AGENT_8004_ID || "35255";
const TAX_ESCROW_ADDRESS = process.env.TAX_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000"; // Replace with your testnet vault
const YIELD_POOL_ADDRESS = process.env.YIELD_POOL_ADDRESS || "0x0000000000000000000000000000000000000000"; // Replace with testnet pool

// ------------------ CORS CONFIGURATION ------------------
const corsOptions = {
    origin: ALLOWED_ORIGIN, 
    methods: "POST,GET,OPTIONS", 
    credentials: true,
};

app.use(bodyParser.json());
app.use(cors(corsOptions));

// ------------------ PROVIDERS & MASTER WALLET ------------------
const masterprovider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const provider = new ethers.JsonRpcProvider(LISK_RPC_URL);
const celoProvider = new ethers.JsonRpcProvider(CELO_RPC_URL); // Celo Alfajores Provider

const masterWallet = ethers.Wallet.fromPhrase(MASTER_MNEMONIC).connect(masterprovider);
console.log("Master wallet initialized:", masterWallet.address);

// ==========================================
// 2. THIRDWEB x402 PROTOCOL SETUP
// ==========================================
const thirdwebClient = THIRDWEB_SECRET_KEY ? createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY }) : null;
const x402Facilitator = thirdwebClient ? facilitator({
    client: thirdwebClient,
    serverWalletAddress: masterWallet.address, 
}) : null;

// ==========================================
// 3. COMMON ABIs & UTILS
// ==========================================
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)"
];

const L1_BRIDGE_CONTRACT_ADDRESS = process.env.L1_BRIDGE_CONTRACT_ADDRESS;
const L1_BRIDGE_ABI = [
    "function depositETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable" 
];

function bigIntReplacer(key, value) {
    if (typeof value === "bigint") return value.toString();
    return value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// ==========================================
// 4. LISK L2 BRIDGING LOGIC (Unchanged)
// ==========================================
async function waitForFunds(recipientAddress, requiredAmountBigInt, maxRetries = 20) {                                                       
    console.log(`⏳ Waiting for funds to appear on Lisk L2 for ${recipientAddress}...`);
    for (let i = 0; i < maxRetries; i++) {
        try {
            const balance = await provider.getBalance(recipientAddress);
            if (balance >= requiredAmountBigInt) {
                console.log(`Funds received on Lisk L2. Balance: ${ethers.formatEther(balance)} ETH`);
                return true;
            }
        } catch (error) {
            console.warn(`Warning during balance check (attempt ${i + 1}): ${error.message}`);
        }
        const delay = Math.min(2000 * (2 ** i), 90000); 
        console.log(`   Balance insufficient. Retrying in ${delay / 1000} seconds...`);
        await sleep(delay);
    }
    throw new Error(`Timeout: Bridged funds never appeared on Lisk L2 for ${recipientAddress}.`);
}

async function fundWallet(recipientAddress, amountInETH = "0.01") {
    console.log("\n========================");
    console.log("🚀 Starting fundWallet()");
    console.log("========================");

    try {
        console.log(`→ Target Recipient: ${recipientAddress}`);
        console.log(`→ Requested Amount: ${amountInETH} ETH`);

        const depositValue = ethers.parseEther(amountInETH);
        const L2_MIN_GAS_LIMIT = 600_000;
        const extraData = "0x";

        console.log(`📌 Step 1: Constants`);
        console.log(`   • L2_MIN_GAS_LIMIT: ${L2_MIN_GAS_LIMIT}`);
        console.log(`   • depositValue (wei): ${depositValue}`);

        console.log(`📌 Step 2: Manually encoding depositETHTo function call...`);
        const txData = l1BridgeContract.interface.encodeFunctionData(
            "depositETHTo",
            [recipientAddress, L2_MIN_GAS_LIMIT, extraData]
        );
        console.log(`   • Encoded Data: ${txData.substring(0, 50)}...`);

        let gasEstimate;
        try {
            const estimateTx = {
                to: L1_BRIDGE_CONTRACT_ADDRESS,
                from: masterWallet.address,
                data: txData,
                value: depositValue,
            };
            gasEstimate = await masterprovider.estimateGas(estimateTx);
            console.log(`📌 Step 3: Gas estimate: ${gasEstimate.toString()}`);
        } catch (e) {
            console.warn("   ❗ Gas estimation failed. Using fallback gas limit:", 350_000n);
            gasEstimate = 350_000n;
        }

        console.log("📌 Step 4: Sending raw transaction to bridge...");
        const rawTx = {
            to: L1_BRIDGE_CONTRACT_ADDRESS,
            data: txData,
            value: depositValue,
            gasLimit: gasEstimate,
        };
        
        const txResponse = await masterWallet.sendTransaction(rawTx);

        console.log("   ✔ Transaction sent");
        console.log(`   • Hash: ${txResponse.hash}`);
        console.log(`   • Nonce: ${txResponse.nonce}`);
        console.log(`   • Value: ${txResponse.value}`);

        const receipt = await txResponse.wait();
        if (receipt.status !== 1) {
            throw new Error(`Transaction failed on-chain (status 0). Receipt: ${JSON.stringify(receipt, bigIntReplacer)}`);
        }

        console.log("   ✔ Transaction confirmed on Sepolia!");
        console.log(`   • Block Number: ${receipt.blockNumber}`);
        console.log(`   • Gas Used: ${receipt.gasUsed.toString()}`);

        await waitForFunds(recipientAddress, depositValue);

        console.log("\n🎉 DONE: Bridge + L2 balance updated.");
        console.log("========================\n");

        return receipt;
    } catch (err) {
        console.error("\n❌ ERROR IN fundWallet():", err);
        console.log("========================\n");
        throw err;
    }
}

function encryptPrivateKey(privateKey) {
    return CryptoJS.AES.encrypt(privateKey, ENCRYPTION_SECRET).toString();
}

function generateUserWallet() {
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);

    console.log(" Generated user wallet:");
    console.log("   Address:", wallet.address);
    console.log("   Public Key:", wallet.publicKey);
    console.log("   Raw Private Key:", wallet.privateKey);
    console.log("   Encrypted Private Key:", encryptedPrivateKey);

    return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKeyEncrypted: encryptedPrivateKey,
        rawPrivateKey: wallet.privateKey,
    };
}

function decryptPrivateKey(encryptedPrivateKey) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, ENCRYPTION_SECRET);
        if (bytes.sigBytes === 0) {
            throw new Error("Decryption resulted in empty bytes (bad secret or data)");
        }
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Decryption error: Invalid key or data.");
    }
}

// ============================================================
// 5. THE SOVEREIGN CFO: CELO ECONOMIC BEHAVIORS (ALFAJORES)
// ============================================================

// BEHAVIOR 5: A2A Invoice Factoring / Ledger Monetization via x402
app.get("/api/x402/audit-ledger", async (req, res) => {
    if (!x402Facilitator) return res.status(500).json({ error: "Thirdweb x402 not configured." });

    const paymentData = req.headers["payment-signature"] || req.headers["x-payment"];
    
    try {
        const result = await settlePayment({
            resourceUrl: `${ALLOWED_ORIGIN}/api/x402/audit-ledger`,
            method: "GET",
            paymentData,
            payTo: masterWallet.address,
            network: celoAlfajores, // Changed to testnet
            price: "$0.10", // The agent charges $0.10 in testnet stablecoins
            facilitator: x402Facilitator,
        });

        if (result.status === 200) {
            console.log(`💰 Agent ${AGENT_8004_ID}: x402 Payment cleared on Alfajores. Releasing audited ledger.`);
            // Mock or proxy fetch from Django here
            return res.json({ 
                certified_by_agent: AGENT_8004_ID,
                status: "success",
                message: "IFRS Audit Complete. 0.10 cUSD fee received on Testnet.",
                data: { warning: "Sample data" } 
            });
        } else {
            // Rejects request and sends HTTP 402 Payment Required headers to client
            return res.status(result.status).set(result.responseHeaders).json(result.responseBody);
        }
    } catch (err) {
        console.error("x402 Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// BEHAVIOR 1 & 2: Autonomous Bill Settlement & Real-Time FX Hedging
app.post("/celo/settle-bill", async (req, res) => {
    try {
        const { private_key_encrypted, vendor_wallet, amount, currency } = req.body;
        console.log(`🤖 Agent ${AGENT_8004_ID} initiating ${amount} ${currency} payment to ${vendor_wallet} on Alfajores`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, celoProvider);
        
        // Select Token Address based on Currency (FX routing logic)
        const tokenAddress = currency === "cKES" ? CKES_ADDRESS : CUSD_ADDRESS;
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signerWallet);

        const parsedAmount = ethers.parseUnits(amount.toString(), 18);
        const txResponse = await tokenContract.transfer(vendor_wallet, parsedAmount);
        const receipt = await txResponse.wait();

        res.json({ success: true, txHash: receipt.hash, network: "Celo Alfajores Testnet", agent_id: AGENT_8004_ID });
    } catch (err) {
        console.error("❌ Settlement Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// BEHAVIOR 3: Micro-Payroll Distribution via MiniPay
app.post("/celo/batch-payroll", async (req, res) => {
    try {
        const { private_key_encrypted, payroll_array } = req.body;
        // payroll_array format: [{ wallet: "0x...", amount: "50.00" }, ...]
        
        console.log(`🤖 Agent ${AGENT_8004_ID} executing testnet micro-payroll for ${payroll_array.length} employees.`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, celoProvider);
        const cUSDTontract = new ethers.Contract(CUSD_ADDRESS, ERC20_ABI, signerWallet);

        let txHashes = [];
        let nonce = await celoProvider.getTransactionCount(signerWallet.address);

        // Sequential execution to prevent nonce collision
        for (const employee of payroll_array) {
            const parsedAmount = ethers.parseUnits(employee.amount.toString(), 18);
            const txResponse = await cUSDTontract.transfer(employee.wallet, parsedAmount, { nonce: nonce++ });
            txHashes.push({ employee: employee.wallet, hash: txResponse.hash });
            console.log(`💸 Paid ${employee.amount} cUSD to ${employee.wallet}`);
        }

        res.json({ success: true, transactions: txHashes, agent_id: AGENT_8004_ID });
    } catch (err) {
        console.error("❌ Payroll Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// BEHAVIOR 6: Shareholder Dividend Distribution
app.post("/celo/distribute-dividends", async (req, res) => {
    try {
        const { private_key_encrypted, shareholders_array } = req.body;
        // shareholders_array format: [{ wallet: "0x...", amount: "1500.00" }, ...]
        
        console.log(`🤖 Agent ${AGENT_8004_ID} distributing dividends to ${shareholders_array.length} shareholders.`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, celoProvider);
        const cUSDTontract = new ethers.Contract(CUSD_ADDRESS, ERC20_ABI, signerWallet);

        let txHashes = [];
        let nonce = await celoProvider.getTransactionCount(signerWallet.address);

        for (const owner of shareholders_array) {
            const parsedAmount = ethers.parseUnits(owner.amount.toString(), 18);
            const txResponse = await cUSDTontract.transfer(owner.wallet, parsedAmount, { nonce: nonce++ });
            txHashes.push({ owner: owner.wallet, hash: txResponse.hash });
            console.log(`💼 Dividend paid: ${owner.amount} cUSD to ${owner.wallet}`);
        }

        res.json({ success: true, transactions: txHashes, agent_id: AGENT_8004_ID });
    } catch (err) {
        console.error("❌ Dividend Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// BEHAVIOR 4: Immutable Tax Escrow
app.post("/celo/fund-tax-escrow", async (req, res) => {
    try {
        const { private_key_encrypted, tax_amount } = req.body;
        console.log(`🤖 Agent ${AGENT_8004_ID} locking ${tax_amount} into Alfajores Tax Escrow.`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, celoProvider);
        const cUSDTontract = new ethers.Contract(CUSD_ADDRESS, ERC20_ABI, signerWallet);

        const parsedAmount = ethers.parseUnits(tax_amount.toString(), 18);
        const txResponse = await cUSDTontract.transfer(TAX_ESCROW_ADDRESS, parsedAmount);
        const receipt = await txResponse.wait();

        res.json({ success: true, txHash: receipt.hash, escrow_vault: TAX_ESCROW_ADDRESS });
    } catch (err) {
        console.error("❌ Tax Escrow Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// BEHAVIOR 1 (Treasury part): Yield Farming Deployment
app.post("/celo/deploy-yield", async (req, res) => {
    try {
        const { private_key_encrypted, amount_to_deploy } = req.body;
        console.log(`🤖 Agent ${AGENT_8004_ID} deploying ${amount_to_deploy} cUSD to Testnet Yield Pool.`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, celoProvider);
        const cUSDTontract = new ethers.Contract(CUSD_ADDRESS, ERC20_ABI, signerWallet);

        const parsedAmount = ethers.parseUnits(amount_to_deploy.toString(), 18);
        
        // 1. Approve Yield Pool to spend cUSD
        const approveTx = await cUSDTontract.approve(YIELD_POOL_ADDRESS, parsedAmount);
        await approveTx.wait();

        // 2. In production, you would call the specific deposit() function on the Yield Pool ABI here.
        const txResponse = await cUSDTontract.transfer(YIELD_POOL_ADDRESS, parsedAmount);
        const receipt = await txResponse.wait();

        res.json({ success: true, txHash: receipt.hash, protocol: YIELD_POOL_ADDRESS });
    } catch (err) {
        console.error("❌ Yield Deployment Error:", err);
        res.status(500).json({ error: err.message });
    }
});


// ============================================================
// 6. EXISTING LISK & DJANGO ENDPOINTS
// ============================================================

app.post("/sign-and-send-tx", async (req, res) => {
    try {
        const { private_key_encrypted, tx_payload, wallet_address, user_id } = req.body;

        if (!private_key_encrypted || !tx_payload || !wallet_address) {
            return res.status(400).json({ error: "Missing required signing fields (key, payload, or address)" });
        }

        console.log(`🔑 Decrypting key and preparing transaction for user ${user_id}...`);

        const privateKey = decryptPrivateKey(private_key_encrypted);
        const signerWallet = new ethers.Wallet(privateKey, provider);

        if (signerWallet.address.toLowerCase() !== wallet_address.toLowerCase()) {
            throw new Error(`Wallet address mismatch! Expected ${wallet_address}, got ${signerWallet.address} after decryption.`);
        }

        const tx = {
            to: tx_payload.to,
            data: tx_payload.data,
            value: tx_payload.value ? ethers.getBigInt(tx_payload.value) : ethers.getBigInt(0),
        };

        console.log(`📝 Sending transaction: ${JSON.stringify(tx, bigIntReplacer)}`);
        const txResponse = await signerWallet.sendTransaction(tx);
        console.log("Tx Sent. Waiting for confirmation...");

        const receipt = await txResponse.wait();
        if (receipt.status !== 1) {
            return res.status(500).json({ error: "Transaction reverted on chain.", txHash: receipt.hash });
        }

        console.log(`✅ Transaction confirmed: ${receipt.hash}`);
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        console.error("❌ Sign and Send Error:", err);
        res.status(500).json({ error: err.message, type: "SigningError" });
    }
});

app.post("/create-wallet", async (req, res) => {
    try {
        const { userId, email } = req.body;
        if (!userId || !email) {
            return res.status(400).json({ error: "Missing userId or email" });
        }

        const userWallet = generateUserWallet();
        console.log(`📤 Sending wallet info to Django for user ${userId} (${email})`);

        const djangoResponse = await fetch(DJANGO_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                email,
                wallet_address: userWallet.address,
                public_key: userWallet.publicKey,
                private_key_encrypted: userWallet.privateKeyEncrypted,
            }),
        });

        if (!djangoResponse.ok) {
            const text = await djangoResponse.text();
            return res.status(500).json({ error: "Failed to save wallet in Django", details: text });
        }

        const receipt = await fundWallet(userWallet.address, "0.01");

        console.log("💰 Wallet funding complete:", {
            userWallet: userWallet.address,
            masterWallet: masterWallet.address,
            amountSent: "0.01 ETH (Bridged)",
            txHash: receipt.hash,
        });

        res.json({
            success: true,
            wallet_address: userWallet.address,
            fundedAmount: "0.01 ETH",
            txHash: receipt.hash,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "node-wallet-engine" });
});

// ------------------ Start Server ------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Multi-Chain Web3 Router running on port ${PORT}`);
});