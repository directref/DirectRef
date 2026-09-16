import { renderMarketingOgImage, OG_SIZE } from '@/components/marketing/ogImage';

export const alt = 'DirectRef — Get referred from the inside.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return renderMarketingOgImage('Get referred from the inside.');
}
