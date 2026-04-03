type PollImageSide = 'A' | 'B';

const pollImageModules = import.meta.glob('../assets/polls/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const localPollImages = Object.fromEntries(
  Object.entries(pollImageModules).map(([path, url]) => [path.split('/').pop()!.toLowerCase(), url])
);

const QUESTION_SIDE_ALIASES: Record<string, Partial<Record<PollImageSide, string>>> = {
  'cairo or dubai': { A: 'cairo.jpg', B: 'dubai-visit.jpg' },
  'careem or uber': { A: 'careem.jpg', B: 'uber.png' },
  'iftar at home or restaurant': { A: 'iftar-home.jpg', B: 'fancy-restaurant.jpg' },
  'local brand or international brand': { A: 'local-brand.jpg', B: 'international-brand.jpg' },
  'egyptian film or hollywood': { A: 'egyptian-series.jpg', B: 'movies.jpg' },
  'henna night or modern bachelor party': { A: 'night.jpg', B: 'going-out.png' },
  'city stars or mall of arabia': { A: 'city-stars-mall.jpg', B: 'mall-of-arabia.jpg' },
};

const OPTION_ALIASES: Record<string, string> = {
  dubai: 'dubai-visit.jpg',
  uber: 'uber.png',
  'at home': 'iftar-home.jpg',
  restaurant: 'fancy-restaurant.jpg',
  international: 'international-brand.jpg',
  'egyptian film': 'egyptian-series.jpg',
  hollywood: 'movies.jpg',
  'henna night': 'night.jpg',
  'bachelor party': 'going-out.png',
  'city stars': 'city-stars-mall.jpg',
  'mall of arabia': 'mall-of-arabia.jpg',
  'eat out': 'fancy-restaurant.jpg',
  'cook at home': 'home-dinner.jpg',
  'work from home': 'wfh.jpg',
  office: 'suit.jpg',
  'move abroad': 'move-abroad.jpg',
  'stay home': 'home-dinner.jpg',
  dates: 'dates.jpg',
  chocolate: 'chocolate.jpg',
  'dark chocolate': 'dark-chocolate.jpg',
  'milk chocolate': 'milk-chocolate.jpg',
  metro: 'metro.jpg',
  falafel: 'falafel.jpg',
  hummus: 'hummus.jpg',
  'designer sunglasses': 'designer.jpg',  
  'financial freedom': 'financial-freedom.jpg',
  'first class': 'first-class.jpg',
  'natural energy': 'nature.jpg',
  'turkish coffee': 'turkish-coffee.jpg',
  manakeesh: 'manaeesh.jpg',
  croissant: 'croissant.jpg',
  kunafa: 'kunafa.jpg',
  'grilled chicken': 'grilled.jpg',
  'fried chicken': 'fried.jpg',
  mba: 'mba.jpg',
  'phone camera': 'phone-camera.jpg',
  hilton: 'hilton.jpg',
  marriott: 'hotel.jpg',
  suit: 'suit.jpg',
  read: 'books.jpg',
  watch: 'movies.jpg',
  arabic: 'cairo.jpg',
  english: 'language.jpg',
  'live there': 'city.jpg',
  'visit only': 'dubai-visit.jpg',
  cairo: 'cairo.jpg',
  iphone: 'phone-camera.jpg',
  samsung: 'phone-camera.jpg',
  android: 'phone-camera.jpg',
  tea: 'tea.jpg',
  coffee: 'coffee.jpg',
  pizza: 'pizza.jpg',
  sushi: 'sushi.jpg',
  cats: 'cats.jpg',
  dogs: 'dogs.jpg',
  cat: 'cats.jpg',
  dog: 'dogs.jpg',
  beach: 'beach.jpg',
  mountain: 'mountains.jpg',
  mountains: 'mountains.jpg',
  summer: 'summer.jpg',
  winter: 'winter.jpg',
  sneakers: 'sneakers.jpg',
  boots: 'boots.jpg',
  books: 'books.jpg',
  sunrise: 'sunrise.jpg',
  sunset: 'sunset.jpg',
  city: 'city.jpg',
  nature: 'nature.jpg',
  careem: 'careem.jpg',
  'brand store': 'brand-store.jpg',
  'online shop': 'shopping.jpg',
  home: 'home-dinner.jpg',
  'local market': 'local-brand.jpg',
  'buy in bulk': 'buy-bulk.jpg',
  'pick fresh': 'buy-bulk.jpg',
  gold: 'financial-freedom.jpg',
  cash: 'financial-freedom.jpg',
  rooftop: 'city.jpg',
  'nile cruise': 'nile-cruise.jpg',
  budget: 'financial-freedom.jpg',
  luxury: 'hilton.jpg',
  traditional: 'iftar-home.jpg',
  modern: 'city.jpg',
  'gift card': 'pick-gift.jpg',
  'picked gift': 'pick-gift.jpg',
  'pick gift': 'pick-gift.jpg',
  gym: 'suit.jpg',
  'home workout': 'wfh.jpg',
  freelance: 'wfh.jpg',
  '9 to 5': 'suit.jpg',
  netflix: 'netflix.jpg',
  youtube: 'movies.jpg',
  spotify: 'movies.jpg',
  'apple music': 'movies.jpg',
  morning: 'sunrise.jpg',
  night: 'night.jpg',
  'night owl': 'night-sky.jpg',
  'early bird': 'day-sky.jpg',
  shopping: 'shopping.jpg',
  travel: 'fly.jpg',
  tablet: 'phone-camera.jpg',
  laptop: 'wfh.jpg',
  nike: 'sneakers.jpg',
  adidas: 'sneakers.jpg',
  'abu dhabi': 'abu-dhabi.jpg',
  riyadh: 'abu-dhabi.jpg',
  jeddah: 'dubai-visit.jpg',
  kunafa: 'kunafa.jpg',
  basbousa: 'kunafa.jpg',
  'egyptian': 'egyptian-series.jpg',
  khaleeji: 'dubai-visit.jpg',
  branded: 'branded.jpg',
  unbranded: 'shopping.jpg',
  alone: 'alone-shopping.jpg',
  'with friends': 'going-out.png',
  'black friday': 'shopping.jpg',
  'normal prices': 'mall.jpg',
  matters: 'shopping.jpg',
  "doesn't matter": 'mall.jpg',
  private: 'books.jpg',
  public: 'books.jpg',
  drive: 'city.jpg',
  maadi: 'cairo.jpg',
  heliopolis: 'cairo.jpg',
  'friday brunch': 'fancy-restaurant.jpg',
  'sahel weekend': 'beach.jpg',
  dell: 'wfh.jpg',
  hp: 'wfh.jpg',
  'one big': 'branded.jpg',
  'many small': 'shopping.jpg',
  'cash on delivery': 'shopping.jpg',
  prepay: 'phone-camera.jpg',
  'try first': 'mall.jpg',
  'trust online': 'phone-camera.jpg',
};

