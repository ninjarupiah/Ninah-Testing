import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { MockIDRXABI } from '@/lib/contracts/abi';
import { contractAddress } from '@/lib/contracts/addresses';

// Faucet amount: 10,000 IDRX per request
const FAUCET_AMOUNT = parseUnits('10000', 6); // 6 decimals

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    // Get owner private key from environment
    const ownerPrivateKey = process.env.MOCK_IDRX_OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      return NextResponse.json(
        { error: 'Faucet not configured. Set MOCK_IDRX_OWNER_PRIVATE_KEY in .env.local' },
        { status: 500 }
      );
    }

    // Create wallet client with owner account
    const account = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    // Transfer tokens from owner wallet to the requested address
    const hash = await walletClient.writeContract({
      address: contractAddress.MockIDRXAddress as `0x${string}`,
      abi: MockIDRXABI,
      functionName: 'transfer',
      args: [address as `0x${string}`, FAUCET_AMOUNT],
    });

    console.log('[FAUCET] Transferred 10,000 IDRX to', address, 'tx:', hash);

    return NextResponse.json({
      success: true,
      txHash: hash,
      amount: '10000',
      message: 'Successfully transferred 10,000 IDRX!',
    });
  } catch (error) {
    console.error('[FAUCET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mint tokens' },
      { status: 500 }
    );
  }
}
