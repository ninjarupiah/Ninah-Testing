'use client';

import React from 'react';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { Card } from '@/components/ui/card';
import { IconWallet, IconArrowsExchange, IconDownload, IconTrendingUp } from '@tabler/icons-react';
import { useWalletBalance, useStealthPayments } from '@/hooks';

export default function DashboardPage() {
  const { client: smartWalletClient } = useSmartWallets();

  // Use smart wallet address instead of embedded wallet
  const walletAddress = (smartWalletClient?.account?.address as `0x${string}`) || undefined;

  // Fetch wallet balance and stealth payments
  const { balance, loading: balanceLoading, error: balanceError } = useWalletBalance(walletAddress);
  const { transactions, loading: paymentsLoading, error: paymentsError, stats } = useStealthPayments(walletAddress);

  // Format balance for display
  const formatIDRBalance = (balance: string | null) => {
    if (!balance) return 'Rp 0';
    const num = parseFloat(balance);
    return `Rp ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate percentage changes (mock for now)
  const statsData = [
    {
      title: 'Total Balance',
      value: formatIDRBalance(balance),
      icon: IconWallet,
      change: '+12.5%',
      changeType: 'positive' as const,
      loading: balanceLoading,
    },
    {
      title: 'Total Received',
      value: formatIDRBalance(stats.totalReceived),
      icon: IconDownload,
      change: '+15.3%',
      changeType: 'positive' as const,
      loading: paymentsLoading,
    },
    {
      title: 'Unclaimed',
      value: formatIDRBalance(stats.totalUnclaimed),
      icon: IconArrowsExchange,
      change: stats.totalUnclaimed !== '0' ? 'Ready' : '-',
      changeType: 'positive' as const,
      loading: paymentsLoading,
    },
    {
      title: 'Total Payments',
      value: stats.totalTransactions.toString(),
      icon: IconTrendingUp,
      change: `+${stats.totalTransactions}`,
      changeType: 'positive' as const,
      loading: paymentsLoading,
    },
  ];

  // Get recent transactions (last 4)
  const recentTransactions = transactions.slice(0, 4);

  return (
    <div className='flex flex-1 flex-col'>
      <div className='p-4 md:p-10'>
        <h1 className='text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-2 font-grotesk'>Dashboard</h1>
        <p className='text-neutral-600 dark:text-neutral-400 mb-8 font-poppins'>
          Welcome back! Here&apos;s an overview of your private payments.
        </p>

        {/* Error States */}
        {balanceError && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-red-600 dark:text-red-400 font-poppins'>Error loading balance: {balanceError.message}</p>
          </div>
        )}
        {paymentsError && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-red-600 dark:text-red-400 font-poppins'>
              Error loading transactions: {paymentsError.message}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          {statsData.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className='p-6 hover:shadow-lg transition-shadow duration-300'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <p className='text-sm text-neutral-600 dark:text-neutral-400 mb-1 font-poppins'>{stat.title}</p>
                    {stat.loading ? (
                      <div className='h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-2' />
                    ) : (
                      <h3 className='text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2 font-grotesk'>
                        {stat.value}
                      </h3>
                    )}
                    <p
                      className={`text-sm font-medium font-poppins ${
                        stat.changeType === 'positive'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                      {stat.change}
                    </p>
                  </div>
                  <div className='p-3 bg-primary/10 rounded-lg'>
                    <IconComponent className='h-6 w-6 text-primary' />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <Card className='p-6'>
          <h2 className='text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-6 font-grotesk'>
            Recent Stealth Payments
          </h2>

          {paymentsLoading ? (
            <div className='space-y-4'>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className='h-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg animate-pulse' />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className='text-center py-12'>
              <IconArrowsExchange className='h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4' />
              <p className='text-neutral-600 dark:text-neutral-400 font-poppins'>
                No stealth payments found. Go to Receive page to scan for incoming payments.
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className='flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors'>
                  <div className='flex items-center gap-4'>
                    <div className='p-2 rounded-full bg-green-100 dark:bg-green-900/30'>
                      <IconDownload className='h-5 w-5 text-green-600 dark:text-green-400' />
                    </div>
                    <div>
                      <p className='font-medium text-neutral-800 dark:text-neutral-100 font-poppins'>
                        Received from {truncateAddress(transaction.sender)}
                      </p>
                      <p className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins'>
                        {formatRelativeTime(transaction.timestamp)} • Stealth:{' '}
                        {truncateAddress(transaction.stealthAddress)}
                      </p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='font-bold font-grotesk text-green-600 dark:text-green-400'>
                      + {formatIDRBalance(transaction.amount)}
                    </p>
                    <p className='text-sm text-neutral-600 dark:text-neutral-400 font-poppins capitalize'>
                      {transaction.status === 'claimed' ? 'Claimed' : 'Ready to Claim'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
