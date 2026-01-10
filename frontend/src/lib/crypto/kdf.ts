import { argon2id } from 'hash-wasm';
import { hkdf } from '@noble/hashes/hkdf.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { CryptoError } from '@/lib/helpers/errors';
import { ARGON2_CONFIG } from '@/lib/helpers/constants';
import { Bytes } from '@/lib/helpers/bytes';
import { Nonce } from '@/lib/crypto/nonce';

export interface Argon2Config {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
}

export const DEFAULT_ARGON2_CONFIG: Argon2Config = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Key Derivation Functions (KDF) for NinjaRupiah
 *
 * ## User Registration & Key Derivation Flow:
 *
 * 1. **User Registration**
 *    - User chooses a unique username
 *    - User connects wallet via Privy (Gmail, Twitter, or other social login)
 *    - User creates a strong password (min 12 chars, mixed case, numbers, special chars)
 *
 * 2. **Password Hash Derivation** (Argon2id)
 *    - Password → Argon2id → Password Hash (32 bytes)
 *    - Uses memory-hard algorithm resistant to GPU/ASIC attacks
 *    - Config: 64MB memory, 3 iterations, 4 parallel threads
 *
 * 3. **Wallet Signature** (Privy)
 *    - Wallet signs message
 *    - Creates deterministic signature tied to wallet address
 *    - Cannot be replayed or forged
 *    - Supports all Privy auth methods: email, Twitter, Discord, phone, wallet, etc.
 *
 * 4. **Master Key Derivation** (HKDF)
 *    - Input: Password Hash (32 bytes) + Wallet Signature (65 bytes)
 *    - Process: HKDF-Keccak256 → Master Key (32 bytes)
 *    - Master key uniquely combines:
 *      * Something you know (password)
 *      * Something you have (wallet from Privy social login)
 *
 * 5. **Sub-Key Derivation** (Purpose-bound keys)
 *    - Storage Encryption Key: Encrypts user data in browser storage
 *    - Meta Viewing Key: Derives stealth address viewing keys
 *    - Meta Spending Key: Derives stealth address spending keys
 *
 * ## Security Model:
 *
 * - **No password stored**: Only Argon2 hash is used for derivation
 * - **Wallet-bound**: Keys tied to Privy wallet, can't be stolen with password alone
 * - **Social recovery**: User can recover with same Privy account + password
 * - **Privacy-first**: All keys derived client-side, never sent to server
 *
 * ## Example Usage:
 *
 * ```typescript
 * // 1. User enters password and connects Privy wallet
 * const password = "MySecurePassword123!";
 * const { user, wallets } = usePrivy();
 * const privyWallet = wallets[0];
 * const userIdentifier = user.email?.address || user.twitter?.username || user.wallet?.address;
 *
 * // 2. Derive password hash
 * const salt = Kdf.generateArgon2Salt(16);
 * const passwordHash = await Kdf.derivePasswordHash(password, salt);
 *
 * // 3. Get wallet signature
 * const walletSig = await Kdf.deriveWalletSignature(privyWallet, userIdentifier);
 *
 * // 4. Derive master key
 * const masterKey = Kdf.deriveMasterKey(passwordHash, walletSig);
 *
 * // 5. Derive purpose-specific keys
 * const storageKey = Kdf.deriveStorageEncryptionKey(masterKey);
 * const viewingKey = Kdf.deriveMetaViewingKey(masterKey);
 * const spendingKey = Kdf.deriveMetaSpendingKey(masterKey);
 * ```
 */
export class Kdf {
  /**
   * Derive a cryptographic key from a password using Argon2id
   * Argon2id is a hybrid version combining Argon2i and Argon2d for resistance against
   * side-channel and GPU attacks
   *
   * @param password - The password to derive from
   * @param salt - Salt must be at least 16 bytes (recommended: 16-32 bytes)
   * @param config - Argon2 configuration (uses ARGON2_CONFIG from constants if not provided)
   * @returns Derived key as Uint8Array
   */
  static async derivePasswordHash(
    password: string,
    salt: Uint8Array,
    config: Argon2Config = ARGON2_CONFIG,
  ): Promise<Uint8Array> {
    try {
      // Validate salt length
      if (salt.length < 16) {
        throw new CryptoError('Salt must be at least 16 bytes', 'ARGON2_INVALID_SALT');
      }

      // Validate password
      if (!password || password.length === 0) {
        throw new CryptoError('Password cannot be empty', 'ARGON2_INVALID_PASSWORD');
      }

      // Convert password to bytes
      const passwordBytes = Bytes.stringToBytes(password);

      // Derive key using Argon2id
      const hash = await argon2id({
        password: passwordBytes,
        salt: salt,
        parallelism: config.parallelism,
        iterations: config.timeCost,
        memorySize: config.memoryCost,
        hashLength: config.hashLength,
        outputType: 'binary',
      });

      return new Uint8Array(hash);
    } catch (error) {
      if (error instanceof CryptoError) {
        throw error;
      }
      throw new CryptoError(`Failed to derive password hash: ${(error as Error).message}`, 'ARGON2_DERIVATION_FAILED');
    }
  }

