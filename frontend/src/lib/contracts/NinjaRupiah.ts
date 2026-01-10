import { NinahABI } from '@/lib/contracts/abi';
import { contractAddress } from '@/lib/contracts/addresses';
import type { WalletProvider } from '@/lib/keys/types';
import { createPrivyWalletClient, publicClient } from '@/lib/contracts/client';
import { Bytes } from '@/lib/helpers/bytes';
import { keccak256, toBytes } from 'viem';

const contractAdd = contractAddress.NinahContractAddress as `0x${string}`;

/**
 * READ FUNCTIONS CONTRACT
 */

/**
 * Check if a username is available (hashes the username for privacy)
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  // Hash the username before checking on-chain
  const usernameHash = keccak256(toBytes(username));
  return (await publicClient.readContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'isUsernameHashAvailable',
    args: [usernameHash],
  })) as boolean;
}

/**
 * Get username hash for an address (returns bytes32, not plaintext)
 */
export async function getUsernameHash(address: `0x${string}`): Promise<`0x${string}`> {
  return (await publicClient.readContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'getUsernameHash',
    args: [address],
  })) as `0x${string}`;
}

export async function getMetaKeys(address: `0x${string}`) {
  return await publicClient.readContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'getMetaKeys',
    args: [address],
  });
}

export async function getStealthPayment(address: `0x${string}`) {
  return await publicClient.readContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'getStealthPayment',
    args: [address],
  });
}

/**
 * WRITE FUNCTIONS CONTRACT
 */

/**
 * Register username with privacy - passes usernameHash instead of plaintext
 */
export async function registerUsername(
  provider: WalletProvider,
  account: `0x${string}`,
  usernameHash: `0x${string}`, // Changed from string username to bytes32 hash
  commitment: `0x${string}`,
  proof: `0x${string}`,
) {
  const walletClient = createPrivyWalletClient(provider);

  // Estimate gas first
  const gasEstimate = await publicClient.estimateContractGas({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'RegisterUsername',
    args: [usernameHash, commitment, proof],
    account,
  });

  const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

  const hash = await walletClient.writeContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'RegisterUsername',
    args: [usernameHash, commitment, proof],
    account,
    gas: gasLimit,
  });

  return await publicClient.waitForTransactionReceipt({
    hash,
  });
}

export async function registerMetaKeys(
  provider: WalletProvider,
  account: `0x${string}`,
  metaViewingPub: Uint8Array,
  metaSpendingPub: Uint8Array,
) {
  console.log('[CONTRACT] Creating wallet client...');
  console.log('[CONTRACT] Provider:', { hasRequest: typeof provider.request });

  const walletClient = createPrivyWalletClient(provider);
  console.log('[CONTRACT] Wallet client created');

  // Convert Uint8Array to hex string using Bytes helper
  const viewingPubHex = Bytes.bytesToHex(metaViewingPub) as `0x${string}`;
  const spendingPubHex = Bytes.bytesToHex(metaSpendingPub) as `0x${string}`;

  console.log('[CONTRACT] Converted public keys to hex');
  console.log('[CONTRACT] Viewing pub hex:', viewingPubHex.substring(0, 20) + '...');
  console.log('[CONTRACT] Spending pub hex:', spendingPubHex.substring(0, 20) + '...');

  console.log('[CONTRACT] Calling writeContract for registerMetaKeys...');
  console.log('[CONTRACT] Contract address:', contractAdd);
  console.log('[CONTRACT] Account:', account);

  try {
    // Estimate gas first to avoid "intrinsic gas too low" error
    console.log('[CONTRACT] Estimating gas...');
    const gasEstimate = await publicClient.estimateContractGas({
      address: contractAdd,
      abi: NinahABI,
      functionName: 'registerMetaKeys',
      args: [viewingPubHex, spendingPubHex],
      account,
    });

    console.log('[CONTRACT] Gas estimated:', gasEstimate.toString());

    // Add 20% buffer to gas estimate for safety
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);
    console.log('[CONTRACT] Gas limit with 20% buffer:', gasLimit.toString());

    const hash = await walletClient.writeContract({
      address: contractAdd,
      abi: NinahABI,
      functionName: 'registerMetaKeys',
      args: [viewingPubHex, spendingPubHex],
      account,
      gas: gasLimit,
    });

    console.log('[CONTRACT] Transaction sent! Hash:', hash);
    console.log('[CONTRACT] Waiting for transaction receipt...');

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    console.log('[CONTRACT] Transaction confirmed!');
    return receipt;
  } catch (error) {
    console.error('[CONTRACT] Error in registerMetaKeys:', error);
    throw error;
  }
}

export async function sendToStealth(
  provider: WalletProvider,
  account: `0x${string}`,
  stealthAddress: `0x${string}`,
  amount: bigint,
  ephemeralPubkey: Uint8Array,
) {
  const walletClient = createPrivyWalletClient(provider);

  const hash = await walletClient.writeContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'sendToStealth',
    args: [stealthAddress, amount, ephemeralPubkey],
    account,
  });

  return await publicClient.waitForTransactionReceipt({
    hash,
  });
}

export async function claimFromStealth(
  provider: WalletProvider,
  account: `0x${string}`,
  stealthAddress: `0x${string}`,
  proof: `0x${string}`,
) {
  const walletClient = createPrivyWalletClient(provider);

  const hash = await walletClient.writeContract({
    address: contractAdd,
    abi: NinahABI,
    functionName: 'claimFromStealth',
    args: [stealthAddress, proof],
    account,
  });

  return await publicClient.waitForTransactionReceipt({
    hash,
  });
}