interface PollImageParams {
  genericFallback?: string;
  imageUrl?: string | null;
  option?: string | null;
  question?: string | null;
  side: PollImageSide;
}

function normalize(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(value?: string | null) {
  return normalize(value).replace(/\s+/g, '-');
}

function getLocalImageByName(fileName?: string | null) {
  if (!fileName) return undefined;
  return localPollImages[fileName.toLowerCase()];
}

function getLocalImageBySlug(value?: string | null) {
  const slug = slugify(value);
  if (!slug) return undefined;

  for (const ext of ['jpg', 'png', 'jpeg', 'webp', 'avif']) {
    const match = getLocalImageByName(`${slug}.${ext}`);
    if (match) return match;
  }

  return undefined;
}

function getQuestionAliasImage(question?: string | null, side?: PollImageSide) {
  const aliasFile = QUESTION_SIDE_ALIASES[normalize(question)]?.[side ?? 'A'];
  return getLocalImageByName(aliasFile);
}

function getOptionAliasImage(option?: string | null) {
  return getLocalImageByName(OPTION_ALIASES[normalize(option)]);
}

function extractFilename(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split('/').pop();
    return fileName ? decodeURIComponent(fileName).toLowerCase() : null;
  } catch {
    const cleaned = url.split('?')[0].split('#')[0];
    const fileName = cleaned.split('/').pop();
    return fileName ? decodeURIComponent(fileName).toLowerCase() : null;
  }
}

function isStoragePollImageUrl(url?: string | null) {
  return !!url && url.includes('/storage/v1/object/public/poll-images/');
}

function getPreferredLocalImage({ question, option, side }: PollImageParams) {
  return (
    getQuestionAliasImage(question, side) ||
    getLocalImageBySlug(option) ||
    getOptionAliasImage(option)
  );
}

// Deterministic generic fallback from local assets pool
function getGenericFallback(seed?: string | null): string {
  const allLocal = Object.values(localPollImages);
  if (allLocal.length === 0) return '';
  const hash = (seed || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return allLocal[hash % allLocal.length];
}

export function getPollImageFallbackSrc(params: PollImageParams) {
  const preferredLocal = getPreferredLocalImage(params);
  if (preferredLocal) return preferredLocal;

  const sourceLocal = getLocalImageByName(extractFilename(params.imageUrl));
  if (sourceLocal) return sourceLocal;

  return params.genericFallback || getGenericFallback(params.option || params.question);
}

export function getPollDisplayImageSrc(params: PollImageParams) {
  const preferredLocal = getPreferredLocalImage(params);
  if (preferredLocal) return preferredLocal;

  if (params.imageUrl) {
    const sourceLocal = getLocalImageByName(extractFilename(params.imageUrl));
    if (sourceLocal) return sourceLocal;

    // Only return the raw URL if it's NOT a storage URL (e.g. Unsplash works fine)
    if (!isStoragePollImageUrl(params.imageUrl)) {
      return params.imageUrl;
    }
    // Storage URLs are known to be broken — fall through to generic fallback
  }

  return params.genericFallback || getGenericFallback(params.option || params.question);
}

/** onError handler for img tags — swaps to local fallback */
export function handlePollImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  params: Omit<PollImageParams, 'imageUrl'>
) {
  const target = e.currentTarget;
  if (target.dataset.fallbackApplied) return; // prevent infinite loop
  target.dataset.fallbackApplied = 'true';
  const fallback = getPollImageFallbackSrc({ ...params, imageUrl: target.src });
  if (fallback) {
    target.src = fallback;
  }
}