  /**
   * Derive deterministic signature from Privy wallet
   *
   * ## Flow:
   * 1. User connects via Privy (Email, Twitter, Discord, Phone, Wallet, etc.)
   * 2. Privy provides an embedded wallet associated with their account
   * 3. We ask the wallet to sign a deterministic message containing the user identifier
   * 4. The signature becomes part of the key derivation (something you have)
   *
   * ## Security Properties:
   * - Signature is deterministic: Same wallet + same userIdentifier = same signature
   * - Wallet-bound: Only the Privy wallet with access to the private key can produce this
   * - Cannot be stolen with password alone: Attacker needs both password AND Privy account
   * - Social recovery: User can recover keys by logging in with same Privy account
   *
   * ## Supported User Identifiers:
   * - Email: "user@gmail.com" (Gmail, Outlook, etc.)
   * - Twitter: "@username" or "username"
   * - Discord: "username#1234"
   * - Phone: "+1234567890"
   * - Wallet: "0x..." (wallet-only login)
   * - Farcaster: "username"
   * - Telegram: "@username"
   *
   * @param wallet - Privy wallet instance with signMessage capability
   * @param userIdentifier - User identifier from Privy (email, Twitter username, Discord, phone, etc.)
   * @returns Wallet signature as 65-byte Uint8Array
   *
   * @example
   * ```typescript
   * // After Privy login with email
   * const { user, wallets } = usePrivy();
   * const privyWallet = wallets[0];
   * const userIdentifier = user.email?.address || user.twitter?.username || user.wallet?.address;
   *
   * const signature = await Kdf.deriveWalletSignature(privyWallet, userIdentifier);
   * // signature = 65 bytes of deterministic wallet signature
   * ```
   */
  static async deriveWalletSignature(
    wallet: { signMessage: (message: string) => Promise<string> },
    userIdentifier: string,
  ): Promise<Uint8Array> {
    console.log('[KDF] Deriving wallet signature...');
    console.log('[KDF] User identifier:', userIdentifier);
    console.log('[KDF] Wallet object:', { hasSignMessage: typeof wallet.signMessage });

    const message = `NinjaRupiah - Secure Key Derivation

    This signature is used to derive your private keys.
    It combines with your password to create your:
    - Viewing key (to receive payments)
    - Spending key (to send payments)

    This signature does NOT authorize any transaction.
    Your keys are stored locally and never leave your device.

    User: ${userIdentifier}
    Version: v1.0`;

    try {
      console.log('[KDF] Message to sign created, requesting signature...');
      const signature = await wallet.signMessage(message);
      console.log('[KDF] Signature received:', signature?.substring(0, 20) + '...');

      const sigBytes = Uint8Array.from(
        signature
          .slice(2)
          .match(/.{2}/g)!
          .map((bytes) => parseInt(bytes, 16)),
      );

      console.log('[KDF] Wallet signature derived successfully, length:', sigBytes.length);

      return sigBytes;
    } catch (error) {
      console.error('[KDF] Failed to derive wallet signature:', error);
      throw new CryptoError(`Failed to derive wallet signature: ${error}`, 'WALLET_SIGNATURE_FAILED');
    }
  }

