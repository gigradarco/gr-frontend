import { parseCategoryTags } from './event-list-normaliser'
import type { EventItem } from '../types'

function unsplash(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=80`
}

function picsum(photoId: number): string {
  return `https://picsum.photos/id/${photoId}/1200/800`
}

function numericRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

const BROAD_SPLASH_IMAGE_IDS = [
  ...numericRange(10, 85),
  ...numericRange(87, 96),
  ...numericRange(98, 104),
  ...numericRange(106, 137),
  ...numericRange(139, 147),
  149,
  ...numericRange(151, 204),
  206,
  ...numericRange(208, 223),
  225,
  ...numericRange(227, 244),
  ...numericRange(247, 261),
  ...numericRange(263, 284),
  ...numericRange(287, 297),
  ...numericRange(299, 302),
  ...numericRange(304, 331),
  ...numericRange(334, 345),
  ...numericRange(347, 358),
  ...numericRange(360, 390),
] as const

const BROAD_SPLASH_IMAGES = BROAD_SPLASH_IMAGE_IDS.map(picsum)

const SPLASH_IMAGE_BUCKETS = {
  liveMusic: [
    unsplash('photo-1445985543470-41fba5c3144a'),
    unsplash('photo-1459749411175-04bf5292ceea'),
    unsplash('photo-1468359601543-843bfaef291a'),
    unsplash('photo-1470229722913-7c0e2dbbafd3'),
    unsplash('photo-1471478331149-c72f17e33c73'),
    unsplash('photo-1493225457124-a3eb161ffa5f'),
    unsplash('photo-1501612780327-45045538702b'),
    unsplash('photo-1506157786151-b8491531f063'),
    unsplash('photo-1507874457470-272b3c8d8ee2'),
    unsplash('photo-1511192336575-5a79af67a629'),
    unsplash('photo-1511671782779-c97d3d27a1d4'),
    unsplash('photo-1514525253161-7a46d19cd819'),
    unsplash('photo-1516280440614-37939bbacd81'),
    unsplash('photo-1521337581100-8ca9a73a5f79'),
    unsplash('photo-1524368535928-5b5e00ddc76b'),
    unsplash('photo-1540039155733-5bb30b53aa14'),
    unsplash('photo-1549213783-8284d0336c4f'),
    unsplash('photo-1563841930606-67e2bce48b78'),
    unsplash('photo-1598387993441-a364f854c3e1'),
    unsplash('photo-1619983081563-430f63602796'),
  ],
  clubNight: [
    unsplash('photo-1470225620780-dba8ba36b745'),
    unsplash('photo-1485872299829-c673f5194813'),
    unsplash('photo-1496024840928-4c417adf211d'),
    unsplash('photo-1501386761578-eac5c94b800a'),
    unsplash('photo-1505236858219-8359eb29e329'),
    unsplash('photo-1516450360452-9312f5e86fc7'),
    unsplash('photo-1517457373958-b7bdd4587205'),
    unsplash('photo-1519671482749-fd09be7ccebf'),
    unsplash('photo-1527529482837-4698179dc6ce'),
    unsplash('photo-1530103862676-de8c9debad1d'),
    unsplash('photo-1533174072545-7a4b6ad7a6c3'),
    unsplash('photo-1541532713592-79a0317b6b77'),
    unsplash('photo-1545128485-c400e7702796'),
    unsplash('photo-1556125574-d7f27ec36a06'),
    unsplash('photo-1578946956088-940c3b502864'),
    unsplash('photo-1581974944026-5d6ed762f617'),
    unsplash('photo-1603190287605-e6ade32fa852'),
    unsplash('photo-1645378999013-95abebf5f3c1'),
  ],
  artsCulture: [
    unsplash('photo-1495567720989-cebdbdd97913'),
    unsplash('photo-1500530855697-b586d89ba3ee'),
    unsplash('photo-1503095396549-807759245b35'),
    unsplash('photo-1513475382585-d06e58bcb0e0'),
    unsplash('photo-1518998053901-5348d3961a04'),
    unsplash('photo-1521017432531-fbd92d768814'),
    unsplash('photo-1529119368496-2dfda6ec2804'),
    unsplash('photo-1531058020387-3be344556be6'),
    unsplash('photo-1536924940846-227afb31e2a5'),
    unsplash('photo-1541961017774-22349e4a1262'),
    unsplash('photo-1544531585-9847b68c8c86'),
    unsplash('photo-1545987796-200677ee1011'),
    unsplash('photo-1561214115-f2f134cc4912'),
    unsplash('photo-1563089145-599997674d42'),
    unsplash('photo-1572947650440-e8a97ef053b2'),
    unsplash('photo-1577083552431-6e5fd01aa342'),
    unsplash('photo-1578926375605-eaf7559b1458'),
    unsplash('photo-1594909122845-11baa439b7bf'),
    unsplash('photo-1605106702734-205df224ecce'),
    unsplash('photo-1610018556010-6a11691bc905'),
  ],
  foodDrink: [
    unsplash('photo-1414235077428-338989a2e8c0'),
    unsplash('photo-1470337458703-46ad1756a187'),
    unsplash('photo-1481833761820-0509d3217039'),
    unsplash('photo-1493770348161-369560ae357d'),
    unsplash('photo-1504674900247-0877df9cc836'),
    unsplash('photo-1504754524776-8f4f37790ca0'),
    unsplash('photo-1510812431401-41d2bd2722f3'),
    unsplash('photo-1514362545857-3bc16c4c7d1b'),
    unsplash('photo-1517248135467-4c7edcad34c4'),
    unsplash('photo-1521017432531-fbd92d768814'),
    unsplash('photo-1528605248644-14dd04022da1'),
    unsplash('photo-1532635224-cf024e66d122'),
    unsplash('photo-1540189549336-e6e99c3679fe'),
    unsplash('photo-1544148103-0773bf10d330'),
    unsplash('photo-1551024506-0bccd828d307'),
    unsplash('photo-1551218808-94e220e084d2'),
    unsplash('photo-1555396273-367ea4eb4db5'),
    unsplash('photo-1559329007-40df8a9345d8'),
    unsplash('photo-1564759224907-65b945ff0e84'),
    unsplash('photo-1572116469696-31de0f17cc34'),
    unsplash('photo-1600891964599-f61ba0e24092'),
    unsplash('photo-1600891964092-4316c288032e'),
  ],
  popUpFestival: [
    unsplash('photo-1429962714451-bb934ecdc4ec'),
    unsplash('photo-1464047736614-af63643285bf'),
    unsplash('photo-1492684223066-81342ee5ff30'),
    unsplash('photo-1501281668745-f7f57925c3b4'),
    unsplash('photo-1504680177321-2e6a879aac86'),
    unsplash('photo-1505236858219-8359eb29e329'),
    unsplash('photo-1505373877841-8d25f7d46678'),
    unsplash('photo-1511795409834-ef04bbd61622'),
    unsplash('photo-1517457373958-b7bdd4587205'),
    unsplash('photo-1523580494863-6f3031224c94'),
    unsplash('photo-1527529482837-4698179dc6ce'),
    unsplash('photo-1530103862676-de8c9debad1d'),
    unsplash('photo-1533174072545-7a4b6ad7a6c3'),
    unsplash('photo-1540039155733-5bb30b53aa14'),
    unsplash('photo-1541532713592-79a0317b6b77'),
    unsplash('photo-1556125574-d7f27ec36a06'),
    unsplash('photo-1578946956088-940c3b502864'),
    unsplash('photo-1587825140708-dfaf72ae4b04'),
    unsplash('photo-1603190287605-e6ade32fa852'),
  ],
  workshopNetworking: [
    unsplash('photo-1475721027785-f74eccf877e2'),
    unsplash('photo-1505373877841-8d25f7d46678'),
    unsplash('photo-1511578314322-379afb476865'),
    unsplash('photo-1515187029135-18ee286d815b'),
    unsplash('photo-1516321318423-f06f85e504b3'),
    unsplash('photo-1517048676732-d65bc937f952'),
    unsplash('photo-1517245386807-bb43f82c33c4'),
    unsplash('photo-1519389950473-47ba0277781c'),
    unsplash('photo-1521737604893-d14cc237f11d'),
    unsplash('photo-1522071820081-009f0129c71c'),
    unsplash('photo-1522202176988-66273c2fd55f'),
    unsplash('photo-1523580494863-6f3031224c94'),
    unsplash('photo-1540575467063-178a50c2df87'),
    unsplash('photo-1542744173-8e7e53415bb0'),
    unsplash('photo-1550751827-4bd374c3f58b'),
    unsplash('photo-1551836022-d5d88e9218df'),
    unsplash('photo-1552664730-d307ca884978'),
    unsplash('photo-1556761175-b413da4baf72'),
    unsplash('photo-1560439514-4e9645039924'),
    unsplash('photo-1573164713714-d95e436ab8d6'),
    unsplash('photo-1587825140708-dfaf72ae4b04'),
    unsplash('photo-1591115765373-5207764f72e7'),
  ],
  wellnessSport: [
    unsplash('photo-1506126613408-eca07ce68773'),
    unsplash('photo-1518611012118-696072aa579a'),
    unsplash('photo-1521804906057-1df8fdb718b7'),
    unsplash('photo-1534258936925-c58bed479fcb'),
    unsplash('photo-1540206276207-3af25c08abc4'),
    unsplash('photo-1544367567-0f2fcb009e0b'),
    unsplash('photo-1546483875-ad9014c88eba'),
    unsplash('photo-1550345332-09e3ac987658'),
    unsplash('photo-1552674605-db6ffd4facb5'),
    unsplash('photo-1554284126-aa88f22d8b74'),
    unsplash('photo-1562771242-a02d9090c90c'),
    unsplash('photo-1571019613454-1cb2f99b2d8b'),
    unsplash('photo-1574680096145-d05b474e2155'),
    unsplash('photo-1576678927484-cc907957088c'),
    unsplash('photo-1581009146145-b5ef050c2e1e'),
    unsplash('photo-1599058917212-d750089bc07e'),
    unsplash('photo-1603988363607-e1e4a66962c6'),
    unsplash('photo-1616279969856-759f316a5ac1'),
  ],
  fashionDesign: [
    unsplash('photo-1483985988355-763728e1935b'),
    unsplash('photo-1496747611176-843222e1e57c'),
    unsplash('photo-1503342217505-b0a15ec3261c'),
    unsplash('photo-1509631179647-0177331693ae'),
    unsplash('photo-1515886657613-9f3515b0c78f'),
    unsplash('photo-1516762689617-e1cffcef479d'),
    unsplash('photo-1529139574466-a303027c1d8b'),
    unsplash('photo-1539109136881-3be0616acf4b'),
    unsplash('photo-1558769132-cb1aea458c5e'),
    unsplash('photo-1562157873-818bc0726f68'),
    unsplash('photo-1566206091558-7f218b696731'),
    unsplash('photo-1581044777550-4cfa60707c03'),
    unsplash('photo-1593030761757-71fae45fa0e7'),
    unsplash('photo-1596462502278-27bfdc403348'),
    unsplash('photo-1603217192097-13c306522271'),
  ],
  outdoorCommunity: [
    unsplash('photo-1445307806294-bff7f67ff225'),
    unsplash('photo-1469474968028-56623f02e42e'),
    unsplash('photo-1472396961693-142e6e269027'),
    unsplash('photo-1475721027785-f74eccf877e2'),
    unsplash('photo-1500530855697-b586d89ba3ee'),
    unsplash('photo-1506744038136-46273834b3fb'),
    unsplash('photo-1507525428034-b723cf961d3e'),
    unsplash('photo-1500534314209-a25ddb2bd429'),
    unsplash('photo-1500534623283-312aade485b7'),
    unsplash('photo-1517457373958-b7bdd4587205'),
    unsplash('photo-1529156069898-49953e39b3ac'),
    unsplash('photo-1532274402911-5a369e4c4bb5'),
    unsplash('photo-1533106418989-88406c7cc8ca'),
    unsplash('photo-1541532713592-79a0317b6b77'),
    unsplash('photo-1596484552834-6a58f850e0a1'),
  ],
  generic: [
    unsplash('photo-1429962714451-bb934ecdc4ec'),
    unsplash('photo-1464047736614-af63643285bf'),
    unsplash('photo-1475721027785-f74eccf877e2'),
    unsplash('photo-1492684223066-81342ee5ff30'),
    unsplash('photo-1501281668745-f7f57925c3b4'),
    unsplash('photo-1501386761578-eac5c94b800a'),
    unsplash('photo-1504680177321-2e6a879aac86'),
    unsplash('photo-1505236858219-8359eb29e329'),
    unsplash('photo-1505373877841-8d25f7d46678'),
    unsplash('photo-1506744038136-46273834b3fb'),
    unsplash('photo-1511578314322-379afb476865'),
    unsplash('photo-1511795409834-ef04bbd61622'),
    unsplash('photo-1514525253161-7a46d19cd819'),
    unsplash('photo-1517048676732-d65bc937f952'),
    unsplash('photo-1517457373958-b7bdd4587205'),
    unsplash('photo-1523580494863-6f3031224c94'),
    unsplash('photo-1525625293386-3f8f99389edd'),
    unsplash('photo-1527529482837-4698179dc6ce'),
    unsplash('photo-1529156069898-49953e39b3ac'),
    unsplash('photo-1530103862676-de8c9debad1d'),
    unsplash('photo-1533174072545-7a4b6ad7a6c3'),
    unsplash('photo-1540039155733-5bb30b53aa14'),
    unsplash('photo-1540575467063-178a50c2df87'),
    unsplash('photo-1541532713592-79a0317b6b77'),
    unsplash('photo-1551818255-e6e10975bc17'),
    unsplash('photo-1556125574-d7f27ec36a06'),
    unsplash('photo-1556761175-b413da4baf72'),
    unsplash('photo-1578946956088-940c3b502864'),
    unsplash('photo-1587825140708-dfaf72ae4b04'),
    unsplash('photo-1603190287605-e6ade32fa852'),
  ],
} as const

