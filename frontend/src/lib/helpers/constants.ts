/**
 * Application Constants for NinjaRupiah
 *
 * Centralized configuration constants for the entire application.
 * Includes versioning, validation rules, cryptographic parameters,
 * network configuration, and storage settings.
 *
 * ## Categories:
 * - **Versioning**: App and protocol versions
 * - **Username**: Validation rules and format requirements
 * - **Password**: Security requirements and policy
 * - **Cryptography**: Argon2 config and key sizes
 * - **Storage**: IndexedDB keys and data structure
 * - **Blockchain**: Network config and contract addresses
 * - **Proofs**: ZK proof generation endpoints
 * - **Scanner**: Payment scanning configuration
 * - **Defaults**: Zero addresses and error messages
 *
 * ## Usage:
 * Import only the constants you need from this file.
 * All constants are immutable and should never be modified at runtime.
 *
 * @example
 * ```typescript
 * import { MAX_USERNAME_LENGTH, PASSWORD_REQUIREMENT, KEY_SIZES } from '@/lib/helpers/constants';
 *
 * // Validate username length
 * if (username.length > MAX_USERNAME_LENGTH) {
 *   throw new Error("Username too long");
 * }
 *
 * // Use password requirements
 * if (password.length < PASSWORD_REQUIREMENT.minLength) {
 *   throw new Error("Password too short");
 * }
 *
 * // Validate key size
 * if (privateKey.length !== KEY_SIZES.PRIVATE_KEY) {
 *   throw new Error("Invalid private key size");
 * }
 * ```
 */

/**
 * Application version identifier
 *
 * Used for compatibility checks and data migrations.
 * Increment when breaking changes are introduced.
 */
export const APP_VERSION = 'v1';

/**
 * Key derivation protocol version
 *
 * Version of the key derivation scheme used.
 * Allows for future protocol upgrades while maintaining backward compatibility.
 */
export const KEY_DERIVATION_VERSION = 'v1';

/**
 * Signature message template for wallet authentication
 *
 * Template used when requesting wallet signatures for key derivation.
 * Must remain constant to ensure consistent key derivation.
 */
export const SIGNATURE_MESSAGE_TEMPLATE = 'NinjaRupiah-v1-key-derivation';

/**
 * Maximum allowed username length (characters)
 *
 * Usernames cannot exceed this length to prevent storage issues
 * and ensure reasonable display across UI components.
 */
export const MAX_USERNAME_LENGTH = 32;

/**
 * Minimum required username length (characters)
 *
 * Usernames must be at least this long.
 * Currently set to 1 to allow single-character usernames.
 */
export const MIN_USERNAME_LENGTH = 1;

/**
 * Username validation regex pattern
 *
 * Enforces username format rules:
 * - Must start and end with alphanumeric character (a-z, 0-9)
 * - Can contain letters, numbers, dots (.), hyphens (-), underscores (_)
 * - Length validated separately via MAX_USERNAME_LENGTH
 *
 * @example
 * ```typescript
 * USERNAME_REGEX.test("alice"); // true
 * USERNAME_REGEX.test("alice_2024"); // true
 * USERNAME_REGEX.test("alice.bob"); // true
 * USERNAME_REGEX.test("_alice"); // false (starts with special char)
 * USERNAME_REGEX.test("alice-"); // false (ends with special char)
 * ```
 */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;

/**
 * Allowed characters in usernames (partial match)
 *
 * Used for quick validation of individual characters.
 * Allows lowercase letters, numbers, dots, hyphens, underscores.
 */
export const ALLOWED_USERNAME_CHARS = /^[a-z0-9._-]/;

/**
 * Password security requirements
 *
 * Enforces strong password policy to protect user accounts.
 * Used by validation functions to ensure minimum security standards.
 *
 * ## Requirements:
 * - Minimum 12 characters long
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*)
 *
 * @example
 * ```typescript
 * // Check password against requirements
 * if (password.length < PASSWORD_REQUIREMENT.minLength) {
 *   throw new Error("Password too short");
 * }
 *
 * if (PASSWORD_REQUIREMENT.requireUpperCase && !/[A-Z]/.test(password)) {
 *   throw new Error("Password must contain uppercase letter");
 * }
 * ```
 */
