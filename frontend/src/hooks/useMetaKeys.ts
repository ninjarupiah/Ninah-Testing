import { useState, useEffect } from 'react';
import { getMetaKeys } from '@/lib/contracts/NinjaRupiah';
import { Address } from '@/lib/stealth';
import { Bytes } from '@/lib/helpers/bytes';

interface MetaKeysState {
  metaViewingPub: Uint8Array | null;
  metaSpendingPub: Uint8Array | null;
  stealthAddress: string | null;
  loading: boolean;
  error: Error | null;
  hasKeys: boolean;
}

/**
 * Custom hook to fetch user's meta keys and generate stealth address
 * @param address - User's wallet address
 * @returns Object containing meta keys, stealth address, loading state, and error state
 */
export function useMetaKeys(address: `0x${string}` | undefined) {
  const [state, setState] = useState<MetaKeysState>({
    metaViewingPub: null,
    metaSpendingPub: null,
    stealthAddress: null,
    loading: true,
    error: null,
    hasKeys: false,
  });

  useEffect(() => {
    if (!address) {
      console.log('[useMetaKeys] No address provided, skipping fetch');
      setState({
        metaViewingPub: null,
        metaSpendingPub: null,
        stealthAddress: null,
        loading: false,
        error: null,
        hasKeys: false,
      });
      return;
    }
    console.log('[useMetaKeys] Starting fetch for address:', address);

    let isMounted = true;

    const fetchMetaKeys = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        console.log('[useMetaKeys] Fetching meta keys for address:', address);
        const result = await getMetaKeys(address);
        console.log('[useMetaKeys] Raw result from blockchain:', result);

        if (!isMounted) return;

        // Contract returns an object with named properties
        const metaKeysResult = result as {
          metaViewingPub: `0x${string}`;
          metaSpendingPub: `0x${string}`;
          registered: boolean;
        };

        const viewingPubHex = metaKeysResult.metaViewingPub;
        const spendingPubHex = metaKeysResult.metaSpendingPub;

        console.log('[useMetaKeys] viewingPubHex:', viewingPubHex);
        console.log('[useMetaKeys] spendingPubHex:', spendingPubHex);
        console.log('[useMetaKeys] registered:', metaKeysResult.registered);

        // Use the registered flag from contract
        const hasKeys = metaKeysResult.registered === true;

        console.log('[useMetaKeys] hasKeys:', hasKeys);

        if (!hasKeys) {
          setState({
            metaViewingPub: null,
            metaSpendingPub: null,
            stealthAddress: null,
            loading: false,
            error: null,
            hasKeys: false,
          });
          return;
        }

        // Convert hex to Uint8Array
        console.log('[useMetaKeys] Converting hex to bytes...');
        const metaViewingPub = Bytes.hexToBytes(viewingPubHex);
        const metaSpendingPub = Bytes.hexToBytes(spendingPubHex);
        console.log('[useMetaKeys] Converted:', { metaViewingPub, metaSpendingPub });

        // Generate stealth address
        console.log('[useMetaKeys] Generating stealth payment...');
        const payment = Address.generateStealthPayment(metaViewingPub, metaSpendingPub);
        console.log('[useMetaKeys] Payment generated:', payment);

        // Convert stealth address Uint8Array to hex string
        const stealthAddressHex = Bytes.bytesToHex(payment.stealthAddress as Uint8Array);
        console.log('[useMetaKeys] Stealth address hex:', stealthAddressHex);

        setState({
          metaViewingPub,
          metaSpendingPub,
          stealthAddress: stealthAddressHex,
          loading: false,
          error: null,
          hasKeys: true,
        });
        console.log('[useMetaKeys] State updated successfully with hasKeys: true');
      } catch (error) {
        if (!isMounted) return;

        console.error('[useMetaKeys] ERROR:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to fetch meta keys'),
        }));
      }
    };

    fetchMetaKeys();

    return () => {
      isMounted = false;
    };
  }, [address]);

  return state;
}
