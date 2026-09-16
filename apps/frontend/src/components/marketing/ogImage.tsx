import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

export function renderMarketingOgImage(subtitle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF9F5',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #C9A24B, #A9ADB9)',
            marginBottom: 40,
          }}
        />
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, letterSpacing: -2, color: '#1A1206' }}>
          DirectRef
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#78716C', marginTop: 20 }}>
          {subtitle}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