type SplashBucket = keyof typeof SPLASH_IMAGE_BUCKETS
type SplashImageEventContext = Pick<EventItem, 'title' | 'genre'> &
  Partial<Pick<EventItem, 'district' | 'exploreCategoryId' | 'host' | 'hostPrompt' | 'venue' | 'vibeTags'>>

const RELATED_SPLASH_BUCKETS: Record<SplashBucket, readonly SplashBucket[]> = {
  liveMusic: ['clubNight', 'popUpFestival', 'generic'],
  clubNight: ['liveMusic', 'popUpFestival', 'generic'],
  artsCulture: ['fashionDesign', 'outdoorCommunity', 'generic'],
  foodDrink: ['popUpFestival', 'outdoorCommunity', 'generic'],
  popUpFestival: ['liveMusic', 'clubNight', 'foodDrink', 'outdoorCommunity', 'generic'],
  workshopNetworking: ['artsCulture', 'outdoorCommunity', 'generic'],
  wellnessSport: ['outdoorCommunity', 'generic'],
  fashionDesign: ['artsCulture', 'popUpFestival', 'generic'],
  outdoorCommunity: ['popUpFestival', 'foodDrink', 'generic'],
  generic: [
    'liveMusic',
    'clubNight',
    'artsCulture',
    'foodDrink',
    'popUpFestival',
    'workshopNetworking',
    'wellnessSport',
    'fashionDesign',
    'outdoorCommunity',
  ],
}

