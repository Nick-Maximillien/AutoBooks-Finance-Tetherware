import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Utility to recursively convert BigInt values to strings for JSON serialization.
 */
const stringifyBigInts = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

/**
 * Keystore Retrieval (GET)
 * Checks for the existence of the local keystore and returns public account metadata.
 */
export async function GET() {
  try {
    const keystorePath = path.join(process.cwd(), '.claware_keystore');
    if (!fs.existsSync(keystorePath)) return NextResponse.json({ exists: false });
    
    const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    return NextResponse.json({ 
        exists: true, 
        publicAddress: keystore.smart_account_address || keystore.address, 
        signerAddress: keystore.address, 
        encryptedSeed: keystore.encrypted_seed 
    });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}

/**
 * Keystore Update (PUT)
 * Persists encrypted seed phrases and associated smart account addresses to the filesystem.
 */
export async function PUT(req: Request) {
  try {
    const { encryptedSeed, publicAddress, smartAccountAddress } = await req.json();
    const keystorePath = path.join(process.cwd(), '.claware_keystore');
    
    fs.writeFileSync(keystorePath, JSON.stringify({ 
        address: publicAddress, 
        smart_account_address: smartAccountAddress, 
        encrypted_seed: encryptedSeed, 
        updated_at: new Date().toISOString() 
    }, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}

/**
 * Enclave Signing and Transaction Relaying (POST)
 * Handles decryption of the seed, EIP-4337 UserOperation construction, 
 * signature generation, and broadcasting to the Node Relayer.
 */
export async function POST(req: Request) {
  try {
    console.log("--- DETETHERED ENCLAVE SIGNING ---");
    const { encryptedSeed, pin, rawPayload, action } = await req.json();
    
    const bytes = CryptoJS.AES.decrypt(encryptedSeed, pin);
    const seedPhrase = bytes.toString(CryptoJS.enc.Utf8);
    if (!seedPhrase || seedPhrase.split(' ').length < 12) throw new Error("Invalid PIN");

    /**
     * Supported Network Configuration Registry
     */
    const chainMap: Record<string, { id: number; rpc: string }> = {
      "ethereum-sepolia": { id: 11155111, rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
      "base-sepolia": { id: 84532, rpc: "https://base-sepolia-rpc.publicnode.com" },
      "arbitrum-sepolia": { id: 421614, rpc: "https://sepolia-rollup.arbitrum.io/rpc" },
      "polygon-amoy": { id: 80002, rpc: "https://rpc-amoy.polygon.technology" },
      "optimism-sepolia": { id: 11155420, rpc: "https://sepolia.optimism.io" },
      "avalanche-fuji": { id: 43113, rpc: "https://api.avax-test.network/ext/bc/C/rpc" },
      "celo-sepolia": { id: 44787, rpc: "https://forno.celo-sepolia.celo-testnet.org" },
      "linea-sepolia": { id: 59141, rpc: "https://rpc.sepolia.linea.build" },
      "scroll-sepolia": { id: 534351, rpc: "https://sepolia-rpc.scroll.io" },
      "blast-sepolia": { id: 168587773, rpc: "https://sepolia.blast.l2beat.com" }
    };

    const payloadObj = rawPayload ? (typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload) : null;
    const targetNetwork = (payloadObj?.network || "ethereum-sepolia").toLowerCase();
    const config = chainMap[targetNetwork] || chainMap["ethereum-sepolia"];

    console.log("\n[1] Received Unsigned Payload:\n", JSON.stringify(payloadObj, null, 2));

    /**
     * WDK Wallet Module Initialization
     */
    const WDKModule = await import('@tetherto/wdk-wallet-evm-erc-4337');
    const walletManager = new (WDKModule.default)(seedPhrase, {
      chainId: config.id, 
      provider: config.rpc, 
      entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      safeModulesVersion: "0.2.0", 
      bundlerUrl: config.rpc, 
      isSponsored: false, 
      useNativeCoins: true 
    } as any);
    
    const smartAccount = await walletManager.getAccount(0);
    const saAddress = await (smartAccount as any).getAddress();

    if (action === "derive") return NextResponse.json({ success: true, smartAccountAddress: saAddress });

    const nonce = 0; 
    console.log(`\n[2] Constructing WDK SafeOperation for Vault: ${saAddress}`);
    
    const signedSafeOp = await (smartAccount as any).sendTransaction(payloadObj.transactions, { nonce });
    let finalUserOp = stringifyBigInts(signedSafeOp.userOperation);

    /**
     * Manual Signature Validation and Generation
     * Ensures compatibility with AA24 requirements by signing the native digest
     * if the SDK-generated signature is missing or invalid.
     */
    if (finalUserOp.signature === "0x" || !finalUserOp.signature) {
        console.log("Validating Native Digest Signature...");
        const { ethers } = await import('ethers');
        const localWallet = ethers.Wallet.fromPhrase(seedPhrase);

        const safeOpHash = await (signedSafeOp as any).getHash();
        const signature = localWallet.signingKey.sign(safeOpHash);

        const formattedSig = ethers.concat([
            signature.r,
            signature.s,
            ethers.toBeHex(signature.v)
        ]);

        const validAfter = (signedSafeOp as any).options.validAfter || 0;
        const validUntil = (signedSafeOp as any).options.validUntil || 0;

        finalUserOp.signature = ethers.solidityPacked(
            ["uint48", "uint48", "bytes"],
            [validAfter, validUntil, formattedSig]
        );
        console.log("Signature generated successfully.");
    }

    console.log("\n[3] Generated Signed Payload (UserOperation):\n", JSON.stringify(finalUserOp, null, 2));

    /**
     * Relaying to Bundler/Node Server
     */
    const endpoints: Record<string, string> = { 
      "settle-bill": "/web3/settle-bill", 
      "batch-payroll": "/web3/batch-payroll",
      "fund-tax-escrow": "/web3/fund-tax-escrow",
      "deploy-yield": "/web3/deploy-yield",
      "dividend-payout": "/web3/distribute-dividends"
    };

    const targetEndpoint = endpoints[payloadObj.intent as keyof typeof endpoints] || "/api/relay-transaction";
    
    console.log(`\n[4] Relaying to Node Bundler: ${targetEndpoint}`);

    const relayRes = await fetch(`https://node-web3-server.onrender.com${targetEndpoint}`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ...payloadObj, 
        signed_payload: finalUserOp, 
        is_user_op: true, 
        network_rpc: config.rpc 
      })
    });

    const relayData = await relayRes.json();
    
    if (!relayRes.ok) {
        throw new Error(`Relayer failed: ${relayData.error || 'Unknown error'}`);
    }

    console.log("\n[5] Node Relay Success. Response:\n", JSON.stringify(relayData, null, 2));
    console.log("--- ENCLAVE SUCCESS: RELAYED ---");
    
    return NextResponse.json({ success: true, txHash: relayData.txHash, smartAccountAddress: saAddress });

  } catch (error: any) {
    console.error("\nEnclave Signer Error:\n", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}