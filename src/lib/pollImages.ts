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
  'egyptian film or hollywood': { A: 'egyptian-series.jpg', B: 'cinema.jpg' },
  'henna night or modern bachelor party': { A: 'night.jpg', B: 'going-out.png' },
  'city stars or mall of arabia': { A: 'city-stars-mall.jpg', B: 'mall-of-arabia.jpg' },
  'thobe or suit for events': { A: 'thobe.jpg', B: 'suit.jpg' },
  'thobe or suit': { A: 'thobe.jpg', B: 'suit.jpg' },
  'iphone or samsung': { A: 'iphone.jpg', B: 'samsung.jpg' },
  'clubhouse or x spaces': { A: 'clubhouse.jpg', B: 'x-spaces.jpg' },
  'spotify or anghami': { A: 'spotify.jpg', B: 'anghami.jpg' },
  'netflix or shahid': { A: 'netflix.jpg', B: 'shahid.jpg' },
  'x or threads': { A: 'x-twitter.jpg', B: 'threads.jpg' },
  'vodafone or etisalat': { A: 'vodafone.jpg', B: 'etisalat.jpg' },
  'zoom or google meet': { A: 'zoom.jpg', B: 'google-meet.jpg' },
  'notion or google docs': { A: 'notion.jpg', B: 'google-docs.jpg' },
  'talabat or elmenus': { A: 'talabat.jpg', B: 'elmenus.jpg' },
  'mercedes or audi': { A: 'mercedes.jpg', B: 'audi.jpg' },
  'kfc or popeyes': { A: 'kfc.jpg', B: 'popeyes.jpg' },
  'converse or vans': { A: 'converse.jpg', B: 'vans.jpg' },
  'zara or h m': { A: 'zara.jpg', B: 'hm.jpg' },
  'playstation or xbox': { A: 'playstation.jpg', B: 'xbox.jpg' },
  'nike or adidas': { A: 'nike.jpg', B: 'adidas.jpg' },
  'pepsi or coca cola': { A: 'pepsi.jpg', B: 'coca-cola.jpg' },
  'bmw or mercedes': { A: 'bmw.jpg', B: 'mercedes.jpg' },
  'toyota or bmw': { A: 'toyota.jpg', B: 'bmw.jpg' },
  'rolex or casio': { A: 'rolex.jpg', B: 'casio.jpg' },
  'louis vuitton or gucci': { A: 'louis-vuitton.jpg', B: 'gucci.jpg' },
  'mcdonald s or burger king': { A: 'mcdonalds.jpg', B: 'burger-king.jpg' },
  'noon or amazon': { A: 'noon-brand.jpg', B: 'amazon.jpg' },
  'starbucks or local coffee': { A: 'starbucks.jpg', B: 'turkish-coffee.jpg' },
  'costa or starbucks': { A: 'coffee.jpg', B: 'starbucks.jpg' },
  'tiktok or instagram': { A: 'tiktok.jpg', B: 'instagram.jpg' },
  'youtube or tiktok': { A: 'youtube.jpg', B: 'tiktok.jpg' },
  'whatsapp or telegram': { A: 'whatsapp.jpg', B: 'telegram.jpg' },
  'snapchat or ig stories': { A: 'snapchat.jpg', B: 'instagram.jpg' },
  'bereal or instagram': { A: 'bereal.jpg', B: 'instagram.jpg' },
  'adidas or puma': { A: 'adidas.jpg', B: 'puma.jpg' },
  'sony or bose': { A: 'playstation.jpg', B: 'bose.jpg' },
  'hilton or marriott': { A: 'hilton.jpg', B: 'hotel.jpg' },
  'airbnb or hotel': { A: 'airbnb.jpg', B: 'hotel.jpg' },
  'heels or flats': { A: 'heels.jpg', B: 'flats.jpg' },
  'aviator or wayfarer': { A: 'aviator.jpg', B: 'wayfarer.jpg' },
  'backpack or tote': { A: 'backpack.jpg', B: 'tote.jpg' },
  'gouna or ain sokhna': { A: 'gouna.jpg', B: 'ain-sokhna.jpg' },
  'gouna or sahel': { A: 'gouna.jpg', B: 'sahel.jpg' },
  'sahel or ain sokhna': { A: 'sahel.jpg', B: 'ain-sokhna.jpg' },
  'dahab or sharm': { A: 'beach.jpg', B: 'ain-sokhna.jpg' },
  'capsule or collection': { A: 'capsule-wardrobe.jpg', B: 'thrift.jpg' },
  'oversized or fitted': { A: 'oversized.jpg', B: 'smart-casual.jpg' },
  'monochrome or colors': { A: 'monochrome.jpg', B: 'thrift.jpg' },
  'denim or leather': { A: 'denim.jpg', B: 'designer-bag.jpg' },
  'sneakers or dress shoes': { A: 'sneakers.jpg', B: 'dress-shoes.jpg' },
  'loungewear or dress up': { A: 'loungewear.jpg', B: 'designer.jpg' },
  'gold or silver': { A: 'rolex.jpg', B: 'silver-jewelry.jpg' },
  'linkedin or tiktok': { A: 'linkedin.jpg', B: 'tiktok.jpg' },
  'save or spend now': { A: 'financial-freedom.jpg', B: 'shopping.jpg' },
  'insurance or invest': { A: 'insurance.jpg', B: 'stocks.jpg' },
  'thrift or brand new': { A: 'thrift.jpg', B: 'brand-store.jpg' },
  'eco friendly or luxury brand': { A: 'eco-friendly.jpg', B: 'branded.jpg' },
  'marina or sahel': { A: 'marina.jpg', B: 'sahel.jpg' },
};

