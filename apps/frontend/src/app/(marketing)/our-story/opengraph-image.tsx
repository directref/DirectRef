import { renderMarketingOgImage, OG_SIZE } from '@/components/marketing/ogImage';

export const alt = 'Our Story — DirectRef';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return renderMarketingOgImage('Our Story');
}
