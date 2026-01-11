import { Bytes } from '@/lib/helpers/bytes';
import { encodeAbiParameters, parseAbiParameters, keccak256, toBytes } from 'viem';

/**
 * Proof Generation API Types
 */
export interface UsernameProofRequest {
  username: string;
  wallet: string;
  secret: string; // hex string
}

export interface UsernameProofResponse {
  public_values: `0x${string}`; // ABI-encoded (username_hash, commitment)
  vkey: `0x${string}`;
  proof: `0x${string}`;
}

/**
 * Extract commitment (bytes32) from ABI-encoded public_values
 * public_values format: (bytes32 username_hash, bytes32 commitment)
 */
export function extractCommitmentFromPublicValues(publicValues: `0x${string}`): `0x${string}` {
  const hex = publicValues.slice(2); // remove 0x
  const commitment = hex.slice(64, 128); // bytes 32-64
  return `0x${commitment}` as `0x${string}`;
}

/**
 * Extract username_hash (bytes32) from ABI-encoded public_values
 * public_values format: (bytes32 username_hash, bytes32 commitment)
 */
export function extractUsernameHashFromPublicValues(publicValues: `0x${string}`): `0x${string}` {
  const hex = publicValues.slice(2); // remove 0x
  const usernameHash = hex.slice(0, 64); // bytes 0-32
  return `0x${usernameHash}` as `0x${string}`;
}

/**
 * Encode proof for contract submission
 * Contract expects: abi.encode(vkeyHash, publicValues, proofBytes)
 */
export function encodeProofForContract(
  vkey: `0x${string}`,
  publicValues: `0x${string}`,
  proof: `0x${string}`,
): `0x${string}`;

/**
 * Overload: Accept proof response object
 */
export function encodeProofForContract(
  proofResponse: UsernameProofResponse | { vkey: `0x${string}`; public_values: `0x${string}`; proof: `0x${string}` },
): `0x${string}`;

// Implementation
export function encodeProofForContract(
  vkeyOrProof:
    | `0x${string}`
    | UsernameProofResponse
    | { vkey: `0x${string}`; public_values: `0x${string}`; proof: `0x${string}` },
  publicValues?: `0x${string}`,
  proof?: `0x${string}`,
): `0x${string}` {
  // Handle both calling conventions
  let vkey: `0x${string}`;
  let pubVals: `0x${string}`;
  let proofBytes: `0x${string}`;

  if (typeof vkeyOrProof === 'object') {
    // Object parameter style
    vkey = vkeyOrProof.vkey;
    pubVals = vkeyOrProof.public_values;
    proofBytes = vkeyOrProof.proof;
  } else {
    // Individual parameters style
    vkey = vkeyOrProof;
    pubVals = publicValues!;
    proofBytes = proof!;
  }

  return encodeAbiParameters(parseAbiParameters('bytes32, bytes, bytes'), [vkey, pubVals, proofBytes]);
}

export interface ClaimingProofRequest {
  stealthAddress: string;
  ephemeralPubkey: string;
  viewingPrivateKey: string;
  spendingPrivateKey: string;
}

export interface ClaimingProofResponse {
  proof: `0x${string}`;
}

/**
 * MOCK: Generate ZK proof for username registration
 *
 * This mock version generates a valid proof locally without calling any backend.
 * The MockSP1Verifier contract will accept any proof as long as the public values match.
 *
 * @param username - The username to register
 * @param wallet - The wallet address registering the username
 * @param secret - Random secret bytes for commitment
 * @returns Mock proof response with valid public values
 */
export async function generateUsernameProof(
  username: string,
  wallet: string,
  secret: Uint8Array,
): Promise<UsernameProofResponse>;

/**
 * Overload: Accept object parameter and auto-generate secret
 */
export async function generateUsernameProof(params: {
  username: string;
  wallet: string;
}): Promise<{ public_values: `0x${string}`; vkey: `0x${string}`; proof: `0x${string}`; commitment: `0x${string}` }>;

// Implementation
export async function generateUsernameProof(
  usernameOrParams: string | { username: string; wallet: string },
  wallet?: string,
  secret?: Uint8Array,
): Promise<
  | UsernameProofResponse
  | { public_values: `0x${string}`; vkey: `0x${string}`; proof: `0x${string}`; commitment: `0x${string}` }
