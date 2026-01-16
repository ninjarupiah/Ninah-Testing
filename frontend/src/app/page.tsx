'use client';

import LandingPage from '@/components/landing/LandingPage';
import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return <LandingPage />;
}