  /**
   * Derive master key from password hash and wallet signature
   *
   * ## Two-Factor Key Derivation:
   * This combines two independent secrets to create the master key:
   * 1. **Password Hash** (something you know) - 32 bytes from Argon2id
   * 2. **Wallet Signature** (something you have) - 65 bytes from Privy wallet
   *
   * ## Process:
   * 1. Concatenate: passwordHash (32 bytes) + walletSignature (65 bytes) = 97 bytes IKM
   * 2. Apply HKDF-Keccak256 with application-specific salt and info
   * 3. Extract 32-byte master key
   *
   * ## Security Properties:
   * - **Two-factor security**: Attacker needs BOTH password AND Privy account access
   * - **Deterministic**: Same inputs always produce same master key
   * - **Non-reversible**: Cannot extract password or signature from master key
   * - **Domain separation**: Uses "NinjaRupiah-master-salt-v1" to prevent cross-protocol attacks
   *
   * @param passwordHash - 32-byte hash from Argon2id password derivation
   * @param walletSignature - 65-byte signature from Privy wallet
   * @returns 32-byte master key for deriving all other application keys
   *
   * @example
   * ```typescript
   * // After getting password hash and wallet signature
   * const passwordHash = await Kdf.derivePasswordHash(password, salt);
   * const walletSig = await Kdf.deriveWalletSignature(privyWallet, email);
   *
   * // Combine into master key
   * const masterKey = Kdf.deriveMasterKey(passwordHash, walletSig);
   * // masterKey = 32 bytes, uniquely tied to this user's password + Privy account
   * ```
   */
  static deriveMasterKey(passwordHash: Uint8Array, walletSignature: Uint8Array): Uint8Array {
    const ikm = new Uint8Array(passwordHash.length + walletSignature.length);
    ikm.set(passwordHash, 0);
    ikm.set(walletSignature, passwordHash.length);

    const salt = keccak_256(new TextEncoder().encode(`NinjaRupiah-master-salt-v1`));

    const masterKey = hkdf(keccak_256, ikm, salt, new TextEncoder().encode('master-key-v1'), 32);

    return masterKey;
  }

  /**
   * Derive purpose-specific sub-keys from master key using HKDF
   *
   * ## Purpose Separation:
   * Each application purpose gets its own cryptographically independent key.
   * This ensures that compromise of one key doesn't affect others.
   *
   * ## Process:
   * 1. Use master key as input key material (IKM)
   * 2. Apply domain-specific salt: Hash("NinjaRupiah-subkey-salt-v1")
   * 3. Apply purpose-specific info: "NinjaRupiah-v1: {purpose}"
   * 4. Derive key using HKDF-Keccak256
   *
   * @param masterKey - 32-byte master key from deriveMasterKey()
   * @param purpose - Purpose identifier (e.g., "storage-encryption", "meta-viewing-key")
   * @param length - Output key length in bytes (default: 32, max: 255)
   * @returns Purpose-specific derived key
   *
   * @throws Error if master key is not 32 bytes or invalid length
   */
  static deriveSubKey(masterKey: Uint8Array, purpose: string, length: number = 32): Uint8Array {
    if (masterKey.length !== 32) {
      throw new CryptoError('Master key must be 32 bytes', 'INVALID_MASTER_KEY');
    }

    if (length <= 0 || length > 255) {
      throw new CryptoError('Output length must be between 1 and 255 bytes', 'INVALID_KEY_LENGTH');
    }

    const salt = keccak_256(new TextEncoder().encode('NinjaRupiah-subkey-salt-v1'));
    const info = new TextEncoder().encode(`NinjaRupiah-v1: ${purpose}`);

    return hkdf(keccak_256, masterKey, salt, info, length);
  }

  /**
   * Derive storage encryption key for encrypting user data in browser storage
   *
   * ## Purpose:
   * Encrypts sensitive data stored in browser (IndexedDB, localStorage):
   * - Private keys
   * - Payment history
   * - User settings
   * - Cached stealth addresses
   *
   * ## Security:
   * - 32-byte AES-256-GCM key
   * - Derived with purpose "storage-encryption"
   * - Independent from other keys
   *
   * @param masterKey - 32-byte master key
   * @returns 32-byte encryption key for browser storage
   */
  static deriveStorageEncryptionKey(masterKey: Uint8Array): Uint8Array {
    return this.deriveSubKey(masterKey, 'storage-encryption', 32);
  }

  /**
   * Derive meta viewing key for stealth address scheme
   *
   * ## Purpose:
   * Master viewing key for deriving stealth address viewing keys.
   * Used to:
   * - Scan blockchain for incoming payments
   * - Detect stealth addresses sent to you
   * - Cannot spend funds (view-only)
   *
   * ## Stealth Address Flow:
   * 1. Derive viewing key from master key (this function)
   * 2. Generate per-payment viewing keys
   * 3. Scan blockchain for matching stealth addresses
   *
   * @param masterKey - 32-byte master key
   * @returns 32-byte meta viewing key for stealth addresses
   */
  static deriveMetaViewingKey(masterKey: Uint8Array): Uint8Array {
    return this.deriveSubKey(masterKey, 'meta-viewing-key', 32);
  }