export const PASSWORD_REQUIREMENT = {
  minLength: 12,
  requireUpperCase: true,
  requireLowerCase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Argon2id password hashing configuration
 *
 * Parameters for Argon2id key derivation function.
 * Tuned for browser performance while maintaining security.
 *
 * ## Parameters:
 * - **memoryCost** (65534 KiB): Memory usage (~64 MB)
 * - **timeCost** (3 iterations): Number of passes over memory
 * - **parallelism** (4 lanes): Degree of parallelism
 * - **hashLength** (32 bytes): Output hash size (256 bits)
 *
 * ## Security Trade-offs:
 * Higher values increase security but slow down hashing.
 * Current config targets ~1-2 second hashing time on modern browsers.
 *
 * @see https://github.com/P-H-C/phc-winner-argon2
 *
 * @example
 * ```typescript
 * import { hash } from '@noble/hashes/argon2';
 *
 * const passwordHash = hash(password, {
 *   m: ARGON2_CONFIG.memoryCost,
 *   t: ARGON2_CONFIG.timeCost,
 *   p: ARGON2_CONFIG.parallelism,
 *   dkLen: ARGON2_CONFIG.hashLength
 * });
 * ```
 */
export const ARGON2_CONFIG = {
  memoryCost: 65534,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * IndexedDB storage keys
 *
 * Object store names and keys for browser storage.
 * All user data is stored encrypted in IndexedDB.
 *
 * ## Storage Structure:
 * - **ENCRYPTED_KEYS**: Encrypted private keys (AES-256-GCM)
 * - **USER_PROFILE**: User profile data (username, public keys)
 * - **PAYMENTS**: Stealth payment history and metadata
 * - **SETTINGS**: User preferences and app settings
 *
 * @example
 * ```typescript
 * import { STORAGE_KEYS } from '@/lib/helpers/constants';
 *
 * // Save encrypted keys
 * await db.put(STORAGE_KEYS.ENCRYPTED_KEYS, {
 *   ciphertext: encryptedData,
 *   nonce: nonce,
 *   tag: tag
 * });
 *
 * // Load user profile
 * const profile = await db.get(STORAGE_KEYS.USER_PROFILE);
 * ```
 */
export const STORAGE_KEYS = {
  ENCRYPTED_KEYS: 'encrypted_keys',
  USER_PROFILE: 'user_profile',
  PAYMENTS: 'user_payments',
  SETTINGS: 'user_settings',
};

/**
 * Cryptographic key and data sizes (in bytes)
 *
 * Standard sizes for cryptographic primitives used throughout the app.
 * All sizes are in bytes (8 bits per byte).
 *
 * ## Secp256k1 Keys:
 * - **PRIVATE_KEY** (32 bytes): Private key scalar (256 bits)
 * - **PUBLIC_KEY_COMPRESSED** (33 bytes): Compressed public key (0x02/0x03 + x-coordinate)
 * - **PUBLIC_KEY_UNCOMPRESSED** (65 bytes): Uncompressed public key (0x04 + x + y)
 *
 * ## Ethereum:
 * - **ADDRESS** (20 bytes): Ethereum address (160 bits)
 * - **HASH** (32 bytes): Keccak256 hash output (256 bits)
 *
 * ## AES-256-GCM:
 * - **NONCE** (12 bytes): GCM nonce/IV (96 bits)
 * - **TAG** (16 bytes): Authentication tag (128 bits)
 * - **SALT** (16 bytes): Random salt for key derivation (128 bits)
 *
 * @example
 * ```typescript
 * // Validate key sizes
 * if (privateKey.length !== KEY_SIZES.PRIVATE_KEY) {
 *   throw new Error("Invalid private key size");
 * }
 *
 * // Generate random nonce
 * const nonce = crypto.getRandomValues(new Uint8Array(KEY_SIZES.NONCE));
 *
 * // Allocate buffers
 * const publicKey = new Uint8Array(KEY_SIZES.PUBLIC_KEY_COMPRESSED);
 * ```
 */
export const KEY_SIZES = {
  PRIVATE_KEY: 32,
  PUBLIC_KEY_COMPRESSED: 33,
  PUBLIC_KEY_UNCOMPRESSED: 65,
  ADDRESS: 20,
  HASH: 32,
  NONCE: 12,
  TAG: 16,
  SALT: 16,
};

/**
 * Supported blockchain networks
 *
 * Configuration for blockchain networks supported by NinjaRupiah.
 * Currently supports Base Sepolia testnet.
 *
 * ## Network Properties:
 * - **chainId**: EIP-155 chain identifier
 * - **name**: Human-readable network name
 * - **rpcUrl**: JSON-RPC endpoint URL
 * - **explorer**: Block explorer URL
 *
 * @example
 * ```typescript
 * import { NETWORKS } from '@/lib/helpers/constants';
 *
 * // Check current network
 * const chainId = await provider.getNetwork().then(n => n.chainId);
 * if (chainId !== NETWORKS.BASE_SEPOLIA.chainId) {
 *   throw new Error("Please switch to Base Sepolia");
 * }
 *
 * // Configure provider
 * const provider = new JsonRpcProvider(NETWORKS.BASE_SEPOLIA.rpcUrl);
 *
 * // Open explorer
 * window.open(`${NETWORKS.BASE_SEPOLIA.explorer}/tx/${txHash}`);
 * ```
 */
export const NETWORKS = {
  BASE_SEPOLIA: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
};

/**
 * Smart contract addresses by network
 *
 * Deployed contract addresses for each supported network.
 * Indexed by chainId for easy lookup.
 *
 * ## Contracts:
 * - **NINJA_RUPIAH**: Main NinjaRupiah contract (username registry + payments)
 * - **IDRX_MOCK**: Mock Indonesian Rupiah stablecoin (testnet only)
 * - **SP1_VERIFIER**: SP1 ZK proof verifier contract
 *
 * ## Note:
 * Some addresses may be placeholder ('0x') until deployment.
 *
 * @example
 * ```typescript
 * import { NETWORKS, CONTRACT_ADDRESSES } from '@/lib/helpers/constants';
 *
 * // Get contract address for current network
 * const chainId = NETWORKS.BASE_SEPOLIA.chainId;
 * const ninjaAddress = CONTRACT_ADDRESSES[chainId].NINJA_RUPIAH;
 *
 * // Initialize contract
 * const contract = new Contract(ninjaAddress, abi, signer);
 * ```
 */
export const CONTRACT_ADDRESSES = {
  [NETWORKS.BASE_SEPOLIA.chainId]: {
    NINJA_RUPIAH: '0x',
    IDRX_MOCK: '0x',
    SP1_VERIFIER: '0x50ACFBEdecf4cbe350E1a86fC6f03a821772f1e5;',
  },
};

/**
 * ZK proof generation API endpoints
 *
 * Backend endpoints for generating zero-knowledge proofs.
 * Proofs are generated server-side due to computational requirements.
 *
 * ## Endpoints:
 * - **USERNAME_PROOF**: Generate proof for username registration
 * - **CLAIMING_PROOF**: Generate proof for claiming stealth payments
 *
 * @example
 * ```typescript
 * import { PROOF_ENDPOINTS } from '@/lib/helpers/constants';
 *
 * // Request username registration proof
 * const response = await fetch(PROOF_ENDPOINTS.USERNAME_PROOF, {
 *   method: 'POST',
 *   body: JSON.stringify({ username, commitment })
 * });
 * const { proof } = await response.json();
 *
 * // Request payment claiming proof
 * const claimProof = await fetch(PROOF_ENDPOINTS.CLAIMING_PROOF, {
 *   method: 'POST',
 *   body: JSON.stringify({ stealthAddress, privateKey })
 * });
 * ```
 */
export const PROOF_ENDPOINTS = {
  USERNAME_PROOF: '/api/proof/username',
  CLAIMING_PROOF: '/api/proof/claiming',
};

/**
 * Payment scanner configuration
 *
 * Settings for the stealth payment scanner that monitors blockchain
 * for incoming payments.
 *
 * ## Configuration:
 * - **POLL_INTERVAL_MS** (10000ms = 10s): Time between scans
 * - **BLOCKS_PER_SCAN** (1000 blocks): Number of blocks to scan per batch
 * - **MAX_RETRIES** (3): Maximum retry attempts on RPC failure
 *
 * ## Performance:
 * - Lower poll interval = faster detection, higher RPC usage
 * - More blocks per scan = faster initial sync, higher memory usage
 *
 * @example
 * ```typescript
 * import { SCANNER_CONFIG } from '@/lib/helpers/constants';
 *
 * // Start payment scanner
 * const scanner = new PaymentScanner({
 *   pollInterval: SCANNER_CONFIG.POLL_INTERVAL_MS,
 *   blocksPerScan: SCANNER_CONFIG.BLOCKS_PER_SCAN,
 *   maxRetries: SCANNER_CONFIG.MAX_RETRIES
 * });
 *
 * await scanner.start();
 * ```
 */
export const SCANNER_CONFIG = {
  POLL_INTERVAL_MS: 10000,
  BLOCKS_PER_SCAN: 1000,
  MAX_RETRIES: 3,
};

/**
 * Zero address constant
 *
 * Ethereum zero address (0x0000...0000).
 * Used to represent null/unset address values.
 *
 * ## Use Cases:
 * - Validate address is not zero
 * - Check for uninitialized addresses
 * - Filter out zero address transfers
 *
 * @example
 * ```typescript
 * import { ZERO_ADDRESS } from '@/lib/helpers/constants';
 *
 * // Validate address is not zero
 * if (address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
 *   throw new Error("Cannot send to zero address");
 * }
 *
 * // Filter transfers
 * const realTransfers = transfers.filter(t => t.to !== ZERO_ADDRESS);
 * ```
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Zero bytes32 constant
 *
 * 32-byte zero value (0x0000...0000).
 * Used to represent null/unset bytes32 values in contracts.
 *
 * ## Use Cases:
 * - Validate hash is not zero
 * - Check for uninitialized bytes32 fields
 * - Default value for optional bytes32 parameters
 *
 * @example
 * ```typescript
 * import { ZERO_BYTES32 } from '@/lib/helpers/constants';
 *
 * // Check if commitment is set
 * if (commitment === ZERO_BYTES32) {
 *   throw new Error("Commitment not initialized");
 * }
 *
 * // Use as default parameter
 * await contract.updateMetadata(ZERO_BYTES32); // Clear metadata
 * ```
 */
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * User-facing error messages
 *
 * Human-readable error messages for common error scenarios.
 * Used for consistent error messaging across the UI.
 *
 * ## Categories:
 * - Authentication errors
 * - Key management errors
 * - Username errors
 * - Transaction errors
 * - Payment errors
 *
 * ## Note:
 * For programmatic error handling, use ERROR_CODES instead.
 * These messages are for display to end users.
 *
 * @see ERROR_CODES for programmatic error codes
 *
 * @example
 * ```typescript
 * import { ERROR_MESSAGES } from '@/lib/helpers/constants';
 *
 * // Display error to user
 * if (!wallet.connected) {
 *   toast.error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
 * }
 *
 * // Use in error throwing
 * if (await isUsernameTaken(username)) {
 *   throw new UsernameError(ERROR_MESSAGES.USERNAME_TAKEN);
 * }
 * ```
 */
export const ERROR_MESSAGES = {
  INVALID_PASSWORD: 'Invalid password',
  WALLET_NOT_CONNECTED: 'Wallet not connected',
  KEYS_NOT_INITIALIZED: 'Keys not initialized',
  KEYS_LOCKED: 'Keys are locked',
  USERNAME_TAKEN: 'Username already taken',
  INVALID_USERNAME: 'Invalid username format',
  INVALID_ADDRESS: 'Invalid Ethereum address',
  PROOF_GENERATION_FAILED: 'Failed to generate Proofs',
  TRANSACTION_FAILED: 'Transaction failed',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  PAYMENT_NOT_FOUND: 'Payment not found',
  ALREADY_CLAIMED: 'Payment already claimed',
};
