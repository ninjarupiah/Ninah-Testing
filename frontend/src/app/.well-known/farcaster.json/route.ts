function withValidProperties(properties: Record<string, undefined | string | string[]>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value)),
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string;
  return Response.json({
    accountAssociation: {
      header: '',
      payload: '',
      signature: '',
    },
    miniapp: {
      version: '1',
      name: 'Ninah',
      homeUrl: URL,
      iconUrl: `${URL}/favicon.ico`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#000000',
      webhookUrl: `${URL}/api/webhook`,
      subtitle: 'Private payments on Base',
      description:
        'Send stablecoins privately using stealth addresses. No KYC, no tracking, just you and the recipient.',
      screenshotUrls: [`${URL}/s1.png`, `${URL}/s2.png`, `${URL}/s3.png`],
      primaryCategory: 'social',
      tags: ['payments', 'privacy', 'stablecoin', 'stealth'],
      heroImageUrl: `${URL}/og.png`,
      tagline: 'Send without being watched',
      ogTitle: 'Ninah - Private Stablecoin Payments',
      ogDescription: 'Send stablecoins privately on Base. No KYC, no tracking, just you and the recipient.',
      ogImageUrl: `${URL}/og.png`,
      noindex: true,
    },
  });
}
