"""
Web3 Integration Layer for Django <-> Node.js Web3 Bridge
Handles all Web3 blockchain interactions for 10 chains.
Encodes raw transaction data for the local OpenClaw Dumb Signer.
"""
import os
import requests
import logging
from decimal import Decimal
from typing import Dict, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

# --- Configuration ---
WEB3_API_URL = os.environ.get("WEB3_API_URL", "http://localhost:4000")
WEB3_TIMEOUT = int(os.environ.get("WEB3_TIMEOUT", "30"))

class Web3Error(Exception):
    """Custom exception for web3 integration errors"""
    pass

class Web3Agent:
    """
    Stateless Web3 Controller for Autobooks Finance.
    - Generates encoded transaction payloads for the local "Dumb Signer".
    - Handles ERC20 encoding and Contract Address mapping for 10 chains.
    """
    def __init__(self, wallet_address: str):
        self.wallet_address = wallet_address
        
        # Standard Aave-faucet USDT used across most Sepolia testnets
        std_usdt = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"
        
        # Full 10-Chain Registry mapping 
        self.registry = {
            "ethereum-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": "0xb904B96259841c92c7F909e2c5e0fdB853573949",
                "yield_vault": "0x9b07b49171a7a75f29720cf82c9ec33b2cb826b4"
            },
            "base-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_BASE_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_BASE_SEPOLIA", "0x000...")
            },
            "arbitrum-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_ARB_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_ARB_SEPOLIA", "0x000...")
            },
            "polygon-amoy": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_POLYGON_AMOY", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_POLYGON_AMOY", "0x000...")
            },
            "optimism-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_OPT_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_OPT_SEPOLIA", "0x000...")
            },
            "avalanche-fuji": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_AVAX_FUJI", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_AVAX_FUJI", "0x000...")
            },
            "celo-alfajores": {
                "usdt": "0x48065fbBE25f71C9282ddf5e1cD6D6A88248a586", 
                "tax_escrow": os.environ.get("TAX_ESCROW_CELO_ALFAJORES", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_CELO_ALFAJORES", "0x000...")
            },
            "linea-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_LINEA_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_LINEA_SEPOLIA", "0x000...")
            },
            "scroll-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_SCROLL_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_SCROLL_SEPOLIA", "0x000...")
            },
            "blast-sepolia": {
                "usdt": std_usdt,
                "tax_escrow": os.environ.get("TAX_ESCROW_BLAST_SEPOLIA", "0x000..."),
                "yield_vault": os.environ.get("YIELD_VAULT_BLAST_SEPOLIA", "0x000...")
            }
        }

    def _get_config(self, network: str):
        net = network.lower()
        if net == "sepolia" or net == "ethereum": net = "ethereum-sepolia"
        return self.registry.get(net, self.registry["ethereum-sepolia"])

    def _encode_erc20_transfer(self, recipient: str, amount: float, decimals: int = 6) -> str:
        """Encodes transfer(address,uint256) data for USDT."""
        method_id = "0xa9059cbb"
        address_padded = recipient.lower().replace("0x", "").zfill(64)
        amount_wei = int(float(amount) * (10 ** decimals))
        amount_hex = hex(amount_wei)[2:].zfill(64)
        return f"{method_id}{address_padded}{amount_hex}"

    # =========================================================================
    # 1. ENCODED INTENTS (For Dumb Enclave Signature)
    # =========================================================================

    def build_settle_bill_intent(self, vendor_wallet: str, amount: float, currency: str = "USDT", network: str = "celo-sepolia") -> Dict:
        config = self._get_config(network)
        
        if currency == "USDT":
            tx = {
                "to": config["usdt"],
                "value": "0",
                "data": self._encode_erc20_transfer(vendor_wallet, amount)
            }
        else:
            tx = {
                "to": vendor_wallet,
                "value": str(int(amount * 10**18)),
                "data": "0x"
            }
            
        return {
            "intent": "settle-bill",
            "network": network,
            "transactions": [tx]
        }

    def build_batch_payroll_intent(self, payroll_array: List[Dict], description: str = "", network: str = "celo-sepolia") -> Dict:
        config = self._get_config(network)
        transactions = []
        
        for emp in payroll_array:
            transactions.append({
                "to": config["usdt"],
                "value": "0",
                "data": self._encode_erc20_transfer(emp["wallet"], emp["amount"])
            })
            
        return {
            "intent": "batch-payroll",
            "description": description,
            "network": network,
            "transactions": transactions
        }

    def _encode_erc20_approve(self, spender: str, amount: float, decimals: int = 6) -> str:
        """Encodes approve(address,uint256) data for USDT."""
        method_id = "0x095ea7b3"
        address_padded = spender.lower().replace("0x", "").zfill(64)
        amount_wei = int(float(amount) * (10 ** decimals))
        amount_hex = hex(amount_wei)[2:].zfill(64)
        return f"{method_id}{address_padded}{amount_hex}"

    def build_yield_deployment_intent(self, amount_to_deploy: float, description: str = "", network: str = "ethereum-sepolia") -> Dict:
        config = self._get_config(network)
        
        # LOGIC: Call USDT Contract -> Transfer -> To Yield Vault
        return {
            "intent": "deploy-yield",
            "network": network,
            "transactions": [
                {
                    "to": config["usdt"], # The USDT Contract
                    "value": "0",
                    "data": self._encode_erc20_transfer(config["yield_vault"], amount_to_deploy)
                }
            ]
        }

    def build_tax_escrow_intent(self, tax_amount: float, description: str = "", network: str = "celo-sepolia") -> Dict:
        config = self._get_config(network)
        method_id = "0xb6b55f25" # deposit(uint256)
        amount_hex = hex(int(tax_amount * 10**6))[2:].zfill(64)
        
        return {
            "intent": "fund-tax-escrow",
            "network": network,
            "transactions": [
                {
                    "to": config["usdt"], # Approve the Escrow Contract first
                    "value": "0",
                    "data": self._encode_erc20_approve(config["tax_escrow"], tax_amount)
                },
                {
                    "to": config["tax_escrow"], # Then call deposit on the Escrow Contract
                    "value": "0",
                    "data": f"{method_id}{amount_hex}"
                }
            ]
        }

    def build_dividend_distribution_intent(self, shareholders_array: List[Dict], description: str = "", network: str = "celo-sepolia") -> Dict:
        config = self._get_config(network)
        transactions = []
        
        for owner in shareholders_array:
            transactions.append({
                "to": config["usdt"],
                "value": "0",
                "data": self._encode_erc20_transfer(owner["wallet"], owner["amount"])
            })
            
        return {
            "intent": "dividend-payout",
            "description": description,
            "network": network,
            "transactions": transactions
        }

    # =========================================================================
    # 2. DIRECT CLOUD ACTIONS (Signed by Node.js Master Treasury)
    # =========================================================================

    def request_liquidity(self, amount_usdt: float, network: str = "celo-sepolia") -> Dict:
        node_url = getattr(settings, "NODE_LIQUIDITY_URL", f"{WEB3_API_URL}/request-liquidity")
        try:
            response = requests.post(
                node_url,
                json={"wallet_address": self.wallet_address, "amount_usdt": amount_usdt, "network": network},
                timeout=WEB3_TIMEOUT
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to request liquidity from Node.js: {e}")
            raise Web3Error(f"Master Treasury disbursement failed: {str(e)}")

class Web3Automation:
    """
    Autonomous treasury management calculations based on ledger triggers.
    Watches P&L, cash flow, and compliance rules.
    """
    
    @staticmethod
    def should_reserve_taxes(net_profit: Decimal, tax_rate: float = 0.30) -> Decimal:
        return net_profit * Decimal(str(tax_rate)) if net_profit > 0 else Decimal("0.00")

    @staticmethod
    def should_deploy_yield(
        available_cash: Decimal, 
        minimum_operating_reserve: Decimal = Decimal("100000.00")
    ) -> Decimal:
        excess = available_cash - minimum_operating_reserve
        return excess if excess > Decimal("0.00") else Decimal("0.00")

    @staticmethod
    def get_payroll_distribution_strategy(
        employees: List[Dict],
        net_profit: Decimal,
        monthly_budget: Optional[Decimal] = None
    ) -> List[Dict]:
        if not employees:
            return []
            
        distribution = []
        for emp in employees:
            wallet = emp.get("wallet")
            salary = Decimal(str(emp.get("salary_per_period", 0)))
            
            if wallet and salary > 0:
                distribution.append({"wallet": wallet, "amount": str(salary)})
                
        return distribution

    @staticmethod
    def calculate_dividend_distribution(
        shareholders: List[Dict],
        total_dividend_pool: Decimal
    ) -> List[Dict]:
        if not shareholders:
            return []
            
        distribution = []
        for owner in shareholders:
            pct = Decimal(str(owner.get("equity_percentage", 0)))
            payout = total_dividend_pool * pct
            if payout > 0 and owner.get("wallet"):
                distribution.append({"wallet": owner.get("wallet"), "amount": str(payout)})
        return distribution