> {
  // Handle both calling conventions
  let username: string;
  let walletAddress: string;
  let secretBytes: Uint8Array;

  if (typeof usernameOrParams === 'object') {
    // Object parameter style
    username = usernameOrParams.username;
    walletAddress = usernameOrParams.wallet;
    // Generate random secret
    secretBytes = crypto.getRandomValues(new Uint8Array(32));
  } else {
    // Individual parameters style
    username = usernameOrParams;
    walletAddress = wallet!;
    secretBytes = secret!;
  }

  // Calculate username hash (same as contract does)
  const usernameHash = keccak256(toBytes(username));

  // Calculate commitment: keccak256(username_hash, wallet, secret)
  const commitment = keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, address, bytes32'), [
      usernameHash,
      walletAddress as `0x${string}`,
      Bytes.bytesToHex(secretBytes) as `0x${string}`,
    ]),
  );

  // Encode public values: (username_hash, commitment)
  const publicValues = encodeAbiParameters(parseAbiParameters('bytes32, bytes32'), [usernameHash, commitment]);

  // Mock vkey (can be any bytes32, MockSP1Verifier doesn't check it)
  const vkey = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

  // Mock proof bytes (can be any bytes, MockSP1Verifier doesn't check it)
  const proof = '0x1234567890abcdef' as `0x${string}`;

  // Simulate small delay to mimic network request
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return with commitment for object style
  if (typeof usernameOrParams === 'object') {
    return {
      public_values: publicValues as `0x${string}`,
      vkey,
      proof,
      commitment,
    };
  }

  // Return standard response for parameter style
  return {
    public_values: publicValues as `0x${string}`,
    vkey,
    proof,
  };
}

/**
 * MOCK: Generate ZK proof for claiming stealth payment
 *
 * This mock version generates a valid proof locally without calling any backend.
 * The MockSP1Verifier contract will accept any proof as long as the public values match.
 *
 * @param stealthAddress - The stealth address being claimed
 * @param ephemeralPubkey - The ephemeral public key from the payment
 * @param viewingPrivateKey - The recipient's viewing private key (not used in mock)
 * @param spendingPrivateKey - The recipient's spending private key (not used in mock)
 * @returns Mock proof response with encoded proof for contract
 */
export async function generateClaimingProof(
  stealthAddress: string,
  ephemeralPubkey: string,
  viewingPrivateKey: string,
  spendingPrivateKey: string,
): Promise<ClaimingProofResponse> {
  // The claimer address will be msg.sender in the contract
  // For the mock, we need to encode public values that will match what the contract expects

  // Calculate ephemeral pubkey hash (same as contract does)
  const ephemeralPubkeyBytes = Bytes.hexToBytes(ephemeralPubkey as `0x${string}`);
  const ephemeralPubkeyHash = keccak256(ephemeralPubkeyBytes);

  // Note: The claimer address is msg.sender in the contract, so we can't know it here
  // The frontend should pass the claimer address or get it from the wallet
  // For now, we'll use a placeholder that should be replaced by the actual flow

  // Mock vkey
  const vkey = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

  // Mock proof bytes
  const proofBytes = '0xabcdef1234567890' as `0x${string}`;

  // The actual public values encoding will be done in the hook with the actual claimer address
  // Here we just return a placeholder - the hook should call encodeClaimingProofForContract

  // Simulate small delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return a minimal proof - the actual encoding happens in encodeClaimingProofForContract
  return {
    proof: encodeAbiParameters(parseAbiParameters('bytes32, bytes, bytes'), [
      vkey,
      '0x' as `0x${string}`,
      proofBytes,
    ]) as `0x${string}`,
  };
}

/**
 * MOCK: Encode claiming proof with actual claimer address
 *
 * This should be called after generateClaimingProof with the actual msg.sender address
 *
 * @param stealthAddress - The stealth address being claimed
 * @param ephemeralPubkeyHash - The keccak256 hash of the ephemeral public key
 * @param claimerAddress - The address that will call claimFromStealth (msg.sender)
 * @returns Encoded proof ready for contract submission
 */
export function encodeClaimingProofForContract(
  stealthAddress: `0x${string}`,
  ephemeralPubkeyHash: `0x${string}`,
  claimerAddress: `0x${string}`,
): `0x${string}` {
  // Mock vkey
  const vkey = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

  // Encode public values: (stealth_address, ephemeral_hash, claimer_address)
  const publicValues = encodeAbiParameters(parseAbiParameters('address, bytes32, address'), [
    stealthAddress,
    ephemeralPubkeyHash,
    claimerAddress,
  ]);

  // Mock proof bytes
  const proofBytes = '0xabcdef1234567890' as `0x${string}`;

  // Encode full proof: (vkey, publicValues, proofBytes)
  return encodeAbiParameters(parseAbiParameters('bytes32, bytes, bytes'), [
    vkey,
    publicValues,
    proofBytes,
  ]) as `0x${string}`;
}
