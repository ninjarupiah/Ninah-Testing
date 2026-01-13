import { useState, useEffect, useCallback } from 'react';
import { getUsernameHash } from '@/lib/contracts/NinjaRupiah';
import { keccak256, toBytes } from 'viem';

interface UsernameState {
  username: string | null;
  loading: boolean;
  error: Error | null;
  hasUsername: boolean;
}

interface UsernameResult extends UsernameState {
  refetch: () => void;
}

/**
 * Custom hook to fetch user's registered username
 * The blockchain only stores the username hash for privacy.
 * We store the plaintext in localStorage and verify it matches the on-chain hash.
 *
 * @param address - User's wallet address
 * @returns Object containing username, loading state, error state, hasUsername flag, and refetch function
 */
export function useUsername(address: `0x${string}` | undefined): UsernameResult {
  const [state, setState] = useState<UsernameState>({
    username: null,
    loading: true,
    error: null,
    hasUsername: false,
  });
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!address) {
      setState({
        username: null,
        loading: false,
        error: null,
        hasUsername: false,
      });
      return;
    }

    let isMounted = true;

    const fetchUsername = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        // Get username hash from blockchain
        const usernameHash = await getUsernameHash(address);

        if (!isMounted) return;

        // Check if user has registered a username (hash is not zero)
        const hasUsername = usernameHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';

        if (!hasUsername) {
          setState({
            username: null,
            loading: false,
            error: null,
            hasUsername: false,
          });
          return;
        }

        // Try to get username from localStorage
        const storageKey = `ninah_username_${address}`;
        const storedUsername = localStorage.getItem(storageKey);

        if (storedUsername) {
          // Verify the stored username matches the hash on-chain
          const computedHash = keccak256(toBytes(storedUsername));

          if (computedHash === usernameHash) {
            setState({
              username: storedUsername,
              loading: false,
              error: null,
              hasUsername: true,
            });
            return;
          }
        }

        // Username is registered but not in localStorage (or hash mismatch)
        setState({
          username: null,
          loading: false,
          error: null,
          hasUsername: true,
        });
      } catch (error) {
        if (!isMounted) return;

        console.error('Error fetching username:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to fetch username'),
        }));
      }
    };

    fetchUsername();

    return () => {
      isMounted = false;
    };
  }, [address, refetchTrigger]);

  return { ...state, refetch };
}