  /**
   * Derive meta spending key for stealth address scheme
   *
   * ## Purpose:
   * Master spending key for deriving stealth address spending keys.
   * Used to:
   * - Generate per-payment spending keys
   * - Sign transactions to spend stealth payments
   * - Create stealth addresses for receiving
   *
   * ## Security:
   * - CRITICAL: Never expose this key
   * - Store encrypted in browser storage
   * - Required to spend funds received via stealth addresses
   *
   * ## Stealth Address Flow:
   * 1. Derive spending key from master key (this function)
   * 2. Combine with viewing key to generate stealth addresses
   * 3. Use to derive private keys for spending received funds
   *
   * @param masterKey - 32-byte master key
   * @returns 32-byte meta spending key for stealth addresses
   */
  static deriveMetaSpendingKey(masterKey: Uint8Array): Uint8Array {
    return this.deriveSubKey(masterKey, 'meta-spending-key', 32);
  }

  /**
   * Derive unlock key from password only (no wallet signature required)
   *
   * ## Purpose:
   * This key is used to encrypt/decrypt the stored keys in IndexedDB.
   * By deriving this from password only, users don't need to sign
   * with their wallet every time they unlock.
   *
   * ## Security Model:
   * - Wallet signature is used during INITIAL key derivation (adds entropy)
   * - Unlock key protects the stored keys with password only
   * - This is similar to how MetaMask works: password unlocks, seed phrase for recovery
   *
   * ## Process:
   * 1. Use separate salt from master key derivation (unlockSalt)
   * 2. Apply Argon2id to password with unlock salt
   * 3. Derive 32-byte unlock key using HKDF
   *
   * @param password - User's password
   * @param unlockSalt - Salt for unlock key derivation (stored alongside encrypted keys)
   * @returns 32-byte unlock key for encrypting/decrypting stored keys
   */
  static async deriveUnlockKey(password: string, unlockSalt: Uint8Array): Promise<Uint8Array> {
    // First derive password hash with Argon2id
    const passwordHash = await this.derivePasswordHash(password, unlockSalt);

    // Then derive unlock key using HKDF with specific purpose
    const salt = keccak_256(new TextEncoder().encode('NinjaRupiah-unlock-salt-v1'));
    const info = new TextEncoder().encode('NinjaRupiah-v1: unlock-key');

    const unlockKey = hkdf(keccak_256, passwordHash, salt, info, 32);

    // Clear password hash from memory
    passwordHash.fill(0);

    return unlockKey;
  }

  /**
   * HKDF (HMAC-based Extract-and-Expand Key Derivation Function)
   * Used to derive multiple keys from a single master key
   *
   * @param inputKeyMaterial - The input key material (IKM)
   * @param length - Desired output length in bytes
   * @param salt - Optional salt (recommended)
   * @param info - Optional context/application specific info
   * @returns Derived key
   */
  static deriveKey(inputKeyMaterial: Uint8Array, length: number, salt?: Uint8Array, info?: Uint8Array): Uint8Array {
    try {
      if (length <= 0 || length > 255 * 32) {
        throw new CryptoError('Invalid key length for HKDF', 'HKDF_INVALID_LENGTH');
      }

      if (inputKeyMaterial.length === 0) {
        throw new CryptoError('Input key material cannot be empty', 'HKDF_INVALID_IKM');
      }

      return hkdf(keccak_256, inputKeyMaterial, salt, info, length);
    } catch (error) {
      if (error instanceof CryptoError) {
        throw error;
      }
      throw new CryptoError(`Failed to derive key: ${(error as Error).message}`, 'HKDF_DERIVATION_FAILED');
    }
  }

  /**
   * Generate a salt for use with Argon2 or other KDFs
   *
   * @param length - Salt length in bytes (default: 16, recommended: 16-32)
   * @returns Random salt
   */
  static generateArgon2Salt(length: number = 16): Uint8Array {
    if (length < 16) {
      throw new CryptoError('Salt length must be at least 16 bytes', 'INVALID_SALT_LENGTH');
    }

    return Nonce.generateSalt(length);
  }
}
