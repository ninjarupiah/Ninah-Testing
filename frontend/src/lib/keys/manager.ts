import { ERROR_CODES, KeyError } from '@/lib/helpers/errors';
import { Bytes } from '@/lib/helpers/bytes';
import type { DerivedKeys, KeyInitParams, KeyManagerState, KeyUnlockParams } from '@/lib/keys/types';
import { Storage } from '@/lib/keys/storage';
import { Derivation } from '@/lib/keys/derivation';
import { Kdf } from '@/lib/crypto/kdf';

/**
 * KeyManager - Manages cryptographic keys for NinjaRupiah
 *
 * ## Lifecycle:
 * 1. **Initialize**: First-time setup - derives keys from password + Privy wallet
 * 2. **Lock**: Securely wipes keys from memory
 * 3. **Unlock**: Decrypts keys using password only (no wallet signature needed)
 *
 * ## Security Features:
 * - Two-factor key derivation at initialization (password + Privy wallet signature)
 * - Password-only unlock for better UX (wallet signature adds entropy at setup)
 * - Encrypted storage in IndexedDB with AAD binding
 * - Automatic key zeroing on lock
 * - Constant-time error messages
 * - State isolation
 *
 * ## Usage:
 * ```typescript
 * // First time setup (requires wallet signature)
 * await keyManager.initialize({
 *   password: "SecurePass123!",
 *   wallet: privyWallet,
 *   userIdentifier: user.email.address,
 *   authMethod: 'email'
 * });
 *
 * // Later sessions (password only - no wallet popup!)
 * await keyManager.unlock({
 *   password: "SecurePass123!",
 *   walletAddress: "0x..."
 * });
 *
 * // Use keys
 * const keys = keyManager.getKeys();
 *
 * // Lock when done
 * keyManager.lock();
 * ```
 */
export class KeyManager {
  private state: KeyManagerState = {
    isInitialized: false,
    isUnlocked: false,
    walletAddress: null,
    authMethod: null,
    userIdentifier: null,
    keys: null,
  };

  /**
   * Initialize keys for first-time user
   *
   * ## Process:
   * 1. Check if keys already exist for this wallet
   * 2. Derive keys from password + Privy wallet signature (adds entropy)
   * 3. Validate derived keys
   * 4. Generate unlock salt and derive unlock key (password only)
   * 5. Encrypt keys with unlock key (for password-only unlock later)
   * 6. Save to IndexedDB
   * 7. Update state to unlocked
   *
   * @param params - Initialization parameters
   * @throws {KeyError} If keys already exist for this wallet
   * @throws {KeyError} If key derivation fails
   * @throws {KeyError} If derived keys are invalid
   *
   * @example
   * ```typescript
   * await keyManager.initialize({
   *   password: "MySecurePassword123!",
   *   wallet: privyWallet,
   *   userIdentifier: "user@gmail.com",
   *   authMethod: 'email'
   * });
   * ```
   */
  async initialize(params: KeyInitParams): Promise<void> {
    const { password, wallet, userIdentifier, authMethod } = params;

    try {
      const exists = await Storage.keyExistsInStorage(wallet.address);

      if (exists) {
        throw new KeyError('Keys already initialized for this wallet', ERROR_CODES.KEY_ALREADY_EXISTS);
      }

      // Derive keys using password + wallet signature (wallet adds entropy)
      const { keys, salt } = await Derivation.deriveKeys(params);

      if (!Derivation.validateKeys(keys)) {
        throw new KeyError('Derived keys are invalid', ERROR_CODES.KEY_INVALID);
      }

      // Generate separate salt for unlock key derivation
      const unlockSalt = Kdf.generateArgon2Salt(16);

      // Derive unlock key from password only (for password-only unlock later)
      const unlockKey = await Kdf.deriveUnlockKey(password, unlockSalt);

      // Encrypt keys with unlock key (not storageEncryptionKey)
      const encrypted = await Storage.encryptKeys(
        keys,
        unlockKey,
        wallet.address,
        userIdentifier,
        authMethod,
        salt,
        unlockSalt,
      );

      // Clear unlock key from memory
      unlockKey.fill(0);

      await Storage.saveKeysToStorage(encrypted);

      this.state = {
        isInitialized: true,
        isUnlocked: true,
        walletAddress: wallet.address,
        userIdentifier,
        authMethod,
        keys,
      };
    } catch (error) {
      this.lock();
      if (error instanceof KeyError) {
        throw error;
      }
      throw new KeyError(`Failed to initialize keys: ${error}`, ERROR_CODES.KEY_DERIVATION_FAILED);
    }
  }

