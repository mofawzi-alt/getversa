/**
 * Brand detection and styling config.
 * Maps brand/option names to their official background colors.
 * When a poll option matches a known brand, the image is displayed
 * as a centered logo on the brand color instead of full-bleed.
 */

interface BrandStyle {
  bg: string; // CSS background color
}

// Lowercase brand name → style
const BRAND_MAP: Record<string, BrandStyle> = {
  careem:      { bg: '#1DBF73' },
  uber:        { bg: '#000000' },
  indrive:     { bg: '#1A1A2E' },
  vodafone:    { bg: '#E60000' },
  orange:      { bg: '#FF6600' },
  'e&':        { bg: '#00B3A4' },
  etisalat:    { bg: '#00B3A4' },
  'we':        { bg: '#1B2A4A' },
  'we telecom':{ bg: '#1B2A4A' },
  instapay:    { bg: '#F5F5F5' },
  instashop:   { bg: '#FFFFFF' },
  breadfast:   { bg: '#FFFFFF' },
  valu:        { bg: '#1A1A2E' },
  halan:       { bg: '#1A1A2E' },
  seven:       { bg: '#1A1A2E' },
  tru:         { bg: '#FFFFFF' },
  noon:        { bg: '#FFEE00' },
  amazon:      { bg: '#FFFFFF' },
  spotify:     { bg: '#000000' },
  netflix:     { bg: '#000000' },
  whatsapp:    { bg: '#075E54' },
  fawry:       { bg: '#F5A623' },
  swvl:        { bg: '#E74C3C' },
  shahry:      { bg: '#1A1A2E' },
  talabat:     { bg: '#FF5A00' },
  elmenus:     { bg: '#E74C3C' },
  anghami:     { bg: '#1A1A2E' },
  deezer:      { bg: '#000000' },
  'apple music': { bg: '#FA233B' },
  youtube:     { bg: '#FF0000' },
  'youtube music': { bg: '#FF0000' },
  tiktok:      { bg: '#000000' },
  instagram:   { bg: '#E1306C' },
  facebook:    { bg: '#1877F2' },
  twitter:     { bg: '#000000' },
  x:           { bg: '#000000' },
  snapchat:    { bg: '#FFFC00' },
  telegram:    { bg: '#0088CC' },
  signal:      { bg: '#3A76F0' },
  linkedin:    { bg: '#0077B5' },
  paymob:      { bg: '#1A1A2E' },
  valU:        { bg: '#1A1A2E' },
  opay:        { bg: '#1DBF73' },
  'cash plus': { bg: '#1A1A2E' },
};

/**
 * Checks if an option name matches a known brand.
 * Returns the brand style or null if it's not a brand (→ use full-bleed photo).
 */
export function getBrandStyle(optionName: string): BrandStyle | null {
  const lower = optionName.trim().toLowerCase();
  return BRAND_MAP[lower] ?? null;
}

/**
 * Returns true if a Supabase storage URL looks like a brand logo
 * (stored in the brands/ folder).
 */
export function isBrandLogoUrl(url: string | null): boolean {
  if (!url) return false;
  return url.includes('/brands/') || url.includes('/brand-logos/');
}

/**
 * Determines if an option should use the brand treatment.
 * Priority: explicit brand logo URL → brand name match.
 */
export function shouldUseBrandTreatment(optionName: string, imageUrl: string | null): boolean {
  if (isBrandLogoUrl(imageUrl)) return true;
  return getBrandStyle(optionName) !== null;
}

/**
 * Get the background color for a brand option.
 * Falls back to a neutral dark if brand is detected by URL but not in map.
 */
export function getBrandBgColor(optionName: string): string {
  const style = getBrandStyle(optionName);
  return style?.bg ?? '#1A1A2E';
}
