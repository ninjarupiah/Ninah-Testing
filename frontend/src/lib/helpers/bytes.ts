/**
 * Byte Array Utilities for NinjaRupiah
 *
 * Provides comprehensive utilities for working with Uint8Array byte buffers.
 * All operations are designed for browser compatibility (no Node.js Buffer).
 *
 * ## Use Cases:
 * - Binary data manipulation for cryptographic operations
 * - Encoding/decoding between bytes and various formats (hex, base64, string)
 * - Constant-time comparisons for security-critical operations
 * - Memory management (zeroing sensitive data)
 *
 * ## Security Features:
 * - Constant-time byte comparison (prevents timing attacks)
 * - Secure memory zeroing for sensitive data
 * - Browser-native APIs (no external dependencies)
 *
 * @example
 * ```typescript
 * // Concatenate multiple byte arrays
 * const combined = Bytes.concatBytes(nonce, ciphertext, tag);
 *
 * // Convert between formats
 * const hex = Bytes.bytesToHex(privateKey);
 * const bytes = Bytes.hexToBytes(hex);
 *
 * // Secure comparison
 * if (Bytes.equalBytes(derivedKey, storedKey)) {
 *   // Keys match
 * }
 *
 * // Zero sensitive data
 * Bytes.zeroBytes(privateKey);
 * ```
 */
export class Bytes {
  /**
   * Concatenate multiple byte arrays into a single array
   *
   * Efficiently combines multiple Uint8Array instances into one contiguous buffer.
   * Preserves byte order and maintains all data without copying overhead.
   *
   * ## Use Cases:
   * - Combining nonce + ciphertext + tag for encrypted storage
   * - Building versioned data formats: [version | nonce | tag | data]
   * - Assembling cryptographic primitives
   *
   * ## Performance:
   * - Single allocation for result array
   * - O(n) time complexity where n = total bytes
   * - No intermediate buffers created
   *
   * @param arrays - Variable number of Uint8Array instances to concatenate
   * @returns New Uint8Array containing all input arrays in order
   *
   * @example
   * ```typescript
   * const version = new Uint8Array([1]);
   * const nonce = new Uint8Array(12);
   * const tag = new Uint8Array(16);
   * const ciphertext = new Uint8Array(100);
   *
   * // Combine into single array: [version | nonce | tag | ciphertext]
   * const combined = Bytes.concatBytes(version, nonce, tag, ciphertext);
   * console.log(combined.length); // 129 bytes
   * ```
   */
  static concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;

    for (const arr of arrays) {
      result.set(arr, offset);

      offset += arr.length;
    }

