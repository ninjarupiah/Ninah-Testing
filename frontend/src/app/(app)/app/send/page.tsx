'use client';

import React, { useState, useCallback } from 'react';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconUser, IconCoins, IconSend, IconLoader2, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useWalletBalance } from '@/hooks';
import { getMetaKeys } from '@/lib/contracts/NinjaRupiah';
import { Address } from '@/lib/stealth';
import { Bytes } from '@/lib/helpers/bytes';
import { NinahABI, MockIDRXABI } from '@/lib/contracts/abi';
import { contractAddress } from '@/lib/contracts/addresses';
import { publicClient } from '@/lib/contracts';
import { encodeFunctionData, parseUnits, keccak256, toBytes } from 'viem';

type SendStatus = 'idle' | 'resolving' | 'generating' | 'approving' | 'sending' | 'success' | 'error';

export default function SendPage() {
  const { client: smartWalletClient } = useSmartWallets();

  // Use smart wallet address for balance
  const walletAddress = (smartWalletClient?.account?.address as `0x${string}`) || undefined;

  // Fetch wallet balance
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance(walletAddress);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Format balance for display
  const formatIDRBalance = (balance: string | null) => {
    if (!balance) return 'Rp 0';
    const num = parseFloat(balance);
    return `Rp ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const handleUseMax = () => {
    if (balance) {
      // Subtract network fee (500 IDRX) from max amount
      const maxAmount = Math.max(0, parseFloat(balance) - 500);
      setAmount(maxAmount.toString());
    }
  };

  const handleSend = useCallback(async () => {
    if (!smartWalletClient || !recipient || !amount) return;

    setSendStatus('resolving');
    setSendError(null);
    setTxHash(null);

    try {
      // Parse recipient - support both @username and 0x address
      let recipientAddress: `0x${string}`;
      const ninahContract = contractAddress.NinahContractAddress as `0x${string}`;

      if (recipient.startsWith('0x') && recipient.length === 42) {
        // Direct address
        recipientAddress = recipient as `0x${string}`;
        console.log('[SEND] Using direct address:', recipientAddress);
      } else {
        // Username - resolve via event scanning
        const username = recipient.startsWith('@') ? recipient.slice(1) : recipient;
        console.log('[SEND] Resolving username:', username);

        // Hash the username
        const usernameHash = keccak256(toBytes(username));
        console.log('[SEND] Username hash:', usernameHash);

        // Get current block and scan last 100,000 blocks for UsernameRegistered events
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > BigInt(100000) ? currentBlock - BigInt(100000) : BigInt(0);

        const logs = await publicClient.getLogs({
          address: ninahContract,
          event: {
            type: 'event',
            name: 'UsernameRegistered',
            inputs: [
              { type: 'bytes32', name: 'usernameHash', indexed: true },
              { type: 'address', name: 'user', indexed: true },
              { type: 'bytes32', name: 'commitment', indexed: false },
            ],
          },
          args: {
            usernameHash: usernameHash,
          },
          fromBlock: fromBlock,
          toBlock: 'latest',
        });

        console.log('[SEND] Found logs:', logs);

        if (logs.length === 0) {
          throw new Error(`Username "@${username}" not found. Make sure the username is registered.`);
        }

        // Get the most recent registration (in case of multiple)
        const latestLog = logs[logs.length - 1];
        recipientAddress = latestLog.args.user as `0x${string}`;
        console.log('[SEND] Resolved address:', recipientAddress);
      }

      console.log('[SEND] Recipient address:', recipientAddress);

      // Step 1: Get recipient's meta keys
      console.log('[SEND] Fetching recipient meta keys...');
      const metaKeysResult = (await getMetaKeys(recipientAddress)) as {
        metaViewingPub: `0x${string}`;
        metaSpendingPub: `0x${string}`;
        registered: boolean;
      };

      if (!metaKeysResult.registered) {
        throw new Error('Recipient has not registered meta keys. They cannot receive stealth payments.');
      }

      console.log('[SEND] Meta keys found:', metaKeysResult);

      // Step 2: Generate stealth address for recipient
      setSendStatus('generating');
      console.log('[SEND] Generating stealth address...');

      const metaViewingPub = Bytes.hexToBytes(metaKeysResult.metaViewingPub);
      const metaSpendingPub = Bytes.hexToBytes(metaKeysResult.metaSpendingPub);

      const payment = Address.generateStealthPayment(metaViewingPub, metaSpendingPub);
      const stealthAddressHex = Bytes.bytesToHex(payment.stealthAddress as Uint8Array) as `0x${string}`;
      const ephemeralPubkeyHex = Bytes.bytesToHex(payment.ephemeralPublicKey) as `0x${string}`;

      console.log('[SEND] Stealth address:', stealthAddressHex);
      console.log('[SEND] Ephemeral pubkey:', ephemeralPubkeyHex);

      // Step 3: Approve IDRX spending (if needed)
      setSendStatus('approving');
      const amountInWei = parseUnits(amount, 6); // IDRX has 6 decimals
      const idrxContract = contractAddress.MockIDRXAddress as `0x${string}`;

      console.log('[SEND] Amount in wei:', amountInWei.toString());

      // Check current allowance
      const currentAllowance = (await publicClient.readContract({
        address: idrxContract,
        abi: MockIDRXABI,
        functionName: 'allowance',
        args: [walletAddress, ninahContract],
      })) as bigint;

      console.log('[SEND] Current allowance:', currentAllowance.toString());

      if (currentAllowance < amountInWei) {
        console.log('[SEND] Approving IDRX...');
        const approveTxData = encodeFunctionData({
          abi: MockIDRXABI,
          functionName: 'approve',
          args: [ninahContract, amountInWei],
        });

        const approveTxHash = await smartWalletClient.sendTransaction({
          to: idrxContract,
          data: approveTxData,
        });

        console.log('[SEND] Approval tx:', approveTxHash);
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        console.log('[SEND] Approval confirmed');
      }

      // Step 4: Send to stealth address
      setSendStatus('sending');
      console.log('[SEND] Sending to stealth address...');

      const sendTxData = encodeFunctionData({
        abi: NinahABI,
        functionName: 'sendToStealth',
        args: [stealthAddressHex, amountInWei, ephemeralPubkeyHex],
      });

      const sendTxHash = await smartWalletClient.sendTransaction({
        to: ninahContract,
        data: sendTxData,
      });

      console.log('[SEND] Send tx:', sendTxHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: sendTxHash });
      console.log('[SEND] Send confirmed:', receipt);

      setTxHash(sendTxHash);
      setSendStatus('success');

      // Refresh balance
      if (refetchBalance) refetchBalance();
    } catch (error) {
      console.error('[SEND] Error:', error);
      setSendError(error instanceof Error ? error.message : 'Failed to send payment');
      setSendStatus('error');
    }
  }, [smartWalletClient, recipient, amount, walletAddress, refetchBalance]);

  return (
    <div className='flex flex-1 flex-col'>
      <div className='p-4 md:p-10'>
        <h1 className='text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-2 font-grotesk'>Send IDRX</h1>
        <p className='text-neutral-600 dark:text-neutral-400 mb-8 font-poppins'>
          Send private payments with stealth addresses and zero-knowledge proofs
        </p>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Send Form */}
          <div className='lg:col-span-2'>
            <Card className='p-6'>
              <h2 className='text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-6 font-grotesk'>
                Payment Details
              </h2>

              {/* Recipient */}
              <div className='mb-6'>
                <label className='block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 font-poppins'>
                  Recipient
                </label>
                <div className='relative'>
                  <div className='absolute left-3 top-1/2 -translate-y-1/2'>
                    <IconUser className='h-5 w-5 text-neutral-400' />
                  </div>
                  <input
                    type='text'
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder='@username or 0x...'
                    className='w-full pl-10 pr-4 py-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary font-poppins'
                  />
                </div>
                <p className='text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-poppins'>
                  Enter a Ninah username (e.g. @john) or wallet address
                </p>
              </div>

              {/* Amount */}
              <div className='mb-6'>
                <label className='block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 font-poppins'>
                  Amount
                </label>
                <div className='relative'>
                  <div className='absolute left-3 top-1/2 -translate-y-1/2'>
                    <IconCoins className='h-5 w-5 text-neutral-400' />
                  </div>
                  <input
                    type='text'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder='0.00'
                    className='w-full pl-10 pr-20 py-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary font-poppins text-2xl font-bold'
                  />
                  <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                    <span className='text-sm font-medium text-neutral-500 dark:text-neutral-400 font-poppins'>
                      IDRX
                    </span>
                  </div>
                </div>
                <div className='flex items-center justify-between mt-2'>
                  <p className='text-xs text-neutral-500 dark:text-neutral-400 font-poppins'>
                    {balanceLoading ? 'Loading...' : `Available: ${formatIDRBalance(balance)}`}
                  </p>
                  <button
                    className='text-xs text-primary hover:underline font-poppins font-medium'
                    onClick={handleUseMax}
                    disabled={balanceLoading || !balance}>
                    Use Max
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {sendStatus === 'success' && (
                <div className='mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
                  <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
                    <IconCheck className='h-5 w-5' />
                    <span className='font-medium font-poppins'>Payment sent successfully!</span>
                  </div>
                  {txHash && (
                    <p className='mt-2 text-xs text-green-600 dark:text-green-500 font-mono break-all'>
                      Tx: {txHash}
                    </p>
                  )}
                </div>
              )}

              {sendStatus === 'error' && sendError && (
                <div className='mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
                  <div className='flex items-center gap-2 text-red-700 dark:text-red-400'>
                    <IconAlertCircle className='h-5 w-5' />
                    <span className='font-medium font-poppins'>{sendError}</span>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <Button
                size='lg'
                className='w-full font-poppins font-semibold text-lg'
                onClick={handleSend}
                disabled={!recipient || !amount || (sendStatus !== 'idle' && sendStatus !== 'success' && sendStatus !== 'error')}>
                {sendStatus === 'resolving' && (
                  <>
                    <IconLoader2 className='h-5 w-5 mr-2 animate-spin' />
                    Resolving recipient...
                  </>
                )}
                {sendStatus === 'generating' && (
                  <>
                    <IconLoader2 className='h-5 w-5 mr-2 animate-spin' />
                    Generating stealth address...
                  </>
                )}
                {sendStatus === 'approving' && (
                  <>
                    <IconLoader2 className='h-5 w-5 mr-2 animate-spin' />
                    Approving IDRX...
                  </>
                )}
                {sendStatus === 'sending' && (
                  <>
                    <IconLoader2 className='h-5 w-5 mr-2 animate-spin' />
                    Sending payment...
                  </>
                )}
                {(sendStatus === 'idle' || sendStatus === 'success' || sendStatus === 'error') && (
                  <>
                    <IconSend className='h-5 w-5 mr-2' />
                    Send Payment
                  </>
                )}
              </Button>
            </Card>
          </div>

          {/* Transaction Summary */}
          <div className='lg:col-span-1'>
            <Card className='p-6 sticky top-6'>
              <h3 className='text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-4 font-grotesk'>
                Transaction Summary
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700'>
                  <span className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins'>Amount</span>
                  <span className='font-medium text-neutral-800 dark:text-neutral-100 font-poppins'>
                    {amount || '0.00'} IDRX
                  </span>
                </div>
                <div className='flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700'>
                  <span className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins'>Network Fee</span>
                  <span className='font-medium text-neutral-800 dark:text-neutral-100 font-poppins'>~500 IDRX</span>
                </div>
                <div className='flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700'>
                  <span className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins'>Privacy</span>
                  <span className='text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-poppins font-medium'>
                    Maximum
                  </span>
                </div>
                <div className='flex items-center justify-between pt-3'>
                  <span className='font-medium text-neutral-800 dark:text-neutral-100 font-poppins'>Total</span>
                  <span className='text-lg font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>
                    {amount ? (parseFloat(amount) + 500).toLocaleString() : '0'} IDRX
                  </span>
                </div>
              </div>

              <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
                <p className='text-sm text-blue-800 dark:text-blue-300 font-poppins'>
                  <strong>Privacy Mode Active By Default:</strong> Your transaction will be completely private using
                  stealth addresses and zero-knowledge proofs.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
