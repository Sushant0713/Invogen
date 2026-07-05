import { resolveMediaUrl, toAbsoluteMediaUrl } from '@/lib/media';

export interface CompanyBranding {
  logo?: string;
  signature?: string;
}

export { resolveMediaUrl, toAbsoluteMediaUrl };

export async function imageUrlToDataUri(url: string): Promise<string> {
  const absolute = toAbsoluteMediaUrl(url)!;
  const response = await fetch(absolute);
  if (!response.ok) throw new Error('Failed to load image');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function resolveBrandingForPdf(branding: CompanyBranding): Promise<CompanyBranding> {
  const [logo, signature] = await Promise.all([
    branding.logo ? imageUrlToDataUri(branding.logo) : Promise.resolve(undefined),
    branding.signature ? imageUrlToDataUri(branding.signature) : Promise.resolve(undefined),
  ]);
  return { logo, signature };
}