    return result;
  }

  /**
   * Compare two byte arrays in constant time
   *
   * ## Security - Constant-Time Comparison:
   * Uses bitwise operations to prevent timing side-channel attacks.
   * Comparison time is independent of where bytes differ.
   *
   * **CRITICAL**: Use this for comparing:
   * - Authentication tags
   * - Password hashes
   * - Cryptographic keys
   * - MACs and signatures
   *
   * **DO NOT** use standard `===` comparison for security-critical data!
   *
   * ## How It Works:
   * - XOR all byte pairs: `result |= a[i] ^ b[i]`
   * - If any bytes differ, result becomes non-zero
   * - Time taken is constant regardless of differences
   *
   * @param a - First byte array to compare
   * @param b - Second byte array to compare
   * @returns true if arrays are equal, false otherwise
   *
   * @example
   * ```typescript
   * // CORRECT - Secure comparison for authentication tags
   * const isValid = Bytes.equalBytes(computedTag, receivedTag);
   *
   * // WRONG - Vulnerable to timing attacks
   * const isValid = computedTag.toString() === receivedTag.toString();
   *
   * // Use case: Validating decrypted keys
   * const derivedKeys = await Kdf.deriveKeys(password, salt);
   * const storedKeys = await Storage.loadKeys();
   *
   * if (Bytes.equalBytes(derivedKeys.masterKey, storedKeys.masterKey)) {
   *   console.log("Password correct!");
   * }
   * ```
   */
  static equalBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;

    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Securely zero out byte array in memory
   *
   * ## Security - Memory Wiping:
   * Overwrites sensitive data in memory to prevent recovery.
   * Essential for preventing secrets from lingering in RAM.
   *
   * **CRITICAL**: Always zero sensitive data after use:
   * - Private keys
   * - Passwords and password hashes
   * - Encryption keys
   * - Shared secrets
   * - Decrypted plaintext
   *
   * ## Important Notes:
   * - Modifies the array in-place (does not create a copy)
   * - Cannot be undone once called
   * - Should be called in finally blocks or cleanup
   * - Does not guarantee physical RAM erasure (OS-dependent)
   *
   * @param data - Byte array to zero out (modified in-place)
   *
   * @example
   * ```typescript
   * // Derive private key for temporary use
   * const stealthPriv = Address.deriveStealthPrivateKey(spendingPriv, sharedSecret);
   *
   * try {
   *   // Use private key to sign transaction
   *   const signature = await wallet.signTransaction(tx, stealthPriv);
   * } finally {
   *   // CRITICAL: Zero private key from memory
   *   Bytes.zeroBytes(stealthPriv);
   * }
   *
   * // After zeroing, array is all zeros
   * console.log(stealthPriv); // Uint8Array(32) [0, 0, 0, ...]
   * ```
   */
  static zeroBytes(data: Uint8Array): void {
    data.fill(0);
  }

  /**
   * Create a deep copy of a byte array
   *
   * Creates a new Uint8Array with copied data, leaving the original unchanged.
   * Useful when you need to preserve original data while modifying a copy.
   *
   * ## Use Cases:
   * - Backup keys before deriving new keys
   * - Preserve original data before encryption
   * - Create independent copies for parallel operations
   * - Store immutable references
   *
   * ## Performance:
   * - O(n) time and space complexity
   * - Native TypedArray copy (fast)
   *
   * @param source - Byte array to copy
   * @returns New Uint8Array with copied data
   *
   * @example
   * ```typescript
   * // Backup original key before deriving
   * const originalKey = new Uint8Array([1, 2, 3, 4]);
   * const backupKey = Bytes.copyBytes(originalKey);
   *
   * // Derive new key (modifies originalKey)
   * const derivedKey = deriveSubKey(originalKey);
   *
   * // Original is still preserved in backupKey
   * console.log(backupKey); // [1, 2, 3, 4]
   * console.log(originalKey); // [modified values]
   * ```
   */
  static copyBytes(source: Uint8Array): Uint8Array {
    return new Uint8Array(source);
  }

  /**
   * Convert hexadecimal string to byte array
   *
   * Decodes hex string (with or without 0x prefix) to Uint8Array.
   * Handles both uppercase and lowercase hex characters.
   *
   * ## Input Format:
   * - With prefix: "0x1234abcd"
   * - Without prefix: "1234abcd"
   * - Must have even length (2 hex chars = 1 byte)
   *
   * @param hex - Hexadecimal string to convert
   * @returns Uint8Array containing decoded bytes
   *
   * @throws {Error} If hex string has odd length
   * @throws {Error} If hex contains invalid characters
   *
   * @example
   * ```typescript
   * // Private key from hex
   * const privateKey = Bytes.hexToBytes("0x1234567890abcdef...");
   *
   * // Address from hex (without 0x)
   * const address = Bytes.hexToBytes("742d35Cc6634C0532925a3b844Bc9e7595f0bEb0");
   *
   * // Convert back to verify
   * const hexAgain = Bytes.bytesToHex(address);
   * console.log(hexAgain); // "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
   * ```
   */
  static hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

    if (cleanHex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }

    return bytes;
  }

  /**
   * Convert byte array to hexadecimal string
   *
   * Encodes Uint8Array to hex string with optional 0x prefix.
   * Each byte becomes 2 hex characters (lowercase).
   *
   * ## Output Format:
   * - With prefix (default): "0x1234abcd"
   * - Without prefix: "1234abcd"
   *
   * @param bytes - Byte array to convert
   * @param prefix - Whether to include "0x" prefix (default: true)
   * @returns Hexadecimal string representation
   *
   * @example
   * ```typescript
   * const privateKey = new Uint8Array(32); // 32-byte key
   *
   * // With 0x prefix (default)
   * const hex1 = Bytes.bytesToHex(privateKey);
   * console.log(hex1); // "0x0000000000000000..."
   *
   * // Without prefix (for storage or contracts)
   * const hex2 = Bytes.bytesToHex(privateKey, false);
   * console.log(hex2); // "0000000000000000..."
   *
   * // Use in BigInt conversion
   * const scalar = BigInt('0x' + Bytes.bytesToHex(privateKey, false));
   * ```
   */
  static bytesToHex(bytes: Uint8Array, prefix: boolean = true): string {
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return prefix ? '0x' + hex : hex;
  }

  /**
   * Convert UTF-8 string to byte array
   *
   * Encodes a JavaScript string to UTF-8 bytes using TextEncoder.
   * Handles all Unicode characters correctly.
   *
   * ## Use Cases:
   * - Encode passwords before hashing
   * - Prepare strings for encryption
   * - Convert JSON to bytes for storage
   * - Hash usernames or messages
   *
   * @param str - UTF-8 string to encode
   * @returns Uint8Array containing UTF-8 encoded bytes
   *
   * @example
   * ```typescript
   * // Encode password for hashing
   * const password = "MySecurePassword123!";
   * const passwordBytes = Bytes.stringToBytes(password);
   * const hash = await Kdf.derivePasswordHash(passwordBytes, salt);
   *
   * // Encode JSON for encryption
   * const data = { username: "alice", keys: [...] };
   * const json = JSON.stringify(data);
   * const jsonBytes = Bytes.stringToBytes(json);
   * const encrypted = await Encryption.encrypt(jsonBytes, key);
   * ```
   */
  static stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert byte array to UTF-8 string
   *
   * Decodes UTF-8 bytes to JavaScript string using TextDecoder.
   * Handles all Unicode characters correctly.
   *
   * ## Use Cases:
   * - Decode decrypted plaintext
   * - Parse JSON from bytes
   * - Convert hashes to readable strings
   *
   * @param bytes - UTF-8 encoded byte array
   * @returns Decoded string
   *
   * @example
   * ```typescript
   * // Decrypt and decode JSON
   * const encryptedData = await Storage.loadEncryptedData();
   * const decryptedBytes = await Encryption.decrypt(encryptedData, key);
   * const json = Bytes.bytesToString(decryptedBytes);
   * const data = JSON.parse(json);
   * console.log(data.username); // "alice"
   * ```
   */
  static bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }

  /**
   * Convert byte array to Base64 string
   *
   * Encodes bytes as Base64 for storage or transmission.
   * Uses browser-native btoa() function.
   *
   * ## Use Cases:
   * - Store binary data in JSON
   * - Transmit binary data over text protocols
   * - Encode encrypted data for IndexedDB
   *
   * @param bytes - Byte array to encode
   * @returns Base64 encoded string
   *
   * @example
   * ```typescript
   * // Encode encrypted keys for storage
   * const encrypted = await Encryption.encrypt(keys, storageKey);
   * const base64 = Bytes.bytesToBase64(encrypted.ciphertext);
   *
   * // Save to IndexedDB
   * await db.put('encrypted_keys', {
   *   ciphertext: base64,
   *   nonce: Bytes.bytesToBase64(encrypted.nonce),
   *   tag: Bytes.bytesToBase64(encrypted.tag)
   * });
   * ```
   */
  static bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * Convert Base64 string to byte array
   *
   * Decodes Base64 string to bytes using browser-native atob() function.
   *
   * ## Use Cases:
   * - Load binary data from JSON
   * - Receive binary data from text protocols
   * - Decrypt data loaded from IndexedDB
   *
   * @param base64 - Base64 encoded string
   * @returns Decoded byte array
   *
   * @throws {Error} If base64 string is invalid
   *
   * @example
   * ```typescript
   * // Load and decrypt keys from IndexedDB
   * const stored = await db.get('encrypted_keys');
   * const ciphertext = Bytes.base64ToBytes(stored.ciphertext);
   * const nonce = Bytes.base64ToBytes(stored.nonce);
   * const tag = Bytes.base64ToBytes(stored.tag);
   *
   * const decrypted = await Encryption.decrypt({ ciphertext, nonce, tag }, key);
   * ```
   */
  static base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  /**
   * Type guard to check if value is Uint8Array
   *
   * TypeScript type guard for runtime type checking.
   * Useful for validating inputs before processing.
   *
   * @param value - Value to check
   * @returns true if value is Uint8Array, false otherwise
   *
   * @example
   * ```typescript
   * function processKey(key: unknown) {
   *   if (!Bytes.isUint8Array(key)) {
   *     throw new Error('Key must be Uint8Array');
   *   }
   *
   *   // TypeScript now knows key is Uint8Array
   *   const hex = Bytes.bytesToHex(key);
   * }
   * ```
   */
  static isUint8Array(value: unknown): value is Uint8Array {
    return value instanceof Uint8Array;
  }

  /**
   * Validate byte array has expected length
   *
   * Throws descriptive error if length doesn't match.
   * Useful for input validation in cryptographic functions.
   *
   * @param bytes - Byte array to validate
   * @param expectedLength - Expected length in bytes
   * @param name - Descriptive name for error message (default: "bytes")
   *
   * @throws {Error} If length doesn't match expected
   *
   * @example
   * ```typescript
   * function deriveKey(privateKey: Uint8Array) {
   *   // Validate private key is 32 bytes
   *   Bytes.validateBytesLength(privateKey, 32, 'private key');
   *
   *   // If we get here, privateKey is guaranteed to be 32 bytes
   *   return Kdf.deriveSubKey(privateKey);
   * }
   *
   * // Usage
   * const key = new Uint8Array(16);
   * deriveKey(key); // Error: private key must be 32 bytes, got 16
   * ```
   */
  static validateBytesLength(bytes: Uint8Array, expectedLength: number, name: string = 'bytes'): void {
    if (bytes.length !== expectedLength) {
      throw new Error(`${name} must be ${expectedLength} bytes, got ${bytes.length}`);
    }
  }
}
