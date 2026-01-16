function withValidProperties(properties: Record<string, undefined | string | string[]>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value)),
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string;
  return Response.json({
    accountAssociation: {
      header: 'eyJmaWQiOi0xLCJ0eXBlIjoiYXV0aCIsImtleSI6IjB4QkFCOTlFNWM4MDRlODBDMEQyMTk0ZmJmMzk5M2RiNzhFZmJFMjgyZiJ9',
      payload: 'eyJkb21haW4iOiJuaW5haC10ZXN0aW5nLnZlcmNlbC5hcHAifQ',
      signature:
        'AAAAAAAAAAAAAAAAyhG94Fl3s2MRZwKIYr4qFzl2yhEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiSCrVbLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAul7REO_bo9AFv8iC11NYrLu4WEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASQ_-6NvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAPkWs5gCwPF7AmABnSFg_sgjIIwIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAPhSELIcxQMC9He6VmhtIBncm2etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBVnAqRtryUcwzCOiLDbZtb6OQ4jE91a9xSzYJPywGGkFUxtrn2LotXjzpgiNXOmWwkqIwLTFOnKJ-ywluEPpIpBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJI',
    },
    miniapp: {
      version: '1',
      name: 'Ninah',
      homeUrl: URL,
      iconUrl: `${URL}/ninah-only-logo.svg`,
      splashImageUrl: `${URL}/ninah-logo.svg`,
      splashBackgroundColor: '#000000',
      webhookUrl: `${URL}/api/webhook`,
      subtitle: 'Private stablecoin payments on Base',
      description:
        'Send stablecoins privately using stealth addresses. No KYC, no tracking, just you and the recipient.',
      screenshotUrls: [],
      primaryCategory: 'social',
      tags: ['payments', 'privacy', 'stablecoin', 'stealth'],
      heroImageUrl: `${URL}/ninah-logo.svg`,
      tagline: 'Send without being watched',
      ogTitle: 'Private Stablecoin Payments',
      ogDescription: 'Send stablecoins privately on Base. No KYC, no tracking, just you and the recipient.',
      ogImageUrl: `${URL}/ninah-logo.svg`,
      noindex: true,
    },
  });
}