const OPTION_ALIASES: Record<string, string> = {
  // Apps & Tech
  dubai: 'dubai-visit.jpg',
  uber: 'uber.png',
  careem: 'careem.jpg',
  iphone: 'iphone.jpg',
  samsung: 'samsung.jpg',
  android: 'samsung.jpg',
  'samsung tab': 'samsung.jpg',
  ipad: 'iphone.jpg',
  macbook: 'iphone.jpg',
  windows: 'wfh.jpg',
  whatsapp: 'whatsapp.jpg',
  telegram: 'telegram.jpg',
  tiktok: 'tiktok.jpg',
  instagram: 'instagram.jpg',
  'ig stories': 'instagram.jpg',
  snapchat: 'snapchat.jpg',
  spotify: 'spotify.jpg',
  anghami: 'anghami.jpg',
  netflix: 'netflix.jpg',
  shahid: 'shahid.jpg',
  osn: 'shahid.jpg',
  youtube: 'youtube.jpg',
  talabat: 'talabat.jpg',
  elmenus: 'elmenus.jpg',
  instashop: 'instashop.png',
  breadfast: 'breadfast.png',
  noon: 'noon-brand.jpg',
  amazon: 'amazon.jpg',
  jumia: 'noon-brand.jpg',
  'google maps': 'google-maps.jpg',
  waze: 'waze.jpg',
  zoom: 'zoom.jpg',
  'google meet': 'google-meet.jpg',
  vodafone: 'vodafone.jpg',
  etisalat: 'etisalat.jpg',
  stc: 'vodafone.jpg',
  zain: 'etisalat.jpg',
  chatgpt: 'chatgpt.jpg',
  google: 'google-maps.jpg',
  'apple watch': 'rolex.jpg',
  'classic watch': 'casio.jpg',
  airpods: 'airpods.jpg',
  'galaxy buds': 'samsung.jpg',
  playstation: 'playstation.jpg',
  xbox: 'xbox.jpg',
  'face id': 'iphone.jpg',
  fingerprint: 'samsung.jpg',
  x: 'x-twitter.jpg',
  threads: 'threads.jpg',
  bereal: 'bereal.jpg',
  clubhouse: 'clubhouse.jpg',
  'x spaces': 'x-spaces.jpg',
  fawry: 'chatgpt.jpg',
  instapay: 'chatgpt.jpg',
  paypal: 'chatgpt.jpg',
  'apple pay': 'iphone.jpg',
  swvl: 'metro.jpg',
  microbus: 'metro.jpg',
  '5g': 'vodafone.jpg',
  'wi-fi': 'wfh.jpg',
  cloud: 'chatgpt.jpg',
  'hard drive': 'wfh.jpg',
  'smart tv': 'netflix.jpg',
  projector: 'netflix.jpg',
  podcast: 'spotify.jpg',
  radio: 'spotify.jpg',
  notion: 'notion.jpg',
  'google docs': 'google-docs.jpg',
  'e-book': 'books.jpg',
  'physical book': 'books.jpg',
  'online courses': 'wfh.jpg',
  university: 'books.jpg',
  linkedin: 'suit.jpg',
  cinema: 'netflix.jpg',
  drone: 'chatgpt.jpg',
  'action camera': 'camping.jpg',
  electric: 'bmw.jpg',
  petrol: 'bmw.jpg',
  console: 'playstation.jpg',
  pc: 'wfh.jpg',
  'qr code': 'chatgpt.jpg',
  tablet: 'iphone.jpg',
  laptop: 'wfh.jpg',
  speaker: 'bose.jpg',
  headphones: 'bose.jpg',
  online: 'chatgpt.jpg',
  mobile: 'iphone.jpg',
  'dark mode': 'chatgpt.jpg',
  'light mode': 'iphone.jpg',
  'two phones': 'samsung.jpg',
  'one phone': 'iphone.jpg',
  crypto: 'crypto.jpg',
  bank: 'financial-freedom.jpg',

  // Eat & Drink
  'eat out': 'fancy-restaurant.jpg',
  'cook at home': 'home-dinner.jpg',
  starbucks: 'starbucks.jpg',
  'local coffee': 'turkish-coffee.jpg',
  costa: 'starbucks.jpg',
  'tim hortons': 'starbucks.jpg',
  "mcdonald's": 'mcdonalds.jpg',
  'burger king': 'burger-king.jpg',
  "hardee's": 'burger-king.jpg',
  tea: 'tea.jpg',
  coffee: 'coffee.jpg',
  pizza: 'pizza.jpg',
  sushi: 'sushi.jpg',
  falafel: 'falafel.jpg',
  hummus: 'hummus.jpg',
  koshary: 'koshary.jpg',
  shawarma: 'shawarma.jpg',
  kunafa: 'kunafa.jpg',
  basbousa: 'kunafa.jpg',
  dates: 'dates.jpg',
  chocolate: 'chocolate.jpg',
  'dark chocolate': 'dark-chocolate.jpg',
  'milk chocolate': 'milk-chocolate.jpg',
  'turkish coffee': 'turkish-coffee.jpg',
  espresso: 'coffee.jpg',
  manakeesh: 'manaeesh.jpg',
  "mana'eesh": 'manaeesh.jpg',
  croissant: 'croissant.jpg',
  grilled: 'grilled.jpg',
  fried: 'fried.jpg',
  'grilled chicken': 'grilled.jpg',
  'fried chicken': 'fried.jpg',
  'street food': 'falafel.jpg',
  'fine dining': 'fancy-restaurant.jpg',
  delivery: 'noon.jpg',
  'dine in': 'fancy-restaurant.jpg',
  lebanese: 'hummus.jpg',
  vegan: 'falafel.jpg',
  'meat lover': 'grilled.jpg',
  'ice cream': 'ice-cream.jpg',
  brunch: 'croissant.jpg',
  'skip to lunch': 'grilled.jpg',
  'food market': 'falafel.jpg',
  supermarket: 'shopping.jpg',
  nuts: 'dates.jpg',
  chips: 'chips.jpg',
  spicy: 'grilled.jpg',
  mild: 'hummus.jpg',
  'protein shake': 'gym.jpg',
  'fresh juice': 'dates.jpg',
  'meal prep': 'home-dinner.jpg',
  'cook fresh': 'grilled.jpg',
  water: 'nature.jpg',
  'soft drink': 'pepsi.jpg',
  'eat alone': 'coffee.jpg',
  'with people': 'fancy-restaurant.jpg',
  'smoothie bowl': 'dates.jpg',
  cereal: 'croissant.jpg',
  'always dessert': 'kunafa.jpg',
  rarely: 'grilled.jpg',
  'skip breakfast': 'coffee.jpg',
  'never skip': 'croissant.jpg',
  leftovers: 'home-dinner.jpg',
  'always fresh': 'grilled.jpg',
  view: 'fancy-restaurant.jpg',
  'hidden gem': 'falafel.jpg',
  homemade: 'dates.jpg',
  bottled: 'pepsi.jpg',
  sahlab: 'turkish-coffee.jpg',
  'hot chocolate': 'chocolate.jpg',
  matcha: 'matcha.jpg',
  foul: 'foul.jpg',
  eggs: 'eggs.jpg',
  buffet: 'fancy-restaurant.jpg',
  'à la carte': 'grilled.jpg',
  'follow recipe': 'books.jpg',
  improvise: 'home-dinner.jpg',
  'all you can eat': 'grilled.jpg',
  quality: 'fancy-restaurant.jpg',
  breakfast: 'croissant.jpg',
  dinner: 'fancy-restaurant.jpg',
  'cooking show': 'netflix.jpg',
  'food vlogger': 'tiktok.jpg',
  sparkling: 'starbucks.jpg',
  still: 'nature.jpg',
  'eat healthy': 'falafel.jpg',
  'eat happy': 'pizza.jpg',
  iced: 'starbucks.jpg',
  hot: 'turkish-coffee.jpg',
  takeaway: 'noon.jpg',
  'eat in': 'fancy-restaurant.jpg',
  seafood: 'seafood.jpg',
  'red meat': 'grilled.jpg',
  'food truck': 'falafel.jpg',
  restaurant: 'fancy-restaurant.jpg',
  'chai karak': 'chai-karak.jpg',
  cappuccino: 'coffee.jpg',
  'molten chocolate': 'chocolate.jpg',
  'el reem': 'shawarma.jpg',
  'bab el hara': 'shawarma.jpg',
  sobia: 'dates.jpg',
  'qamar el din': 'dates.jpg',

  // Spending & Money
  save: 'financial-freedom.jpg',
  'spend now': 'shopping.jpg',
  'buy a car': 'bmw.jpg',
  invest: 'stocks.jpg',
  rent: 'city-apartment.jpg',
  'buy apartment': 'real-estate.jpg',
  startup: 'wfh.jpg',
  'corporate job': 'suit.jpg',
  freelance: 'wfh.jpg',
  'full time': 'suit.jpg',
  'one big purchase': 'branded.jpg',
  'many small': 'shopping.jpg',
  'credit card': 'shopping.jpg',
  cash: 'financial-freedom.jpg',
  'gold bars': 'gold-bars.jpg',
  'real estate': 'real-estate.jpg',
  'side hustle': 'wfh.jpg',
  focus: 'suit.jpg',
  'budget travel': 'fly.jpg',
  'luxury travel': 'hilton.jpg',
  'designer brand': 'branded.jpg',
  'no-name quality': 'shopping.jpg',
  'salary job': 'suit.jpg',
  'own business': 'wfh.jpg',
  'study abroad': 'fly.jpg',
  'local university': 'books.jpg',
  'financial freedom': 'financial-freedom.jpg',
  mba: 'mba.jpg',
  'first class': 'first-class.jpg',
  budget: 'financial-freedom.jpg',
  luxury: 'hilton.jpg',
  gold: 'gold-bars.jpg',
  stocks: 'stocks.jpg',
  wedding: 'big-wedding.jpg',
  house: 'real-estate.jpg',
  international: 'international-brand.jpg',
  local: 'local-brand.jpg',
  split: 'fancy-restaurant.jpg',
  'one pays': 'financial-freedom.jpg',

  // Everyday Life
  'early riser': 'sunrise.jpg',
  'night owl': 'night-sky.jpg',
  'early bird': 'day-sky.jpg',
  gym: 'gym.jpg',
  outdoor: 'outdoor-workout.jpg',
  'big wedding': 'big-wedding.jpg',
  intimate: 'intimate-wedding.jpg',
  compound: 'compound.jpg',
  'city apartment': 'city-apartment.jpg',
  wfh: 'wfh.jpg',
  office: 'suit.jpg',
  'work from home': 'wfh.jpg',
  read: 'books.jpg',
  watch: 'movies.jpg',
  'move abroad': 'move-abroad.jpg',
  'stay home': 'home-dinner.jpg',
  beach: 'beach.jpg',
  mountain: 'mountains.jpg',
  mountains: 'mountains.jpg',
  summer: 'summer.jpg',
  winter: 'winter.jpg',
  sunrise: 'sunrise.jpg',
  sunset: 'sunset.jpg',
  city: 'city.jpg',
  nature: 'nature.jpg',
  morning: 'sunrise.jpg',
  night: 'night.jpg',
  dogs: 'dogs.jpg',
  cats: 'cats.jpg',
  dog: 'dogs.jpg',
  cat: 'cats.jpg',
  introvert: 'books.jpg',
  extrovert: 'going-out.png',
  homebody: 'home-dinner.jpg',
  'always out': 'going-out.png',
  solo: 'alone-shopping.jpg',
  group: 'going-out.png',
  minimalist: 'nature.jpg',
  maximalist: 'branded.jpg',
  text: 'iphone.jpg',
  call: 'iphone.jpg',
  'travel light': 'fly.jpg',
  'pack everything': 'pack-everything.jpg',
  strict: 'suit.jpg',
  flexible: 'wfh.jpg',
  staycation: 'home-dinner.jpg',
  travel: 'fly.jpg',
  music: 'movies.jpg',
  silence: 'books.jpg',
  'large group': 'going-out.png',
  'small circle': 'coffee.jpg',
  paper: 'books.jpg',
  digital: 'iphone.jpg',
  routine: 'suit.jpg',
  spontaneous: 'fly.jpg',
  journal: 'books.jpg',
  'mental notes': 'iphone.jpg',
  meditation: 'nature.jpg',
  'more sleep': 'night-sky.jpg',
  alarm: 'sunrise.jpg',
  'body clock': 'sunrise.jpg',
  drive: 'city.jpg',
  'be driven': 'uber.png',
  cook: 'home-dinner.jpg',
  'order in': 'order-in.jpg',
  couple: 'gym.jpg',
  'news junkie': 'news-junkie.jpg',
  'news detox': 'nature.jpg',
  cater: 'fancy-restaurant.jpg',
  walk: 'nature.jpg',
  camping: 'camping.jpg',
  hotel: 'hotel.jpg',
  garden: 'compound.jpg',
  penthouse: 'city-apartment.jpg',
  'road trip': 'city.jpg',
  fly: 'fly.jpg',
  'hire maid': 'home-dinner.jpg',
  'do it yourself': 'home-dinner.jpg',

  // Style
  nike: 'nike.jpg',
  adidas: 'adidas.jpg',
  zara: 'zara.jpg',
  'h&m': 'hm.jpg',
  sneakers: 'sneakers.jpg',
  boots: 'boots.jpg',
  'formal shoes': 'suit.jpg',
  books: 'books.jpg',
  'gold jewelry': 'rolex.jpg',
  'silver jewelry': 'casio.jpg',
  balenciaga: 'branded.jpg',
  'off-white': 'sneakers.jpg',
  thobe: 'thobe.jpg',
  'hijab fashion': 'hijab-fashion.jpg',
  'abaya style': 'hijab-fashion.jpg',
  ounass: 'branded.jpg',
  farfetch: 'branded.jpg',
  converse: 'converse.jpg',
  vans: 'vans.jpg',
  'designer sunglasses': 'designer.jpg',
  'local designer': 'local-brand.jpg',
  'international brand': 'international-brand.jpg',
  'minimal makeup': 'natural-beauty.jpg',
  'full glam': 'designer.jpg',
  'follow trends': 'follow-trends.jpg',
  'own style': 'branded.jpg',

  // Brands
  pepsi: 'pepsi.jpg',
  'coca-cola': 'coca-cola.jpg',
  bmw: 'bmw.jpg',
  mercedes: 'mercedes.jpg',
  audi: 'audi.jpg',
  toyota: 'toyota.jpg',
  rolex: 'rolex.jpg',
  casio: 'casio.jpg',
  apple: 'iphone.jpg',
  sony: 'bose.jpg',
  bose: 'bose.jpg',
  kfc: 'kfc.jpg',
  popeyes: 'popeyes.jpg',
  ikea: 'ikea.jpg',
  'louis vuitton': 'louis-vuitton.jpg',
  gucci: 'gucci.jpg',
  versace: 'versace.jpg',
  'd&g': 'versace.jpg',
  'ray-ban': 'ray-ban.jpg',
  oakley: 'ray-ban.jpg',
  nespresso: 'coffee.jpg',
  'turkish pot': 'turkish-pot.jpg',
  hilton: 'hilton.jpg',
  marriott: 'hotel.jpg',
  airbnb: 'airbnb.jpg',
  'uber eats': 'uber-eats.jpg',
  gopro: 'camping.jpg',
  'phone camera': 'phone-camera.jpg',
  dell: 'wfh.jpg',
  hp: 'wfh.jpg',
  wework: 'suit.jpg',
  'home office': 'wfh.jpg',
  uniqlo: 'zara.jpg',
  lululemon: 'gym.jpg',
  'under armour': 'gym.jpg',
  reebok: 'sneakers.jpg',
  puma: 'puma.jpg',
  sephora: 'hijab-fashion.jpg',
  'local shop': 'local-brand.jpg',
  'samsung tv': 'samsung.jpg',
  lg: 'samsung.jpg',
  jordan: 'nike.jpg',
  yeezy: 'adidas.jpg',
  canon: 'phone-camera.jpg',
  "domino's": 'pizza.jpg',
  'local pizza': 'pizza.jpg',
  dyson: 'ikea.jpg',
  'local brand': 'local-brand.jpg',
  weber: 'grilled.jpg',
  'local grill': 'grilled.jpg',
  moleskine: 'books.jpg',
  'any notebook': 'books.jpg',
  'north face': 'mountains.jpg',
  lego: 'playstation.jpg',
  'local toys': 'playstation.jpg',
  'baskin-robbins': 'ice-cream.jpg',
  'local gelato': 'kunafa.jpg',
  'red bull': 'red-bull.jpg',
  monster: 'red-bull.jpg',
  "lay's": 'chips.jpg',
  pringles: 'chips.jpg',
  cheetos: 'chips.jpg',
  gillette: 'suit.jpg',
  'local razor': 'suit.jpg',
  pampers: 'home-dinner.jpg',
  lipton: 'tea.jpg',
  'ahmad tea': 'tea.jpg',
  nutella: 'nutella.jpg',
  'local chocolate spread': 'chocolate.jpg',
  oud: 'oud.jpg',
  fresh: 'fresh-perfume.jpg',

  // Shopping
  'online shop': 'shopping.jpg',
  'brand store': 'brand-store.jpg',
  branded: 'branded.jpg',
  unbranded: 'shopping.jpg',
  alone: 'alone-shopping.jpg',
  'with friends': 'going-out.png',
  'black friday': 'shopping.jpg',
  'souq friday': 'shopping.jpg',
  'normal prices': 'mall.jpg',
  shopping: 'shopping.jpg',
  'window shop': 'window-shop.jpg',
  'buy immediately': 'shopping.jpg',
  'gift cards': 'pick-gift.jpg',
  'cash gifts': 'financial-freedom.jpg',
  'gift card': 'pick-gift.jpg',
  'picked gift': 'pick-gift.jpg',
  'pick gift': 'pick-gift.jpg',
  'duty free': 'duty-free.jpg',
  'return': 'shopping.jpg',
  'keep it': 'branded.jpg',
  'read reviews': 'iphone.jpg',
  'trust instinct': 'branded.jpg',
  'cash on delivery': 'shopping.jpg',
  prepay: 'iphone.jpg',
  'try first': 'mall.jpg',
  'trust online': 'iphone.jpg',
  mall: 'mall.jpg',
  'in-store': 'mall.jpg',

  // Cairo & MENA Local
  cairo: 'cairo.jpg',
  'city stars': 'city-stars-mall.jpg',
  'mall of arabia': 'mall-of-arabia.jpg',
  'abu dhabi': 'abu-dhabi.jpg',
  riyadh: 'abu-dhabi.jpg',
  jeddah: 'dubai-visit.jpg',
  'egyptian': 'egyptian-series.jpg',
  khaleeji: 'dubai-visit.jpg',
  turkish: 'turkish-series.jpg',
  alexandria: 'alexandria.jpg',
  sahel: 'sahel.jpg',
  maadi: 'cairo.jpg',
  heliopolis: 'cairo.jpg',
  zamalek: 'cairo.jpg',
  'new cairo': 'compound.jpg',
  dahab: 'beach.jpg',
  sharm: 'beach.jpg',
  metro: 'metro.jpg',
  'nile cruise': 'nile-cruise.jpg',
  felucca: 'felucca.jpg',
  'nights out': 'going-out.png',
  'friday brunch': 'fancy-restaurant.jpg',
  'sahel weekend': 'sahel.jpg',
  'henna night': 'night.jpg',
  'bachelor party': 'going-out.png',
  private: 'books.jpg',
  public: 'books.jpg',
  'egyptian wedding': 'big-wedding.jpg',
  destination: 'fly.jpg',
  'live there': 'city-apartment.jpg',
  'visit only': 'dubai-visit.jpg',
  'eid shopping': 'shopping.jpg',
  'eid travel': 'fly.jpg',
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
