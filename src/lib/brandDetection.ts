/**
 * Brand detection and color mapping for poll images.
 * Determines whether a poll option is a brand/logo or a photo,
 * and provides the brand's official primary color for background fills.
 */

// Comprehensive brand → hex color map (100+ brands)
const BRAND_COLORS: Record<string, string> = {
  // Tech & Apps
  uber: '#000000',
  careem: '#1DBF73',
  instapay: '#4B0082',
  fawry: '#F7941D',
  vodafone: '#E60000',
  etisalat: '#5F259F',
  'e&': '#5F259F',
  orange: '#FF7900',
  stc: '#6C3A9A',
  zain: '#00A651',
  whatsapp: '#25D366',
  telegram: '#0088CC',
  tiktok: '#000000',
  instagram: '#E1306C',
  snapchat: '#FFFC00',
  spotify: '#1DB954',
  anghami: '#6C3B9B',
  netflix: '#E50914',
  shahid: '#00B2A9',
  youtube: '#FF0000',
  chatgpt: '#10A37F',
  google: '#4285F4',
  'google maps': '#4285F4',
  'google meet': '#00897B',
  'google docs': '#4285F4',
  zoom: '#2D8CFF',
  notion: '#000000',
  bereal: '#000000',
  clubhouse: '#F3E8D0',
  x: '#000000',
  'x spaces': '#000000',
  threads: '#000000',
  linkedin: '#0A66C2',
  swvl: '#F15A29',
  
  // Phones & Devices
  iphone: '#1C1C1E',
  apple: '#1C1C1E',
  'apple watch': '#1C1C1E',
  'apple pay': '#1C1C1E',
  airpods: '#F5F5F7',
  macbook: '#1C1C1E',
  ipad: '#1C1C1E',
  samsung: '#1428A0',
  'samsung tab': '#1428A0',
  'samsung tv': '#1428A0',
  'galaxy buds': '#1428A0',
  'face id': '#1C1C1E',
  dell: '#007DB8',
  hp: '#0096D6',
  playstation: '#003087',
  xbox: '#107C10',
  gopro: '#00A0D6',
  canon: '#CC0000',
  sony: '#000000',
  bose: '#000000',
  
  // Delivery & Shopping
  talabat: '#FF5A00',
  elmenus: '#FF385C',
  instashop: '#00C853',
  breadfast: '#FF6B00',
  noon: '#FEEE00',
  amazon: '#FF9900',
  jumia: '#F68B1E',
  'uber eats': '#06C167',
  
  // Food & Drink Chains
  starbucks: '#00704A',
  costa: '#6F1F35',
  'tim hortons': '#C8102E',
  "mcdonald's": '#FFC72C',
  mcdonalds: '#FFC72C',
  "hardee's": '#ED1C24',
  hardees: '#ED1C24',
  'burger king': '#FF8732',
  kfc: '#F40027',
  popeyes: '#FF6600',
  "domino's": '#006491',
  dominos: '#006491',
  pepsi: '#004B93',
  'coca-cola': '#F40009',
  'coca cola': '#F40009',
  lipton: '#FDE149',
  
  // Fashion & Luxury
  nike: '#000000',
  adidas: '#000000',
  puma: '#000000',
  converse: '#000000',
  vans: '#000000',
  zara: '#000000',
  'h&m': '#E50010',
  'h m': '#E50010',
  uniqlo: '#FF0000',
  'louis vuitton': '#2C1810',
  gucci: '#000000',
  balenciaga: '#000000',
  'off white': '#000000',
  versace: '#000000',
  'dolce gabbana': '#000000',
  'dolce & gabbana': '#000000',
  'north face': '#000000',
  'under armour': '#1D1D1D',
  reebok: '#CC0000',
  lululemon: '#D31334',
  sephora: '#000000',
  'ray ban': '#000000',
  'ray-ban': '#000000',
  oakley: '#000000',
  rolex: '#006039',
  casio: '#003087',
  jordan: '#000000',
  yeezy: '#ACA395',
  
  // Cars
  bmw: '#1C69D4',
  mercedes: '#000000',
  audi: '#000000',
  toyota: '#CC0000',
  
  // Hotels & Travel
  airbnb: '#FF5A5F',
  hilton: '#002244',
  marriott: '#8C1D40',
  wework: '#000000',
  
  // Egyptian / Regional
  ahly: '#C8102E',
  zamalek: '#FFFFFF',
  osn: '#1C1C1E',
  'valu': '#1E3A5F',
  halan: '#FFD100',
  
  // Grocery & Supermarket
  carrefour: '#004B87',
  spinneys: '#E30613',
  seoudi: '#1A1A2E',
  'seoudi market': '#1A1A2E',
  'metro market': '#E30613',
  'hyper one': '#1A1A2E',
  
  // Dessert & Cafe
  cinnabon: '#C8102E',
  'ladurée': '#8DB96E',
  laduree: '#8DB96E',
  'crumbl': '#F5F5F5',
  'crumbl cookies': '#F5F5F5',
  'häagen-dazs': '#C8102E',
  'haagen-dazs': '#C8102E',
  'baskin robbins': '#FF69B4',
  
  // Fintech
  paypal: '#003087',
  'crypto wallet': '#F7931A',
  
  // Furniture & Home
  ikea: '#0058A3',
  dyson: '#6236FF',
  lego: '#D01012',
  nespresso: '#000000',
  
  // Misc
  'lg': '#A50034',
};

// Normalize helper
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Checks if a poll option represents a brand/logo (vs a photo/place/lifestyle).
 * Returns the brand color if it's a brand, null otherwise.
 */
export function getBrandColor(option: string): string | null {
  const norm = normalize(option);
  
  // Direct match
  if (BRAND_COLORS[norm]) return BRAND_COLORS[norm];
  
  // Check if any brand key is contained in the option
  for (const [brand, color] of Object.entries(BRAND_COLORS)) {
    if (norm.includes(brand) || brand.includes(norm)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Determines if a poll image URL points to a brand logo (uploaded to storage).
 * Brand logos are stored in the 'brands/' subfolder of poll-images bucket.
 */
export function isStorageBrandLogo(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  return imageUrl.includes('/poll-images/brands/');
}

/**
 * Determines the display treatment for a poll option.
 * Returns 'logo' for brand polls, 'photo' for everything else.
 */
export function getImageTreatment(
  option: string,
  imageUrl: string | null | undefined
): 'logo' | 'photo' {
  // If the image is explicitly in the brands storage folder, it's a logo
  if (isStorageBrandLogo(imageUrl)) return 'logo';
  
  // If the option matches a known brand, treat as logo regardless of image source
  // This ensures manually uploaded brand images are never stretched
  const brandColor = getBrandColor(option);
  if (brandColor) return 'logo';
  
  return 'photo';
}
