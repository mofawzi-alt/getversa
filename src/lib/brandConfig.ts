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
  careem:        { bg: '#1DBF73' },
  uber:          { bg: '#000000' },
  indrive:       { bg: '#1A1A1A' },
  vodafone:      { bg: '#E60000' },
  orange:        { bg: '#FF6600' },
  'e&':          { bg: '#00625F' },
  etisalat:      { bg: '#00625F' },
  'we':          { bg: '#003087' },
  'we telecom':  { bg: '#003087' },
  instapay:      { bg: '#4B0082' },
  instashop:     { bg: '#FFFFFF' },
  breadfast:     { bg: '#FF4500' },
  valu:          { bg: '#1A1A2E' },
  halan:         { bg: '#00A86B' },
  seven:         { bg: '#1A1A2E' },
  tru:           { bg: '#FFFFFF' },
  noon:          { bg: '#FEEE00' },
  amazon:        { bg: '#FF9900' },
  spotify:       { bg: '#1DB954' },
  netflix:       { bg: '#E50914' },
  whatsapp:      { bg: '#25D366' },
  fawry:         { bg: '#F5A623' },
  swvl:          { bg: '#E74C3C' },
  shahry:        { bg: '#1A1A2E' },
  talabat:       { bg: '#FF5A00' },
  elmenus:       { bg: '#E74C3C' },
  anghami:       { bg: '#1A1A2E' },
  deezer:        { bg: '#000000' },
  'apple music': { bg: '#FA233B' },
  youtube:       { bg: '#FF0000' },
  'youtube music': { bg: '#FF0000' },
  tiktok:        { bg: '#000000' },
  instagram:     { bg: '#E1306C' },
  facebook:      { bg: '#1877F2' },
  twitter:       { bg: '#000000' },
  x:             { bg: '#000000' },
  snapchat:      { bg: '#FFFC00' },
  telegram:      { bg: '#0088CC' },
  signal:        { bg: '#3A76F0' },
  linkedin:      { bg: '#0077B5' },
  paymob:        { bg: '#1A1A2E' },
  opay:          { bg: '#1DBF73' },
  'cash plus':   { bg: '#1A1A2E' },
  nike:          { bg: '#000000' },
  adidas:        { bg: '#000000' },
  puma:          { bg: '#000000' },
  zara:          { bg: '#000000' },
  'h&m':         { bg: '#E50010' },
  uniqlo:        { bg: '#FF0000' },
  gucci:         { bg: '#000000' },
  'louis vuitton': { bg: '#1A1A2E' },
  apple:         { bg: '#000000' },
  samsung:       { bg: '#1428A0' },
  google:        { bg: '#FFFFFF' },
  microsoft:     { bg: '#737373' },
  bmw:           { bg: '#000000' },
  mercedes:      { bg: '#000000' },
  audi:          { bg: '#000000' },
  toyota:        { bg: '#EB0A1E' },
  pepsi:         { bg: '#004B93' },
  'coca cola':   { bg: '#F40009' },
  starbucks:     { bg: '#00704A' },
  costa:         { bg: '#6F263D' },
  'burger king':  { bg: '#FF8C00' },
  mcdonald:      { bg: '#FFC72C' },
  "mcdonald's":  { bg: '#FFC72C' },
  kfc:           { bg: '#F40027' },
  "hardee's":    { bg: '#ED1C24' },
  popeyes:       { bg: '#F26522' },
  'uber eats':   { bg: '#06C167' },
  shahid:        { bg: '#1A1A2E' },
  threads:       { bg: '#000000' },
  zoom:          { bg: '#2D8CFF' },
  'google meet': { bg: '#00897B' },
  notion:        { bg: '#000000' },
  chatgpt:       { bg: '#10A37F' },
  waze:          { bg: '#33CCFF' },
  jumia:         { bg: '#F68B1E' },
  osn:           { bg: '#000000' },
  'tim hortons':  { bg: '#C8102E' },
  sephora:       { bg: '#000000' },
  ikea:          { bg: '#0058A3' },
  wework:        { bg: '#000000' },
  rolex:         { bg: '#006039' },
  casio:         { bg: '#000000' },
  'ray ban':     { bg: '#000000' },
  balenciaga:    { bg: '#000000' },
  'off white':   { bg: '#000000' },
  versace:       { bg: '#000000' },
  converse:      { bg: '#000000' },
  vans:          { bg: '#000000' },
  'north face':  { bg: '#000000' },
  lululemon:     { bg: '#000000' },
  gopro:         { bg: '#000000' },
  canon:         { bg: '#000000' },
  sony:          { bg: '#000000' },
  bose:          { bg: '#000000' },
  dyson:         { bg: '#000000' },
  dell:          { bg: '#007DB8' },
  hp:            { bg: '#0096D6' },
  nespresso:     { bg: '#000000' },
  'domino\'s':   { bg: '#006491' },
  hilton:        { bg: '#003B5C' },
  marriott:      { bg: '#A50034' },
  airbnb:        { bg: '#FF5A5F' },
};

/** Known brand logo filename patterns (lowercase) */
const LOGO_FILENAME_PATTERNS = [
  'logo', 'brand', 'icon', 'emblem', 'badge',
];

/**
 * Checks if an option name matches a known brand.
 * Uses both exact match and substring/fuzzy matching.
 */
export function getBrandStyle(optionName: string): BrandStyle | null {
  const lower = optionName.trim().toLowerCase();
  
  // Exact match
  if (BRAND_MAP[lower]) return BRAND_MAP[lower];
  
  // Substring match: check if any brand name is contained in the option
  // Only for brand names ≥ 3 chars to avoid false positives
  for (const [brand, style] of Object.entries(BRAND_MAP)) {
    if (brand.length >= 3 && lower.includes(brand)) return style;
  }
  
  return null;
}

/**
 * Returns true if a URL looks like a brand logo based on:
 * 1. Stored in the brands/ folder
 * 2. Filename contains logo-related keywords
 * 3. Is a PNG/SVG from storage (logos are typically PNG with transparency)
 */
export function isBrandLogoUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Explicit brand folder
  if (lower.includes('/brands/') || lower.includes('/brand-logos/')) return true;
  
  // Check filename for logo patterns
  const filename = lower.split('/').pop()?.split('?')[0] || '';
  if (LOGO_FILENAME_PATTERNS.some(p => filename.includes(p))) return true;
  
  return false;
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

/**
 * Generate a fallback initial-letter display for a brand when the image fails.
 * Returns { letter, bg } for rendering a colored circle with initial.
 */
export function getBrandFallback(optionName: string): { letter: string; bg: string } {
  const name = optionName.trim();
  const letter = name.charAt(0).toUpperCase();
  const bg = getBrandBgColor(optionName);
  return { letter, bg };
}

/**
 * Determine if text should be dark on a light brand background.
 */
export function shouldUseDarkText(optionName: string): boolean {
  const bg = getBrandBgColor(optionName);
  // Light backgrounds that need dark text
  const lightBgs = ['#FFFFFF', '#FEEE00', '#FFEE00', '#FFFC00', '#FFC72C', '#FF9900', '#F5F5F5', '#F5A623'];
  return lightBgs.includes(bg.toUpperCase());
}
