# Mock NinjaRupiah (Ninah) Project

## Overview

This is a **mock version** of the NinjaRupiah privacy-preserving payment system. It is designed for development and testing purposes without requiring real ZK proof generation infrastructure.

**Key Difference from Production:**
- Production version uses SP1 zkVM with a backend prover network
- Mock version uses `MockSP1Verifier` that accepts any proof as valid
- All proof generation happens locally in the frontend (no backend needed)

## Architecture

### Contracts (`/contracts`)

| File | Purpose |
|------|---------|
| `src/NinjaRupiah.sol` | Main contract - username registration, stealth payments, meta keys |
| `src/MockSP1Verifier.sol` | **MOCK** - Always returns success for proof verification |
| `src/MockIDRX.sol` | Mock Indonesian Rupiah stablecoin (ERC20, 6 decimals) |
| `src/IMockIDRX.sol` | Interface for MockIDRX |
| `script/DeployMock.s.sol` | Deployment script for all mock contracts |
| `test/NinjaRupiah.t.sol` | Foundry tests |

### Frontend (`/frontend`)

| Path | Purpose |
|------|---------|
| `src/lib/api/proof.ts` | **MOCK** - Generates proofs locally (no backend API calls) |
| `src/hooks/useUsernameProof.ts` | React Query hook for username proof generation |
| `src/hooks/useClaimingProof.ts` | React Query hook for claiming proof generation |
| `src/lib/contracts/` | Contract ABIs, addresses, and viem clients |
| `src/lib/helpers/` | Utility functions (Bytes, constants) |

## Mock Proof System

### How It Works

1. **MockSP1Verifier Contract**: The `verifyProof()` function always succeeds (unless `setShouldRevert(true)` is called)

2. **Frontend Mock Proofs**: The `generateUsernameProof()` and `generateClaimingProof()` functions:
   - Calculate correct public values (username hash, commitment, etc.)
   - Return fake vkey and proof bytes (any bytes work with MockSP1Verifier)
   - Contract validates public values match, verifier passes

### Username Registration Flow (Mock)

```
1. Frontend: generateUsernameProof(username, wallet, secret)
   - Calculates: usernameHash = keccak256(username)
   - Calculates: commitment = keccak256(usernameHash, wallet, secret)
   - Returns: { vkey: 0x01, publicValues: encode(usernameHash, commitment), proof: 0x1234 }

2. Contract: RegisterUsername(usernameHash, commitment, encodedProof)
   - MockSP1Verifier.verifyProof() -> always passes
   - Decodes publicValues, verifies usernameHash and commitment match
   - Registers username
```

### Claiming Stealth Payment Flow (Mock)

```
1. Frontend: encodeClaimingProofForContract(stealthAddress, ephemeralPubkeyHash, claimerAddress)
   - Encodes public values: (stealthAddress, ephemeralPubkeyHash, claimerAddress)
   - Returns encoded proof with mock vkey and proof bytes

2. Contract: claimFromStealth(stealthAddress, proof)
   - MockSP1Verifier.verifyProof() -> always passes
   - Decodes publicValues, verifies all addresses and hashes match
   - Transfers funds to claimer
```

## Guidelines

### When Adding New Features

1. **Contracts**: Keep the same interface as production NinjaRupiah
2. **Proofs**: Generate valid public values locally, use dummy proof bytes
3. **Testing**: Use `setShouldRevert(true)` on MockSP1Verifier to test failure cases

### Key Invariants

- Mock proofs must have **correct public values** - only the cryptographic proof is faked
- All address/hash matching logic in contracts remains the same as production
- The commitment scheme (keccak256) is real and must be computed correctly

## Code Style

- Solidity: Follow OpenZeppelin patterns, use custom errors
- TypeScript: Use viem for encoding, avoid ethers.js
- Naming: Use `Mock` prefix for mock implementations

## Important Files

### Contracts
- `contracts/src/MockSP1Verifier.sol` - The key mock component
- `contracts/src/NinjaRupiah.sol` - Main contract logic

### Frontend
- `frontend/src/lib/api/proof.ts` - Mock proof generation (most important)
- `frontend/src/lib/contracts/addresses.ts` - Update after deployment

## Commands

### Contracts

```bash
# Install dependencies
cd contracts
forge install

# Run tests
forge test -vvv

# Deploy to local anvil
anvil &
forge script script/DeployMock.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy to Base Sepolia
forge script script/DeployMock.s.sol --rpc-url https://sepolia.base.org --broadcast --private-key $PRIVATE_KEY
```

### Frontend

```bash
cd frontend
npm install  # or bun install

# Development
npm run dev

# Build
npm run build
```

## After Deployment

Update contract addresses in:
- `frontend/src/lib/contracts/addresses.ts`
- `frontend/src/lib/helpers/constants.ts` (CONTRACT_ADDRESSES)

## Testing Mock vs Production

| Scenario | Mock Behavior | Production Behavior |
|----------|--------------|-------------------|
| Valid proof | Always passes | Passes only with valid ZK proof |
| Invalid public values | Fails (values don't match) | Fails (values don't match) |
| Malformed proof bytes | Passes (not checked) | Fails (invalid proof) |
| `setShouldRevert(true)` | Fails | N/A |

## Security Notes

This mock version is for **development/testing only**:
- Do NOT deploy to mainnet
- Real funds should NOT be used
- The mock verifier accepts ANY proof bytes