function stableIndex(seed: string, size: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return size === 0 ? 0 : hash % size
}

export function isSplashImageUrl(url: string): boolean {
  return url.includes('images.unsplash.com/') || url.includes('picsum.photos/id/')
}

function uniqueImages(images: readonly string[]): string[] {
  return [...new Set(images)]
}

function candidateImagesForBucket(bucket: SplashBucket): string[] {
  const relatedImages = RELATED_SPLASH_BUCKETS[bucket].flatMap((relatedBucket) => SPLASH_IMAGE_BUCKETS[relatedBucket])
  return uniqueImages([...SPLASH_IMAGE_BUCKETS[bucket], ...relatedImages, ...BROAD_SPLASH_IMAGES])
}

function seedFromEvent(row: Record<string, unknown>, item?: Pick<EventItem, 'id' | 'title' | 'genre'>): string {
  return [
    row.event_id,
    item?.id,
    row.title,
    item?.title,
    row.category,
    item?.genre,
    row.source_url,
    row.location,
    row.venue,
    row.host,
    row.event_datetime,
    row.start_time,
    row.display_datetime,
  ]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean)
    .join('|')
}

function textFromEvent(row: Record<string, unknown>, item?: SplashImageEventContext): string {
  return [
    ...parseCategoryTags(row.category),
    ...parseCategoryTags(row.category_id),
    ...parseCategoryTags(row.categoryId),
    ...parseCategoryTags(row.tags),
    ...parseCategoryTags(row.vibeTags),
    row.taste_and_recommendations,
    row.the_experience,
    row.title,
    row.venue,
    row.location,
    row.district,
    row.host,
    row.platform,
    item?.exploreCategoryId,
    item?.genre,
    item?.title,
    item?.venue,
    item?.district,
    item?.host,
    item?.hostPrompt,
    ...(item?.vibeTags ?? []),
  ]
    .map((value) => (value == null ? '' : String(value).toLowerCase()))
    .join(' ')
}

