/**
 * Helper Utilities for NinjaRupiah
 *
 * Centralized utility module providing essential helper functions and classes
 * for the entire application. Includes byte manipulation, encoding, validation,
 * error handling, and application constants.
 *
 * ## Available Utilities:
 *
 * ### Bytes
 * Low-level byte array operations for cryptographic primitives.
 * - Concatenate, compare, copy, zero byte arrays
 * - Convert between bytes and hex/base64/string formats
 * - Constant-time comparisons for security
 *
 * ### Encoding
 * High-level encoding utilities for Ethereum and storage.
 * - EIP-55 checksum addresses
 * - Hex padding and BigInt encoding
 * - JSON serialization for IndexedDB
 *
 * ### Validation
 * Comprehensive input validation with detailed error messages.
 * - Password strength analysis (zxcvbn)
 * - Address, hex, amount validation
 * - Public/private key validation
 * - Username format validation
 *
 * ### Errors
 * Type-safe error hierarchy for the entire application.
 * - 11 specialized error classes
 * - Standardized error codes (ERROR_CODES)
 * - Type guard functions for error checking
 * - Error message formatting
 *
 * ### Constants
 * Application-wide configuration constants.
 * - Versioning and protocol identifiers
 * - Cryptographic parameters (Argon2, key sizes)
 * - Network and contract addresses
 * - Validation rules and constraints
 *
 * ## Usage Patterns:
 *
 * @example
 * ```typescript
 * // Import specific utilities
 * import { Bytes, Validation, ERROR_CODES } from '@/lib/helpers';
 *
 * // Byte manipulation
 * const combined = Bytes.concatBytes(nonce, ciphertext, tag);
 * const hex = Bytes.bytesToHex(privateKey);
 *
 * // Validation
 * const result = Validation.validatePassword(password);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 *
 * // Error handling
 * import { AuthError, isAuthError } from '@/lib/helpers';
 * try {
 *   await unlock(password);
 * } catch (error) {
 *   if (isAuthError(error)) {
 *     console.error("Auth failed:", error.code);
 *   }
 * }
 *
 * // Use constants
 * import { MAX_USERNAME_LENGTH, KEY_SIZES } from '@/lib/helpers';
 * if (username.length > MAX_USERNAME_LENGTH) {
 *   throw new Error("Username too long");
 * }
 * ```
 *
 * ## Architecture:
 * All helpers are designed as static utility classes or pure functions.
 * No state is maintained - all operations are stateless and side-effect free.
 * Browser-compatible - no Node.js dependencies (uses Uint8Array, not Buffer).
 */

// Byte manipulation utilities
export { Bytes } from '@/lib/helpers/bytes';

// Encoding utilities (addresses, hex, storage)
export { Encoding } from '@/lib/helpers/encoding';

// Validation utilities
export { Validation } from '@/lib/helpers/validation';
export type { ValidationResult, PasswordValidationResult } from '@/lib/helpers/validation';

// Error classes and utilities
export {
  NinjaRupiahError,
  AuthError,
  KeyError,
  UsernameError,
  CryptoError,
  StorageError,
  ContractError,
  PaymentError,
  ProofError,
  ValidationError,
  NetworkError,
  ERROR_CODES,
  isAuthError,
  isKeyError,
  isUsernameError,
  isCryptoError,
  isStorageError,
  isContractError,
  isPaymentError,
  isProofError,
  formatError,
} from '@/lib/helpers/errors';

// Constants
export {
  APP_VERSION,
  KEY_DERIVATION_VERSION,
  SIGNATURE_MESSAGE_TEMPLATE,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_REGEX,
  ALLOWED_USERNAME_CHARS,
  PASSWORD_REQUIREMENT,
  ARGON2_CONFIG,
  STORAGE_KEYS,
  KEY_SIZES,
  NETWORKS,
  CONTRACT_ADDRESSES,
  PROOF_ENDPOINTS,
  SCANNER_CONFIG,
  ZERO_ADDRESS,
  ZERO_BYTES32,
  ERROR_MESSAGES,
} from '@/lib/helpers/constants';