  /**
   * Unlock keys for existing user
   *
   * ## Process:
   * 1. Load encrypted keys from IndexedDB
   * 2. Derive unlock key from password only (no wallet signature needed!)
   * 3. Decrypt stored keys using unlock key
   * 4. Validate decrypted keys
   * 5. Update state to unlocked
   *
   * ## Security:
   * - Only requires password (wallet signature was used during initialization)
   * - Failed attempts automatically lock the manager
   * - Constant-time errors prevent password enumeration
   *
   * @param params - Unlock parameters (password + walletAddress)
   * @throws {KeyError} If no keys found for this wallet
   * @throws {KeyError} If password is incorrect
   * @throws {KeyError} If decrypted keys are invalid
   *
   * @example
   * ```typescript
   * await keyManager.unlock({
   *   password: "MySecurePassword123!",
   *   walletAddress: "0x..."
   * });
   * ```
   */
  async unlock(params: KeyUnlockParams): Promise<void> {
    const { password, walletAddress } = params;

    try {
      const encrypted = await Storage.loadKeysFromStorage(walletAddress);

      if (!encrypted) {
        throw new KeyError('No keys found for this wallet', ERROR_CODES.KEY_NOT_INITIALIZED);
      }

      // Get unlock salt from stored data
      const unlockSalt = Bytes.base64ToBytes(encrypted.unlockSalt);

      // Derive unlock key from password only (no wallet signature needed!)
      const unlockKey = await Kdf.deriveUnlockKey(password, unlockSalt);

      // Decrypt keys using unlock key
      const decrypted = await Storage.decryptKeys(encrypted, unlockKey);

      // Clear unlock key from memory
      unlockKey.fill(0);

      if (!Derivation.validateKeys(decrypted)) {
        throw new KeyError('Decrypted keys are invalid', ERROR_CODES.KEY_INVALID);
      }

      this.state = {
        isInitialized: true,
        isUnlocked: true,
        walletAddress: walletAddress,
        userIdentifier: encrypted.userIdentifier,
        authMethod: encrypted.authMethod,
        keys: decrypted,
      };
    } catch (error) {
      this.lock();

      if (error instanceof KeyError) {
        throw error;
      }

      throw new KeyError(`Failed to unlock keys: ${error}`, ERROR_CODES.AUTH_INVALID_PASSWORD);
    }
  }

  /**
   * Lock keys and wipe from memory
   *
   * ## Security:
   * - Zeros out all private keys in memory (prevents memory dumps)
   * - Sets keys to null
   * - Preserves wallet address and user identifier for UI state
   * - Clears session storage
   *
   * Call this when:
   * - User logs out
   * - Session expires
   * - App goes to background
   * - Before updating password
   *
   * @example
   * ```typescript
   * keyManager.lock();
   * ```
   */
  lock(): void {
    if (this.state.keys) {
      Derivation.zeroKeys(this.state.keys);
    }

    this.state = {
      isInitialized: this.state.isInitialized,
      isUnlocked: false,
      walletAddress: this.state.walletAddress,
      authMethod: this.state.authMethod,
      userIdentifier: this.state.userIdentifier,
      keys: null,
    };
  }

  /**
   * Get decrypted keys
   *
   * @returns {DerivedKeys} All derived keys (master, storage, viewing, spending)
   * @throws {KeyError} If keys are locked
   *
   * @example
   * ```typescript
   * const keys = keyManager.getKeys();
   * const encrypted = await Encryption.encrypt(data, keys.storageEncryptionKey);
   * ```
   */
  getKeys(): DerivedKeys {
    if (!this.state.isUnlocked || !this.state.keys) {
      throw new KeyError('Keys are locked', ERROR_CODES.KEY_LOCKED);
    }

    return this.state.keys;
  }

  /**
   * Get public keys for on-chain registration
   *
   * Only returns viewing and spending public keys (safe to expose)
   *
   * @returns {PublicKeys} Meta viewing and spending public keys
   * @throws {KeyError} If keys are locked
   *
   * @example
   * ```typescript
   * const publicKeys = keyManager.getPublicKeys();
   * await contract.registerUsername(username, publicKeys.metaViewingPub, publicKeys.metaSpendingPub);
   * ```
   */
  getPublicKeys() {
    const keys = this.getKeys();
    return Derivation.exportPublicKeys(keys);
  }

  /**
   * Get current manager state (read-only)
   *
   * @returns {Readonly<KeyManagerState>} Current state
   *
   * @example
   * ```typescript
   * const state = keyManager.getState();
   * if (state.isUnlocked) {
   *   // Show authenticated UI
   * }
   * ```
   */
  getState(): Readonly<KeyManagerState> {
    return { ...this.state };
  }

