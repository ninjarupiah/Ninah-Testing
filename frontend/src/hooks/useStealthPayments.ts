import { useState, useEffect, useCallback } from 'react';
import { formatUnits, decodeFunctionData, decodeAbiParameters } from 'viem';
import { publicClient } from '@/lib/contracts';
import { NinahABI } from '@/lib/contracts/abi';
import { contractAddress } from '@/lib/contracts/addresses';
import { Address } from '@/lib/stealth';
import { keyManager } from '@/lib/keys/manager';
import { Bytes } from '@/lib/helpers/bytes';

// ERC-4337 EntryPoint handleOps ABI
// Selector 0x1fad948c = handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[],address)
const ENTRYPOINT_HANDLEOPS_PARAMS = [
  {
    name: 'ops',
    type: 'tuple[]',
    components: [
      { name: 'sender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'initCode', type: 'bytes' },
      { name: 'callData', type: 'bytes' },
      { name: 'callGasLimit', type: 'uint256' },
      { name: 'verificationGasLimit', type: 'uint256' },
      { name: 'preVerificationGas', type: 'uint256' },
      { name: 'maxFeePerGas', type: 'uint256' },
      { name: 'maxPriorityFeePerGas', type: 'uint256' },
      { name: 'paymasterAndData', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ],
  },
  { name: 'beneficiary', type: 'address' },
] as const;

// Coinbase Smart Wallet execute function (batch version)
// Selector 0x34fcd5be = execute((address,uint256,bytes)[])
const SMART_WALLET_EXECUTE_BATCH_PARAMS = [
  {
    name: 'calls',
    type: 'tuple[]',
    components: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
  },
] as const;

// Coinbase Smart Wallet execute function (single call version)
// Selector 0xb61d27f6 = execute(address,uint256,bytes)
const SMART_WALLET_EXECUTE_SINGLE_PARAMS = [
  { name: 'dest', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'func', type: 'bytes' },
] as const;

export interface StealthTransaction {
  id: string;
  type: 'sent' | 'received';
  stealthAddress: `0x${string}`;
  amount: string;
  rawAmount: bigint;
  timestamp: number;
  status: 'completed' | 'pending' | 'claimed';
  sender: `0x${string}`;
  txHash: `0x${string}`;
  ephemeralPubkey: `0x${string}`;
}

interface StealthPaymentsState {
  transactions: StealthTransaction[];
  loading: boolean;
  scanning: boolean;
  error: Error | null;
  keysLocked: boolean;
  stats: {
    totalTransactions: number;
    totalReceived: string;
    totalSent: string;
    totalClaimed: string;
    totalUnclaimed: string;
  };
}

/**
 * Scan for incoming stealth payments
 *
 * This hook:
 * 1. Fetches StealthPaymentSent events from the contract
 * 2. For each event, decodes the transaction calldata to get the full ephemeral pubkey
 * 3. Uses the user's viewing private key to check if the payment is for them
 * 4. Returns the list of payments belonging to the user
 */
export function useStealthPayments(walletAddress: `0x${string}` | undefined) {
  const [state, setState] = useState<StealthPaymentsState>({
    transactions: [],
    loading: true,
    scanning: false,
    error: null,
    keysLocked: true,
    stats: {
      totalTransactions: 0,
      totalReceived: '0',
      totalSent: '0',
      totalClaimed: '0',
      totalUnclaimed: '0',
    },
  });

  const scanPayments = useCallback(async () => {
    if (!walletAddress) {
      setState({
        transactions: [],
        loading: false,
        scanning: false,
        error: null,
        keysLocked: true,
        stats: {
          totalTransactions: 0,
          totalReceived: '0',
          totalSent: '0',
          totalClaimed: '0',
          totalUnclaimed: '0',
        },
      });
      return;
    }

    // Check if keys are unlocked
    if (!keyManager.isUnlocked()) {
      setState((prev) => ({
        ...prev,
        loading: false,
        scanning: false,
        keysLocked: true,
        error: null,
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, scanning: true, error: null, keysLocked: false }));

      // Get user's meta keys from keyManager
      const keys = keyManager.getKeys();
      const metaViewingPriv = keys.metaViewingPriv;
      const metaSpendingPub = keys.metaSpendingPub;

      console.log('[SCAN] Starting payment scan...');
      console.log('[SCAN] Meta spending pub:', Bytes.bytesToHex(metaSpendingPub));

      // Get current block and calculate scan range (last 99,000 blocks due to RPC limit of 100,000)
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > BigInt(99000) ? currentBlock - BigInt(99000) : BigInt(0);

      console.log('[SCAN] Scanning from block', fromBlock.toString(), 'to', currentBlock.toString());

      // Fetch StealthPaymentSent events
      const logs = await publicClient.getLogs({
        address: contractAddress.NinahContractAddress as `0x${string}`,
        event: {
          type: 'event',
          name: 'StealthPaymentSent',
          inputs: [
            { type: 'address', name: 'stealthAddress', indexed: true },
            { type: 'address', name: 'sender', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
            { type: 'bytes32', name: 'ephemeralPubkeyHash', indexed: false },
          ],
        },
        fromBlock,
        toBlock: 'latest',
      });

      console.log('[SCAN] Found', logs.length, 'StealthPaymentSent events');

      const myPayments: StealthTransaction[] = [];

      // Process each event
      for (const log of logs) {
        try {
          const senderAddress = (log.args.sender as string).toLowerCase();
          const currentWallet = walletAddress.toLowerCase();

          // Check if this is a SENT transaction (we are the sender)
          if (senderAddress === currentWallet) {
            console.log('[SCAN] Found SENT payment from us:', log.args.stealthAddress);

            // Get the block for timestamp
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

            // Get payment status from contract
            const paymentData = (await publicClient.readContract({
              address: contractAddress.NinahContractAddress as `0x${string}`,
              abi: NinahABI,
              functionName: 'getStealthPayment',
              args: [log.args.stealthAddress],
            })) as { amount: bigint; claimed: boolean; sender: `0x${string}`; timestamp: bigint };

            myPayments.push({
              id: `${log.transactionHash}-${log.logIndex}-sent`,
              type: 'sent',
              stealthAddress: log.args.stealthAddress as `0x${string}`,
              amount: formatUnits(log.args.amount as bigint, 6),
              rawAmount: log.args.amount as bigint,
              timestamp: Number(block.timestamp),
              status: paymentData.claimed ? 'claimed' : 'completed',
              sender: log.args.sender as `0x${string}`,
              txHash: log.transactionHash,
              ephemeralPubkey: '0x' as `0x${string}`,
            });

            continue; // Skip to next log, don't check if it's for us
          }

          // Get the transaction to decode calldata
          const tx = await publicClient.getTransaction({ hash: log.transactionHash });

          console.log('[SCAN] Transaction:', {
            hash: tx.hash,
            to: tx.to,
            inputSelector: tx.input.slice(0, 10),
            inputLength: tx.input.length,
          });

          let ephemeralPubkeyHex: `0x${string}`;

          // Try to decode the calldata - it might be direct or wrapped in smart wallet execute
          try {
            // First try direct sendToStealth call
            const decoded = decodeFunctionData({
              abi: NinahABI,
              data: tx.input,
            });

            if (decoded.functionName !== 'sendToStealth') continue;
            const args = decoded.args as [`0x${string}`, bigint, `0x${string}`];
            ephemeralPubkeyHex = args[2];
          } catch {
            // Try decoding as ERC-4337 UserOperation via EntryPoint
            try {
              const selector = tx.input.slice(0, 10);
              const ninahAddress = (contractAddress.NinahContractAddress as string).toLowerCase();
              let foundEphemeralPubkey: `0x${string}` | null = null;

              // Check if this is handleOps on EntryPoint (0x1fad948c)
              if (selector === '0x1fad948c') {
                console.log('[SCAN] Decoding ERC-4337 handleOps...');

                // Decode the handleOps parameters
                const paramsData = `0x${tx.input.slice(10)}` as `0x${string}`;
                const decoded = decodeAbiParameters(ENTRYPOINT_HANDLEOPS_PARAMS, paramsData);

                const ops = decoded[0] as readonly {
                  sender: `0x${string}`;
                  nonce: bigint;
                  initCode: `0x${string}`;
                  callData: `0x${string}`;
                  callGasLimit: bigint;
                  verificationGasLimit: bigint;
                  preVerificationGas: bigint;
                  maxFeePerGas: bigint;
                  maxPriorityFeePerGas: bigint;
                  paymasterAndData: `0x${string}`;
                  signature: `0x${string}`;
                }[];

                console.log('[SCAN] Found', ops.length, 'UserOperations');

                // Process each UserOperation
                for (const op of ops) {
                  console.log('[SCAN] UserOp sender:', op.sender);
                  console.log('[SCAN] UserOp callData selector:', op.callData.slice(0, 10));

                  // The callData is the smart wallet's function call
                  const callDataSelector = op.callData.slice(0, 10);

                  // Check for execute(address,uint256,bytes) = 0xb61d27f6 (single call)
                  if (callDataSelector === '0xb61d27f6') {
                    console.log('[SCAN] Decoding smart wallet execute (single)...');
                    const executeParams = `0x${op.callData.slice(10)}` as `0x${string}`;
                    const executeDecoded = decodeAbiParameters(SMART_WALLET_EXECUTE_SINGLE_PARAMS, executeParams);

                    const [dest, , func] = executeDecoded as [`0x${string}`, bigint, `0x${string}`];

                    console.log('[SCAN] Single execute to:', dest.toLowerCase(), 'selector:', func.slice(0, 10));

                    if (dest.toLowerCase() === ninahAddress) {
                      try {
                        const innerDecoded = decodeFunctionData({
                          abi: NinahABI,
                          data: func,
                        });

                        console.log('[SCAN] Ninah function:', innerDecoded.functionName);

                        if (innerDecoded.functionName === 'sendToStealth') {
                          const innerArgs = innerDecoded.args as [`0x${string}`, bigint, `0x${string}`];
                          foundEphemeralPubkey = innerArgs[2];
                          console.log('[SCAN] Found ephemeral pubkey:', foundEphemeralPubkey);
                        }
                      } catch (decodeErr) {
                        console.log('[SCAN] Failed to decode Ninah call:', decodeErr);
                      }
                    }
                  }

                  // Check for execute((address,uint256,bytes)[]) = 0x34fcd5be (batch)
                  if (callDataSelector === '0x34fcd5be' && !foundEphemeralPubkey) {
                    console.log('[SCAN] Decoding smart wallet execute (batch)...');
                    const executeParams = `0x${op.callData.slice(10)}` as `0x${string}`;
                    const executeDecoded = decodeAbiParameters(SMART_WALLET_EXECUTE_BATCH_PARAMS, executeParams);

                    const calls = executeDecoded[0] as readonly {
                      target: `0x${string}`;
                      value: bigint;
                      data: `0x${string}`;
                    }[];

                    console.log('[SCAN] Execute contains', calls.length, 'calls');

                    for (const call of calls) {
                      console.log('[SCAN] Call to:', call.target.toLowerCase(), 'selector:', call.data.slice(0, 10));

                      if (call.target.toLowerCase() === ninahAddress) {
                        try {
                          const innerDecoded = decodeFunctionData({
                            abi: NinahABI,
                            data: call.data,
                          });

                          console.log('[SCAN] Ninah function:', innerDecoded.functionName);

                          if (innerDecoded.functionName === 'sendToStealth') {
                            const innerArgs = innerDecoded.args as [`0x${string}`, bigint, `0x${string}`];
                            foundEphemeralPubkey = innerArgs[2];
                            console.log('[SCAN] Found ephemeral pubkey:', foundEphemeralPubkey);
                            break;
                          }
                        } catch (decodeErr) {
                          console.log('[SCAN] Failed to decode Ninah call:', decodeErr);
                        }
                      }
                    }
                  }

                  if (foundEphemeralPubkey) break;
                }
              }

              if (!foundEphemeralPubkey) {
                console.log('[SCAN] No sendToStealth call found');
                continue;
              }
              ephemeralPubkeyHex = foundEphemeralPubkey;
            } catch (innerErr) {
              console.warn('[SCAN] Could not decode transaction:', innerErr);
              continue;
            }
          }

          // Convert ephemeral pubkey from hex to bytes
          const ephemeralPubkey = Bytes.hexToBytes(ephemeralPubkeyHex);

          console.log('[SCAN] Checking payment:', {
            stealthAddress: log.args.stealthAddress,
            ephemeralPubkeyHex: ephemeralPubkeyHex,
            ephemeralPubkeyLength: ephemeralPubkey.length,
          });

          // Convert stealth address to bytes (remove 0x, it's 20 bytes)
          const stealthAddressBytes = Bytes.hexToBytes(log.args.stealthAddress as `0x${string}`);

          console.log('[SCAN] Stealth address bytes length:', stealthAddressBytes.length);

          // Check if this payment is for us
          const result = Address.checkStealthPayment(ephemeralPubkey, metaViewingPriv, metaSpendingPub, stealthAddressBytes);

          console.log('[SCAN] Check result:', {
            isForMe: result.isForMe,
            derivedAddress: result.derivedAddress ? Bytes.bytesToHex(result.derivedAddress) : 'none',
            expectedAddress: log.args.stealthAddress,
          });

          if (result.isForMe) {
            console.log('[SCAN] Found payment for me!', log.args.stealthAddress);

            // Get the block for timestamp
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

            // Get payment status from contract
            const paymentData = (await publicClient.readContract({
              address: contractAddress.NinahContractAddress as `0x${string}`,
              abi: NinahABI,
              functionName: 'getStealthPayment',
              args: [log.args.stealthAddress],
            })) as { amount: bigint; claimed: boolean; sender: `0x${string}`; timestamp: bigint };

            myPayments.push({
              id: `${log.transactionHash}-${log.logIndex}`,
              type: 'received',
              stealthAddress: log.args.stealthAddress as `0x${string}`,
              amount: formatUnits(log.args.amount as bigint, 6), // IDRX has 6 decimals
              rawAmount: log.args.amount as bigint,
              timestamp: Number(block.timestamp),
              status: paymentData.claimed ? 'claimed' : 'completed',
              sender: log.args.sender as `0x${string}`,
              txHash: log.transactionHash,
              ephemeralPubkey: ephemeralPubkeyHex,
            });
          }
        } catch (err) {
          console.warn('[SCAN] Error processing log:', err);
          continue;
        }
      }

      console.log('[SCAN] Found', myPayments.length, 'payments for me');

      // Calculate stats
      let totalReceived = BigInt(0);
      let totalSent = BigInt(0);
      let totalClaimed = BigInt(0);
      let totalUnclaimed = BigInt(0);

      for (const payment of myPayments) {
        if (payment.type === 'sent') {
          totalSent += payment.rawAmount;
        } else {
          totalReceived += payment.rawAmount;
          if (payment.status === 'claimed') {
            totalClaimed += payment.rawAmount;
          } else {
            totalUnclaimed += payment.rawAmount;
          }
        }
      }

      setState({
        transactions: myPayments.sort((a, b) => b.timestamp - a.timestamp),
        loading: false,
        scanning: false,
        error: null,
        keysLocked: false,
        stats: {
          totalTransactions: myPayments.length,
          totalReceived: formatUnits(totalReceived, 6),
          totalSent: formatUnits(totalSent, 6),
          totalClaimed: formatUnits(totalClaimed, 6),
          totalUnclaimed: formatUnits(totalUnclaimed, 6),
        },
      });
    } catch (error) {
      console.error('[SCAN] Error scanning payments:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        scanning: false,
        error: error instanceof Error ? error : new Error('Failed to scan payments'),
      }));
    }
  }, [walletAddress]);

  // Scan on mount and when wallet changes
  useEffect(() => {
    scanPayments();
  }, [scanPayments]);

  return {
    ...state,
    refetch: scanPayments,
  };
}
