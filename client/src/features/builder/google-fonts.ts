export type GoogleFontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export interface GoogleFontEntry {
  family: string;
  category: GoogleFontCategory;
}

/** Popular Google Fonts fallback when metadata fetch is unavailable. */
export const FALLBACK_GOOGLE_FONTS: GoogleFontEntry[] = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway',
  'Nunito', 'Ubuntu', 'Rubik', 'Work Sans', 'DM Sans', 'Manrope', 'Outfit', 'Figtree',
  'Source Sans 3', 'Noto Sans', 'PT Sans', 'Mulish', 'Quicksand', 'Barlow', 'Karla',
  'Hind', 'Mukta', 'Cabin', 'Titillium Web', 'Josefin Sans', 'Archivo', 'Exo 2',
  'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Libre Baskerville', 'Crimson Text',
  'EB Garamond', 'Cormorant Garamond', 'Bitter', 'Spectral', 'Cardo', 'Vollkorn',
  'Roboto Slab', 'Source Serif 4', 'Noto Serif', 'IBM Plex Serif', 'Domine',
  'Bebas Neue', 'Anton', 'Lobster', 'Pacifico', 'Dancing Script', 'Caveat',
  'Great Vibes', 'Satisfy', 'Shadows Into Light', 'Permanent Marker', 'Indie Flower',
  'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'IBM Plex Mono',
  'Inconsolata', 'Space Mono', 'Courier Prime',
].map((family) => ({
  family,
  category: inferCategory(family),
}));

function inferCategory(family: string): GoogleFontCategory {
  const mono = ['Mono', 'Code', 'Courier'];
  const script = ['Script', 'Dancing', 'Pacifico', 'Caveat', 'Vibes', 'Satisfy', 'Marker', 'Flower'];
  const display = ['Bebas', 'Anton', 'Lobster', 'Oswald'];
  const serif = ['Serif', 'Garamond', 'Baskerville', 'Merriweather', 'Lora', 'Crimson', 'Spectral', 'Slab', 'Domine', 'Bitter', 'Cardo', 'Vollkorn', 'Playfair'];
  if (mono.some((k) => family.includes(k))) return 'monospace';
  if (script.some((k) => family.includes(k))) return 'handwriting';
  if (display.some((k) => family.includes(k))) return 'display';
  if (serif.some((k) => family.includes(k))) return 'serif';
  return 'sans-serif';
}

const categoryFallback: Record<GoogleFontCategory, string> = {
  'sans-serif': 'sans-serif',
  serif: 'serif',
  display: 'sans-serif',
  handwriting: 'cursive',
  monospace: 'monospace',
};

let cachedFonts: GoogleFontEntry[] | null = null;
let fetchPromise: Promise<GoogleFontEntry[]> | null = null;

export async function fetchGoogleFonts(): Promise<GoogleFontEntry[]> {
  if (cachedFonts) return cachedFonts;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await fetch('https://fonts.google.com/metadata/fonts');
      if (!response.ok) throw new Error('Failed to load fonts');
      const raw = await response.text();
      const json = JSON.parse(raw.replace(/^\)\]\}'\n?/, '')) as {
        familyMetadataList: Array<{ family: string; category: string }>;
      };
      cachedFonts = json.familyMetadataList.map((font) => ({
        family: font.family,
        category: normalizeCategory(font.category),
      }));
      return cachedFonts;
    } catch {
      cachedFonts = FALLBACK_GOOGLE_FONTS;
      return cachedFonts;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

function normalizeCategory(category: string): GoogleFontCategory {
  if (category === 'serif' || category === 'monospace' || category === 'handwriting' || category === 'display') {
    return category;
  }
  return 'sans-serif';
}

const loadedFonts = new Set<string>();

export function ensureGoogleFontLoaded(family: string) {
  const name = parseFontFamilyName(family);
  if (!name || name === 'Inter' || loadedFonts.has(name)) return;
  loadedFonts.add(name);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

export function parseFontFamilyName(value: string | undefined): string {
  if (!value) return 'Inter';
  const trimmed = value.trim();
  if (!trimmed) return 'Inter';
  if (trimmed.startsWith('"')) {
    const match = trimmed.match(/^"([^"]+)"/);
    return match?.[1] ?? trimmed;
  }
  if (trimmed.includes(',')) return trimmed.split(',')[0].trim().replace(/^"|"$/g, '');
  return trimmed;
}

export function formatFontFamilyCss(
  value: string | undefined,
  category: GoogleFontCategory = 'sans-serif'
): string {
  const name = parseFontFamilyName(value);
  return `"${name}", ${categoryFallback[category]}`;
}

export function getFontCategory(
  family: string,
  fonts: GoogleFontEntry[]
): GoogleFontCategory {
  const name = parseFontFamilyName(family);
  return fonts.find((f) => f.family === name)?.category ?? inferCategory(name);
}

export function getGoogleFontsSync(): GoogleFontEntry[] {
  return cachedFonts ?? FALLBACK_GOOGLE_FONTS;
}