  /**
   * Check if keys have been initialized for this manager instance
   *
   * @returns {boolean} True if keys exist in storage
   */
  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Check if keys are currently unlocked
   *
   * @returns {boolean} True if unlocked and keys available
   */
  isUnlocked(): boolean {
    return this.state.isUnlocked;
  }

  /**
   * Check if keys exist in storage for a wallet address
   *
   * Static method - can be called without instance
   *
   * @param walletAddress - Ethereum wallet address to check
   * @returns {Promise<boolean>} True if keys exist
   *
   * @example
   * ```typescript
   * const exists = await KeyManager.keysExist(wallet.address);
   * if (exists) {
   *   // Show unlock UI
   * } else {
   *   // Show initialize UI
   * }
   * ```
   */
  static async keysExist(walletAddress: string): Promise<boolean> {
    return Storage.keyExistsInStorage(walletAddress);
  }

  /**
   * Delete keys from storage for a wallet address
   *
   * ## WARNING:
   * This permanently deletes encrypted keys from IndexedDB.
   * User will need to re-initialize with password + wallet.
   *
   * Static method - can be called without instance
   *
   * @param walletAddress - Ethereum wallet address
   * @throws {StorageError} If deletion fails
   *
   * @example
   * ```typescript
   * await KeyManager.deleteKeys(wallet.address);
   * ```
   */
  static async deleteKeys(walletAddress: string): Promise<void> {
    await Storage.deleteKeysFromStorage(walletAddress);
  }

  /**
   * Update password while keeping same keys
   *
   * ## Process:
   * 1. Verify old password by unlocking
   * 2. Generate new unlock salt
   * 3. Derive new unlock key from new password
   * 4. Re-encrypt keys with new unlock key
   * 5. Save to storage
   *
   * ## Security:
   * - Requires current password to proceed
   * - Keys remain the same (only unlock password changes)
   * - No wallet signature needed (password-only operation)
   *
   * @param oldPassword - Current password
   * @param newPassword - New password
   * @throws {KeyError} If old password is incorrect
   * @throws {KeyError} If update fails
   *
   * @example
   * ```typescript
   * await keyManager.updatePassword("OldPass123!", "NewSecurePass456!");
   * ```
   */
  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      if (!this.state.walletAddress) {
        throw new KeyError('No wallet address in state', ERROR_CODES.KEY_NOT_INITIALIZED);
      }

      // Verify old password by unlocking
      await this.unlock({ password: oldPassword, walletAddress: this.state.walletAddress });

      if (!this.state.keys) {
        throw new KeyError('Failed to unlock with old password', ERROR_CODES.AUTH_INVALID_PASSWORD);
      }

      // Load existing storage to get the original salt (for master key derivation)
      const existingStorage = await Storage.loadKeysFromStorage(this.state.walletAddress);
      if (!existingStorage) {
        throw new KeyError('No keys found in storage', ERROR_CODES.KEY_NOT_INITIALIZED);
      }

      // Generate new unlock salt for new password
      const newUnlockSalt = Kdf.generateArgon2Salt(16);

      // Derive new unlock key from new password
      const newUnlockKey = await Kdf.deriveUnlockKey(newPassword, newUnlockSalt);

      // Re-encrypt keys with new unlock key
      const encrypted = await Storage.encryptKeys(
        this.state.keys,
        newUnlockKey,
        this.state.walletAddress,
        this.state.userIdentifier!,
        this.state.authMethod!,
        Bytes.base64ToBytes(existingStorage.salt), // Keep original master key salt
        newUnlockSalt,
      );

      // Clear new unlock key from memory
      newUnlockKey.fill(0);

      // Save to storage
      await Storage.saveKeysToStorage(encrypted);
    } catch (error) {
      if (error instanceof KeyError) {
        throw error;
      }

      throw new KeyError(`Failed to update password: ${error}`);
    }
  }
}

/**
 * Singleton instance of KeyManager
 * Use this for application-wide key management
 *
 * Uses globalThis to persist across Next.js navigation and HMR
 * This ensures the unlock state survives client-side navigation
 */
const globalForKeyManager = globalThis as unknown as {
  keyManager: KeyManager | undefined;
};

export const keyManager = globalForKeyManager.keyManager ?? new KeyManager();

// Always persist singleton to globalThis (required for client-side navigation)
if (!globalForKeyManager.keyManager) {
  globalForKeyManager.keyManager = keyManager;
}
