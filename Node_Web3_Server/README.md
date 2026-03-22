# Node.js WEB3 Server

This document describes the Node.js Engine responsible for:

* Creating invisible wallets for users
* Encrypting & storing keys via Django
* Funding wallets using **L1 → L2 bridging (Sepolia → Lisk)**
* Signing & broadcasting transactions to Lisk
* Providing service‑to‑service APIs only for Django

## A) Node Engine Diagram (Transaction Signing & Wallet Orchestration)

```
[User Request]
       |
       v
[Django API] --(POST /sign-transaction)--> [Node Engine]
       |                                      |
       |                                Decrypt Private Key
       |                                      |
       |                                Sign Transaction
       |                                      |
       |----------------------------------> Submit TX to Blockchain (L1/L2)
```

**Short Description:**

Node Engine is the secure transaction orchestrator. It receives requests from Django, decrypts user keys, signs transactions, and submits them to L1 or L2 blockchains. Users never handle private keys or gas.


---

## 1. Overview

The Node.js Engine acts as the **crypto core** of the HakiChain system.

### 🔵 Django Backend

* Receives wallet creation requests
* Sends encrypted private keys + metadata
* Requests signing of contract transactions

### 🟢 Blockchain Layer

* Sepolia (L1) for the bridge
* Lisk (L2) for execution

> This engine **does NOT talk to the frontend directly**. All requests must pass through Django for authentication.

---

## 2. Environment Variables

| Variable            | Description                             |
| ------------------- | --------------------------------------- |
| `ENCRYPTION_SECRET` | AES secret for encrypting private keys  |
| `DJANGO_API_URL`    | Django endpoint to save wallet metadata |
| `LISK_RPC_URL`      | RPC provider for Lisk L2                |
| `SEPOLIA_RPC_URL`   | RPC provider for Ethereum Sepolia       |
| `MASTER_MNEMONIC`   | Mnemonic used to fund user wallets      |

---

## 3. Core Functional Components

### 3.1 Initialization

* Sets up providers:

  * `masterprovider` (Sepolia)
  * `provider` (Lisk L2)
* Loads the master wallet used for bridging funds

### 3.2 AES Encryption

#### Encrypt Private Key

* Uses AES (CryptoJS)
* Stores encrypted private key in Django

#### Decrypt Private Key

* Used only when signing transactions
* Validates output to avoid corrupt encrypted data

---

## 4. Wallet Generation

### Function: `generateUserWallet()`

Creates a new random EVM-compatible wallet.

Returns:

* `address`
* `publicKey`
* `privateKeyEncrypted`
* `rawPrivateKey` (never stored permanently)

### Flow

1. Wallet generated
2. Private key encrypted
3. Django notified via POST `/create-wallet` flow
4. Wallet funded using bridge

---

## 5. Layer1 → Layer2 Funding (Bridge Logic)

The engine uses the official Lisk L1 bridge contract:

```
function depositETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable
```

### 5.1 Steps Performed

1. Encode bridge call manually using ABI interface
2. Estimate gas
3. Send transaction through master wallet
4. Wait for finalization
5. Poll Lisk L2 until balance appears (exponential backoff)

### 5.2 Wait Logic

`waitForFunds(recipientAddress, requiredAmountBigInt)` polls the L2 balance until bridged ETH arrives.

---

## 6. Transaction Signing & Broadcasting

### Endpoint: `POST /sign-and-send-tx`

Used only by Django.

#### Input

```json
{
  "private_key_encrypted": "...",
  "tx_payload": {"to": "0x...", "data": "0x...", "value": "100000000000000000"},
  "wallet_address": "0x...",
  "user_id": 12
}
```

#### Process

1. Decrypt private key
2. Validate signer address matches expected wallet
3. Build raw transaction
4. Broadcast to Lisk via wallet provider
5. Return transaction hash

#### Output

```json
{
  "success": true,
  "txHash": "0x..."
}
```

---

## 7. Wallet Creation (Service-to-Service)

### Endpoint: `POST /create-wallet`

Triggered by Django after `signup` event.

### Flow

1. Node generates wallet
2. Sends metadata to Django:

   * address
   * public_key
   * private_key_encrypted
3. Bridges **0.001 ETH** to newly created wallet
4. Responds with funding confirmation

### Response

```json
{
  "success": true,
  "wallet_address": "0x...",
  "fundedAmount": "0.01 ETH",
  "txHash": "0x..."
}
```

---

## 8. API Endpoints (Node Engine)

### 1. POST /create-wallet

Creates wallet → stores in Django → funds it via bridge.

### 2. POST /sign-and-send-tx

Signs + broadcasts a custom transaction on Lisk.

> ⚠️ Important: These endpoints **must never** be exposed to the frontend. Only Django backend service should call them.

---

## 9. Security Model

* Raw private keys are **never returned** to any API.
* AES-encrypted key stored only in Django.
* Decryption only happens inside Node.js memory.
* Node.js never logs decrypted keys.
* Only Django backend can request signing.

---

## 10. Server Startup

Default port: `4000`

Logs:

```
Node Web3 Server running on port 4000
```

---

## 11. High-Level Architecture Flow

```
[Django] → /create-wallet → [Node Engine] → Generate Wallet
                                        ↓
                                      Encrypt
                                        ↓
                           Save to Django (wallet metadata)
                                        ↓
                        Bridge funds (Sepolia → Lisk)
                                        ↓
                        Django queries wallet normally

[Frontend]
   ↓ (Auth)
[Django]
   ↓ /sign-transaction
[Node Engine] → Sign + Broadcast → Lisk
```

---

## 12. Summary

This Node.js Engine is the:

* **Vault** (key management)
* **Bridge operator** (L1 → L2 funding)
* **Transaction signer** (contract execution)
* **Backend-only service** (strictly no frontend access)
