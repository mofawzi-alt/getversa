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

export function getPollImageFallbackSrc(params: PollImageParams) {
  const preferredLocal = getPreferredLocalImage(params);
  if (preferredLocal) return preferredLocal;

  const sourceLocal = getLocalImageByName(extractFilename(params.imageUrl));
  if (sourceLocal) return sourceLocal;

  return params.genericFallback || '';
}

export function getPollDisplayImageSrc(params: PollImageParams) {
  const preferredLocal = getPreferredLocalImage(params);
  if (preferredLocal) return preferredLocal;

  if (params.imageUrl) {
    // Always try local match for storage URLs (they're broken)
    const sourceLocal = getLocalImageByName(extractFilename(params.imageUrl));
    if (sourceLocal && isStoragePollImageUrl(params.imageUrl)) {
      return sourceLocal;
    }
    // For non-storage URLs (e.g. Unsplash), still try local if we have a match
    if (sourceLocal) return sourceLocal;

    return params.imageUrl;
  }

  return getPollImageFallbackSrc(params);
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