function splashBucketForEvent(row: Record<string, unknown>, item?: SplashImageEventContext): SplashBucket {
  const text = textFromEvent(row, item)

  if (/\b(jazz|blues|band|singer|acoustic|concert|orchestra|gig|live music|capitol)\b/.test(text)) {
    return 'liveMusic'
  }
  if (/\b(club|dj|techno|house|dance|nightlife|rave|electronic|underground)\b/.test(text)) {
    return 'clubNight'
  }
  if (/\b(art|arts|culture|gallery|exhibition|museum|theatre|theater|film|comedy|performance)\b/.test(text)) {
    return 'artsCulture'
  }
  if (/\b(food|drink|cocktail|bar|wine|beer|dining|restaurant|tasting|brunch|coffee)\b/.test(text)) {
    return 'foodDrink'
  }
  if (/\b(workshop|conference|meetup|networking|founder|startup|tech|ai|developer|product|business)\b/.test(text)) {
    return 'workshopNetworking'
  }
  if (/\b(yoga|wellness|fitness|run|running|sport|sports|pilates|meditation|health)\b/.test(text)) {
    return 'wellnessSport'
  }
  if (/\b(fashion|design|style|beauty|makeup|retail|shopping|craft|maker|makers)\b/.test(text)) {
    return 'fashionDesign'
  }
  if (/\b(outdoor|community|garden|park|beach|walk|walking|nature|picnic|social)\b/.test(text)) {
    return 'outdoorCommunity'
  }
  if (/\b(festival|festivals|market|markets|popup|popups|pop[- ]?up|fair|outdoor|community|bazaar)\b/.test(text)) {
    return 'popUpFestival'
  }

  return 'generic'
}

export function splashImageForEventRow(
  row: Record<string, unknown>,
  item?: Pick<EventItem, 'id' | 'title' | 'genre'>,
): string {
  const bucket = splashBucketForEvent(row, item)
  const images = candidateImagesForBucket(bucket)
  const seed = seedFromEvent(row, item)
  return images[stableIndex(`${bucket}:${seed || 'event'}`, images.length)]
}
