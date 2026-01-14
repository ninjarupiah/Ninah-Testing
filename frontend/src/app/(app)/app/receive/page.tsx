'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IconCopy,
  IconQrcode,
  IconAlertCircle,
  IconCheck,
  IconSearch,
  IconLock,
  IconArrowDownLeft,
  IconExternalLink,
} from '@tabler/icons-react';
import { useMetaKeys, useUsername, useStealthPayments } from '@/hooks';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { getUsernameHash } from '@/lib/contracts/NinjaRupiah';
import { keccak256, toBytes } from 'viem';

export default function ReceivePage() {
  const { client: smartWalletClient } = useSmartWallets();

  // Use smart wallet address for meta keys and username
  const walletAddress = (smartWalletClient?.account?.address as `0x${string}`) || undefined;

  // Track if wallet is still initializing
  const isWalletLoading = !smartWalletClient || !walletAddress;

  // Fetch meta keys and generate stealth address
  const { stealthAddress, loading: keysLoading, hasKeys } = useMetaKeys(walletAddress);

  // Combined loading state - true if wallet is loading OR keys are loading
  const isKeysLoading = isWalletLoading || keysLoading;

  // Fetch username from localStorage and verify with blockchain
  const { username, loading: usernameLoading, hasUsername, refetch: refetchUsername } = useUsername(walletAddress);

  // Combined loading state for username
  const isUsernameLoading = isWalletLoading || usernameLoading;

  // Fetch incoming stealth payments
  const {
    transactions: allTransactions,
    loading: paymentsLoading,
    scanning,
    keysLocked,
    stats,
    refetch: scanPayments,
    error: paymentsError,
  } = useStealthPayments(walletAddress);

  // Filter to only show received payments on this page
  const transactions = allTransactions.filter((tx) => tx.type === 'received');

  const [copiedType, setCopiedType] = useState<'stealth' | 'username' | 'wallet' | null>(null);

  // Username recovery state
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Recover username by verifying against on-chain hash
  const handleRecoverUsername = async () => {
    if (!walletAddress || !recoveryUsername.trim()) return;

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      // Get the on-chain hash
      const onChainHash = await getUsernameHash(walletAddress);

      // Hash the entered username
      const enteredHash = keccak256(toBytes(recoveryUsername.trim()));

      // Compare hashes
      if (enteredHash === onChainHash) {
        // Match! Save to localStorage
        const storageKey = `ninah_username_${walletAddress}`;
        localStorage.setItem(storageKey, recoveryUsername.trim());
        setRecoverySuccess(true);

        // Refetch to update the UI
        refetchUsername();
      } else {
        setRecoveryError('Username does not match your registered username');
      }
    } catch (error) {
      console.error('Recovery error:', error);
      setRecoveryError('Failed to verify username');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'stealth' | 'username' | 'wallet') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Format balance for display
  const formatIDRBalance = (balance: string | null) => {
    if (!balance) return 'Rp 0';
    const num = parseFloat(balance);
    return `Rp ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className='flex flex-1 flex-col'>
      <div className='p-4 md:p-10'>
        <h1 className='text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-2 font-grotesk'>Receive IDRX</h1>
        <p className='text-neutral-600 dark:text-neutral-400 mb-8 font-poppins'>
          Share your receiving address or username with others
        </p>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Username Card */}
          <Card className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>Your Username</h2>
              <div className='px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full'>
                <span className='text-xs font-medium text-blue-700 dark:text-blue-400 font-poppins'>Easy to share</span>
              </div>
            </div>

            <p className='text-sm text-neutral-600 dark:text-neutral-400 mb-6 font-poppins'>
              Share your username for a simple way to receive payments. We&apos;ll automatically use stealth addresses.
            </p>

            {/* QR Code Placeholder */}
            <div className='bg-white p-8 rounded-lg mb-6 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700'>
              <div className='h-48 w-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center'>
                <IconQrcode className='h-24 w-24 text-neutral-400' />
              </div>
            </div>

            {/* Username Display */}
            {isUsernameLoading ? (
              <div className='bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg mb-4 border border-primary/20 animate-pulse'>
                <div className='h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2' />
                <div className='h-9 bg-neutral-200 dark:bg-neutral-700 rounded w-32' />
              </div>
            ) : !hasUsername ? (
              <div className='bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg mb-4 border border-yellow-200 dark:border-yellow-800'>
                <div className='flex items-start gap-3'>
                  <IconAlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                  <div>
                    <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1 font-poppins'>
                      No Username Registered
                    </p>
                    <p className='text-xs text-yellow-700 dark:text-yellow-300 font-poppins'>
                      Register a username to make it easier for others to send you payments.
                    </p>
                  </div>
                </div>
              </div>
            ) : username ? (
              <div className='bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg mb-4 border border-primary/20'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 mb-2 font-poppins'>Your Ninah username</p>
                <p className='text-3xl font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>{username}</p>
              </div>
            ) : (
              <div className='bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg mb-4 border border-amber-200 dark:border-amber-800'>
                <div className='flex items-start gap-3'>
                  <IconAlertCircle className='h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-amber-800 dark:text-amber-200 mb-1 font-poppins'>
                      Recover Your Username
                    </p>
                    <p className='text-xs text-amber-700 dark:text-amber-300 font-poppins mb-3'>
                      You have a username registered on-chain. Enter it below to restore access.
                    </p>

                    {recoverySuccess ? (
                      <div className='flex items-center gap-2 text-green-600 dark:text-green-400'>
                        <IconCheck className='h-4 w-4' />
                        <span className='text-sm font-poppins'>Username recovered successfully!</span>
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        <div className='flex gap-2'>
                          <input
                            type='text'
                            value={recoveryUsername}
                            onChange={(e) => setRecoveryUsername(e.target.value.toLowerCase())}
                            placeholder='Enter your username'
                            className='flex-1 px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-poppins'
                            disabled={recoveryLoading}
                          />
                          <Button
                            size='sm'
                            onClick={handleRecoverUsername}
                            disabled={recoveryLoading || !recoveryUsername.trim()}
                            className='font-poppins'>
                            {recoveryLoading ? 'Verifying...' : 'Recover'}
                          </Button>
                        </div>
                        {recoveryError && (
                          <p className='text-xs text-red-600 dark:text-red-400 font-poppins'>{recoveryError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className='flex gap-3'>
              <Button
                variant='outline'
                className='flex-1 font-poppins'
                onClick={() => username && copyToClipboard(username, 'username')}
                disabled={!username || isUsernameLoading}>
                <IconCopy className='h-4 w-4 mr-2' />
                {copiedType === 'username' ? 'Copied!' : 'Copy Username'}
              </Button>
              <Button variant='outline' className='flex-1 font-poppins' disabled={!username || isUsernameLoading}>
                <IconQrcode className='h-4 w-4 mr-2' />
                Share QR
              </Button>
            </div>
          </Card>

          {/* Wallet Address Card */}
          <Card className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>Wallet Address</h2>
              <div className='px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full'>
                <span className='text-xs font-medium text-neutral-600 dark:text-neutral-400 font-poppins'>
                  Standard
                </span>
              </div>
            </div>

            <p className='text-sm text-neutral-600 dark:text-neutral-400 mb-6 font-poppins'>
              Your standard Ethereum address. For maximum privacy, use your username instead.
            </p>

            {/* QR Code Placeholder */}
            <div className='bg-white p-8 rounded-lg mb-6 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-700'>
              <div className='h-48 w-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center'>
                <IconQrcode className='h-24 w-24 text-neutral-400' />
              </div>
            </div>

            {/* Wallet Address Display */}
            {isWalletLoading ? (
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg mb-4 animate-pulse'>
                <div className='h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2' />
                <div className='h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full' />
              </div>
            ) : (
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg mb-4'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 mb-2 font-poppins'>Your wallet address</p>
                <p className='text-sm font-mono text-neutral-800 dark:text-neutral-100 break-all'>{walletAddress}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className='flex gap-3'>
              <Button
                variant='outline'
                className='flex-1 font-poppins'
                onClick={() => walletAddress && copyToClipboard(walletAddress, 'wallet')}
                disabled={isWalletLoading}>
                <IconCopy className='h-4 w-4 mr-2' />
                {copiedType === 'wallet' ? 'Copied!' : 'Copy Address'}
              </Button>
              <Button variant='outline' className='flex-1 font-poppins' disabled={isWalletLoading}>
                <IconQrcode className='h-4 w-4 mr-2' />
                Share QR
              </Button>
            </div>
          </Card>
        </div>

        {/* Incoming Payments Section */}
        <Card className='p-6 mt-6'>
          <div className='flex items-center justify-between mb-6'>
            <div>
              <h2 className='text-xl font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>
                Incoming Stealth Payments
              </h2>
              <p className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins mt-1'>
                Scan the blockchain to find payments sent to you
              </p>
            </div>
            <Button onClick={scanPayments} disabled={keysLocked || scanning} className='font-poppins'>
              {scanning ? (
                <>
                  <IconSearch className='h-4 w-4 mr-2' />
                  Scanning...
                </>
              ) : (
                <>
                  <IconSearch className='h-4 w-4 mr-2' />
                  Scan for Payments
                </>
              )}
            </Button>
          </div>

          {/* Keys Locked Warning */}
          {keysLocked && (
            <div className='bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg mb-6 border border-amber-200 dark:border-amber-800'>
              <div className='flex items-start gap-3'>
                <IconLock className='h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-medium text-amber-800 dark:text-amber-200 mb-1 font-poppins'>
                    Keys Locked
                  </p>
                  <p className='text-xs text-amber-700 dark:text-amber-300 font-poppins'>
                    Your keys are locked. Please unlock them in your wallet settings to scan for incoming payments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {paymentsError && (
            <div className='bg-red-50 dark:bg-red-900/20 p-6 rounded-lg mb-6 border border-red-200 dark:border-red-800'>
              <div className='flex items-start gap-3'>
                <IconAlertCircle className='h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-medium text-red-800 dark:text-red-200 mb-1 font-poppins'>Scan Error</p>
                  <p className='text-xs text-red-700 dark:text-red-300 font-poppins'>{paymentsError.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {!keysLocked && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 font-poppins mb-1'>Total Received</p>
                <p className='text-lg font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>
                  {formatIDRBalance(stats.totalReceived)}
                </p>
              </div>
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 font-poppins mb-1'>Unclaimed</p>
                <p className='text-lg font-bold text-green-600 dark:text-green-400 font-grotesk'>
                  {formatIDRBalance(stats.totalUnclaimed)}
                </p>
              </div>
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 font-poppins mb-1'>Claimed</p>
                <p className='text-lg font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>
                  {formatIDRBalance(stats.totalClaimed)}
                </p>
              </div>
              <div className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg'>
                <p className='text-xs text-neutral-600 dark:text-neutral-400 font-poppins mb-1'>Payments</p>
                <p className='text-lg font-bold text-neutral-800 dark:text-neutral-100 font-grotesk'>
                  {stats.totalTransactions}
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {paymentsLoading && !scanning && (
            <div className='space-y-3'>
              {[1, 2, 3].map((i) => (
                <div key={i} className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg animate-pulse'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-full' />
                      <div>
                        <div className='h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-2' />
                        <div className='h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-24' />
                      </div>
                    </div>
                    <div className='h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-20' />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payments List */}
          {!paymentsLoading && !keysLocked && transactions.length > 0 && (
            <div className='space-y-3'>
              {transactions.map((payment) => (
                <div
                  key={payment.id}
                  className='bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center'>
                        <IconArrowDownLeft className='h-5 w-5 text-green-600 dark:text-green-400' />
                      </div>
                      <div>
                        <p className='text-sm font-medium text-neutral-800 dark:text-neutral-100 font-poppins'>
                          Received from Someone
                        </p>
                        <p className='text-xs text-neutral-600 dark:text-neutral-400 font-poppins'>
                          {formatDate(payment.timestamp)} • Stealth: {truncateAddress(payment.stealthAddress)}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-lg font-bold text-green-600 dark:text-green-400 font-grotesk'>
                        +{formatIDRBalance(payment.amount)}
                      </p>
                      <div className='flex items-center gap-2'>
                        {payment.status === 'claimed' ? (
                          <span className='text-xs px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full font-poppins'>
                            Claimed
                          </span>
                        ) : (
                          <span className='text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-poppins'>
                            Ready to Claim
                          </span>
                        )}
                        <a
                          href={`https://sepolia.basescan.org/tx/${payment.txHash}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'>
                          <IconExternalLink className='h-4 w-4' />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!paymentsLoading && !keysLocked && transactions.length === 0 && (
            <div className='text-center py-12'>
              <IconArrowDownLeft className='h-12 w-12 text-neutral-400 mx-auto mb-4' />
              <p className='text-neutral-600 dark:text-neutral-400 font-poppins'>No incoming payments found</p>
              <p className='text-sm text-neutral-500 dark:text-neutral-500 font-poppins mt-1'>
                Click &quot;Scan for Payments&quot; to check for new payments
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
