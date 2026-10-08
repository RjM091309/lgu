// Local answer engine for the Ask LIMS chat, used while the LGU's eGovAI access is pending.
// It understands English, Filipino and Taglish questions, including text-speak ("pano", "kelan", "reso"),
// misspellings ("ordinanse", "tricyle"), Filipino affixes ("naipasa", "basurahan") and everyday words for
// legislative topics ("basura", "trike", "palengke"). It answers only from the records posted on LIMS,
// replies in the language the question was asked in, and remembers what was discussed for follow-ups.

import {
  BARANGAYS,
  LGU_PROFILE,
  mockAttendanceMarks,
  mockAttendanceSessions,
  mockBills,
  mockCommitteeAssignments,
  mockCommitteeHearings,
  mockCommittees,
  mockMembers,
  mockPublications,
  mockSeededSessions,
  mockSessions,
  mockYearlyActivity,
  type Bill,
  type Committee,
  type PublicationRecord,
  type Session,
} from '@/lib/mock-data';
import { buildAgenda } from '@/lib/sessions';
import type { PendingConfirmation } from '@/lib/egovai';

export type AssistantLang = 'EN' | 'FIL';

export interface AssistantAnswer {
  progress: string[];
  text: string;
  sources: string[];
  /** Suggested next questions, shown as quick replies. */
  followUps: string[];
  pendingConfirmation?: PendingConfirmation;
}

export interface AnswerOptions {
  sessionId: string;
  /** The portal's language, used when the question itself doesn't show which language to answer in. */
  uiLang: AssistantLang;
  confirmationToken?: string;
}

const SUBSCRIBE_TOKEN = 'demo-subscribe-session-notices';

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

type Status = Bill['status'];

interface LegislativeRecord {
  number: string;
  title: string;
  status: Status;
  classification: 'Ordinance' | 'Resolution';
  category?: string;
  subject?: string;
  description?: string;
  committee?: string;
  author?: string;
  coAuthor?: string;
  dateFiled?: string;
  actionTaken?: string;
  publication?: PublicationRecord;
}

const RECORDS: LegislativeRecord[] = [
  ...mockBills.map(
    (bill): LegislativeRecord => ({
      number: bill.number,
      title: bill.title,
      status: bill.status,
      classification: bill.classification ?? (/res/i.test(bill.number) ? 'Resolution' : 'Ordinance'),
      category: bill.category,
      subject: bill.subject,
      description: bill.description,
      committee: bill.committee,
      author: bill.author,
      coAuthor: bill.coAuthor,
      dateFiled: bill.dateFiled,
      actionTaken: bill.actionTaken,
      publication: mockPublications.find((p) => p.number === bill.number),
    })
  ),
  // Enacted ordinances that appear only in the publication tracker.
  ...mockPublications
    .filter((p) => !mockBills.some((bill) => bill.number === p.number))
    .map((p): LegislativeRecord => ({ number: p.number, title: p.title, status: 'Enacted', classification: 'Ordinance', publication: p })),
];

const recordDate = (record: LegislativeRecord) => record.dateFiled ?? record.publication?.approvedOn ?? '';
const shortName = (record: LegislativeRecord) => record.subject ?? record.title.replace(/^(An Ordinance|Resolution)\s+/i, '');

// ---------------------------------------------------------------------------
// Language understanding
// ---------------------------------------------------------------------------

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    // "hellooo" -> "hello", "pleaseee" -> "please"
    .replace(/([a-z])\1{2,}/g, '$1');

const splitWords = (text: string) => text.split(/[^a-z0-9]+/).filter((word) => word.length > 1 || /\d/.test(word));

// Light English stemming, applied the same way to questions and records.
const stem = (word: string) => {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && /(ss|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  if (word.length > 6 && word.endsWith('ing')) return word.slice(0, -3);
  return word;
};

// Multi-word expressions, rewritten into a single concept before the question is split into words.
const PHRASES: [RegExp, string][] = [
  [/\bhow (many|much)\b/g, 'howmany'],
  [/\bgood (morning|afternoon|evening|day|am|pm)\b|\bgud (am|pm|morning|eve)\b|\bmagandang (umaga|tanghali|hapon|gabi|araw)\b/g, 'hello'],
  [/\bthank (you|u)\b/g, 'thanks'],
  [/\bsee (you|ya)\b/g, 'bye'],
  [/\bwhat (can|do) (you|u) (do|know|answer)\b|\bano (ang |ba ang )?(kaya|pwede|puwede|alam) (mo|mong|ko|kong|itanong)\b/g, 'help'],
  [
    /\bwho (are|r) (you|u)\b|\bsino ka\b|\bano ka\b|\bwhat are (you|u)\b|\b(are|r) (you|u) (a |an )?(bot|robot|ai|human|real|person|tao)\b|\b(tao|bot|robot|ai) ka ba\b|\b(your|ur) name\b|\bpangalan mo\b/g,
    'identity',
  ],
  [/\bvice[- ]?mayor\b|\bbise[- ]?(mayor|alkalde)\b/g, 'vicemayor'],
  [/\b(first|1st) reading\b|\bunang pagbasa\b/g, 'firstreading'],
  [/\b(second|2nd) reading\b|\bikalawang pagbasa\b/g, 'secondreading'],
  [/\b(third|3rd) reading\b|\bikatlong pagbasa\b/g, 'thirdreading'],
  [/\bpublic hearings?\b|\bpampublikong pagdinig\b/g, 'hearing'],
  [/\bcertified (true )?cop(y|ies)\b|\bsertipikadong kopya\b|\bctc\b/g, 'copy'],
  [/\bfreedom of information\b/g, 'foi'],
  [/\border of business\b|\bpag-?uusapan\b|\btatalakayin\b|\bpag-?uusapan\b/g, 'agenda'],
  [/\bthis week\b|\bngayong linggo\b|\bsa linggong ito\b/g, 'thisweek'],
  [/\bnext week\b|\bsusunod na linggo\b/g, 'nextweek'],
  [/\bthis month\b|\bngayong buwan\b/g, 'thismonth'],
  [/\bthis year\b|\bngayong taon\b/g, 'thisyear'],
  [/\bin (the )?committee\b|\bnasa komite\b|\bcommittee (level|stage)\b/g, 'incommittee'],
  [/\bnot yet (approved|passed|enacted)\b|\bhindi pa (naipapasa|naipasa|aprubado|pasado|naaprubahan)\b/g, 'pending'],
  [/\bin effect\b|\bmay bisa\b/g, 'enacted'],
  [/\bsangguniang kabataan\b/g, 'sk'],
  [/\bsangguniang bayan\b/g, 'sanggunian'],
  [/\bliga ng mga barangay\b|\bbarangay captains?\b|\bkapitan\b/g, 'abc'],
  [/\bsb members?\b/g, 'councilor'],
  [/\bmakipag-?ugnayan\b|\bget in touch\b|\breach (you|the office|them)\b/g, 'contact'],
  [/\bnasaan na\b|\bano na\b|\bupdate (sa|on)\b/g, 'status'],
  [/\btell me more\b|\bmore (info|details|information)\b|\bdagdag na (info|impormasyon)\b|\bdetalye\b/g, 'more'],
  [/\bupdate me\b|\bkeep me (posted|updated)\b/g, 'subscribe'],
  [
    /\bwho (filed|wrote|authored|sponsored|proposed|made)\b|\bsino (ang )?(nag-?akda|nagpanukala|gumawa|nag-?file|may-?akda|sponsor|author)\b|\bmay-?akda\b|\bnag-?akda\b/g,
    'author',
  ],
  [
    /\bpaano (ba )?(maging|naging|nagiging|maipasa|naipapasa|ginagawa|gumawa)\b|\bhow (is|are|does|do) (an? )?(ordinance|ordinances|law|laws|bill|bills|resolution|resolutions) (become|becomes|get|made|passed|enacted|approved|created)\b|\blegislative process\b/g,
    'process',
  ],
];

// Concept -> the ways people write it (English, Filipino, Taglish, text-speak, common misspellings).
const ALIAS_GROUPS: Record<string, string> = {
  what: 'what whats wat wut ano anu anong anung alin aling which',
  when: 'when kailan kelan kilan kaylan kailn',
  where: 'where saan san saang nasaan nsaan asan nasan',
  who: 'who sino cno sinu sinong sno',
  how: 'how paano pano panu paanu paanong panong',
  howmany: 'ilan ilang ilng',
  why: 'why bakit bkt',
  hello: 'hello hi hey helo hellow hallo hoy yo musta kumusta kamusta kmusta kmsta mabuhay greetings sup howdy',
  thanks: 'thanks thank thx tnx ty tysm salamat slamat salamuch thankyou thanku',
  praise: 'nice great awesome galing ayos cool good wow astig perfect',
  ack: 'ok okay oki sige noted gets',
  bye: 'bye goodbye paalam babay byebye ingat cya',
  help: 'help tulong tulungan assist menu options commands',
  ordinance: 'ordinance ordinances ordinansa ordinansya ordinanza ordi ord ords ordnance',
  resolution: 'resolution resolutions resolusyon reso resos resolusion',
  measure: 'bill bills measure measures panukala panukalang batas law laws legislation lehislasyon policy policies patakaran regulation regulasyon kautusan',
  session: 'session sessions sesyon sesion sesiyon sessyon meeting meetings pulong pagpupulong miting assembly',
  hearing: 'hearing hearings pagdinig consultation konsultasyon',
  schedule: 'schedule schedules sched sked skedyul iskedyul calendar kalendaryo timetable',
  time: 'time oras',
  date: 'date petsa',
  agenda: 'agenda adyenda topics',
  next: 'next upcoming susunod sunod paparating darating coming soon',
  last: 'last previous prev huling nakaraan nakaraang katatapos',
  latest: 'latest newest pinakabago bago bagong recent recently kamakailan new',
  today: 'today ngayon tonight',
  tomorrow: 'tomorrow bukas',
  regular: 'regular',
  special: 'special espesyal ispesyal',
  attend: 'attend attending dumalo pumunta manood watch observe join sumali speak magsalita participate lumahok salita',
  contact: 'contact kontak contak ugnayan email mail phone telepono tel cellphone cp viber call tawag tawagan text txt hotline',
  address: 'address adres location lokasyon located',
  office: 'office opisina secretariat sekretarya secretary sekretaryo',
  request: 'request requests hiling humiling hingi humingi kuha kumuha makakuha obtain',
  copy: 'copy copies kopya certified sertipikado photocopy xerox',
  document: 'document documents dokumento docs doc papel papers record records rekord',
  foi: 'foi',
  subscribe: 'subscribe subscription notify notification notifications abisuhan abiso paalala remind reminder alert alerts register rehistro magparehistro',
  councilor: 'councilor councilors councillor councillors konsehal konsehala konsi kagawad member members miyembro kasapi official officials opisyal politician pulitiko',
  mayor: 'mayor alkalde meyor mayora',
  presiding: 'presiding',
  sanggunian: 'sanggunian sangguniang sb council konseho legislature lehislatura',
  ipmr: 'ipmr indigenous katutubo aeta',
  abc: 'abc liga',
  sk: 'sk kabataan youth',
  committee: 'committee committees komite kumite commitee comittee',
  chair: 'chair chairman chairperson chairwoman head pinuno namumuno tagapangulo',
  stats: 'statistics stats stat bilang count total kabuuan performance accomplishment accomplishments nagawa',
  quorum: 'quorum korum',
  attendance: 'attendance present absent liban',
  process: 'process proseso steps hakbang procedure pamamaraan',
  define: 'meaning mean means ibig sabihin kahulugan define definition explain ipaliwanag difference pagkakaiba vs versus',
  barangay: 'barangay barangays brgy bgy brg baranggay',
  capas: 'capas tarlac municipality munisipyo town bayan lgu',
  lims: 'lims portal website site system',
  status: 'status estado lagay kalagayan progress',
  author: 'author authored authors akda sponsor sponsored sponsors nagpanukala proponent gumawa',
  filed: 'filed inihain isinampa submitted',
  more: 'more details detail info information impormasyon dagdag',
  ref: 'it that this those these yan iyan yun iyon yon ito nito niyan nun dun doon',
  pending: 'pending nakabinbin binbin ongoing proposed',
  approved: 'approved approve passed pass pasa pasado naipasa ipinasa pinagtibay aprobado inaprubahan apruba adopted',
  enacted: 'enacted enact naisabatas effective epektibo umiiral existing implemented ipinatutupad',
  draft: 'draft borador',
  vetoed: 'vetoed veto vinito',
  list: 'list listahan lista all lahat show ipakita pakita display',
};

// Concepts produced by PHRASES, so they are recognized when the question is split into words.
const PHRASE_CONCEPTS = 'identity vicemayor firstreading secondreading thirdreading thisweek nextweek thismonth thisyear incommittee';

const ALIAS = new Map<string, string>();
for (const [concept, words] of Object.entries(ALIAS_GROUPS)) {
  ALIAS.set(concept, concept);
  for (const word of words.split(' ')) ALIAS.set(word, concept);
}
for (const concept of PHRASE_CONCEPTS.split(' ')) ALIAS.set(concept, concept);

// Words that carry no meaning on their own (still used to tell English from Filipino).
const STOP = new Set(
  (
    'po opo ba na pa ng ang mga sa si ni kay at ay nga naman lang lamang din rin daw raw kaya pwede puwede pde paki pakisabi pls plz please ' +
    'gusto ko mo ka ako ikaw kayo tayo natin namin nyo niyo ninyo akin iyong yung ung un eh ah uh hmm oh so then tapos pala kasi sana nang dito diyan ' +
    'the an of and or for in on to is are was were be been am do does did me my mine you your we our us can could would will shall should any there ' +
    'have has had about tungkol regarding re with may meron mayroon merong wala walang hindi di not no yes oo know alam need kailangan want like ' +
    'parang just also only some kung if as by from into than tell give bigay pakibigay hanapin find search look anything something ask itanong ' +
    'first second third 1st 2nd 3rd una unang pangalawa pangalawang ikalawa pangatlo pangatlong ikatlo one number public publiko open ' +
    'currently now right available kindly still yet already ngayong exist exists'
  ).split(' ')
);

// Everyday, Filipino and uncommon words mapped to the terms used in the records.
const SYNONYM_GROUPS: [string[], string][] = [
  [
    ['tricycle', 'franchising', 'fare', 'transportation'],
    'trike traysikel trysikel traysikol tryk tricy trisikel motorela pedicab padyak kolorum colorum habal prangkisa prankisa franchise pamasahe pasahe plete toda drayber driver byahe biyahe commute commuter pasahero passenger sasakyan vehicle transport transportasyon',
  ],
  [['parking', 'road'], 'paradahan pumarada towing obstruction sidewalk bangketa traffic trapiko'],
  [
    ['waste', 'littering', 'segregation', 'plastic'],
    'garbage trash rubbish refuse litter litterer basura kalat dumi magkalat tapon pagtatapon dump dumpsite landfill recycle recycling compost nabubulok segregate sanitation kalinisan malinis clean cleanliness mrf solid',
  ],
  [['plastic', 'single'], 'plastik supot sachet styrofoam straw cellophane selopeyn'],
  [['penalties', 'fines'], 'fine multa penalty parusa violation paglabag lumabag sanction kulong'],
  [
    ['health', 'laboratory', 'rural'],
    'hospital ospital clinic klinika doctor doktor nurse medical medikal medicine gamot sakit sick lab laboratoryo xray diagnostic rhu kalusugan healthcare',
  ],
  [
    ['scholarship', 'education', 'student'],
    'scholar iskolar eskolar iskolarship school eskwela eskuwela paaralan college kolehiyo university unibersidad tuition matrikula allowance estudyante pag-aaral aral edukasyon study enroll baon',
  ],
  [
    ['farmers', 'agriculture', 'seed', 'fertilizer'],
    'farmer magsasaka farm farming bukid sakahan saka agri agrikultura palay rice bigas gulay vegetable binhi similya pataba abono irrigation patubig drought tagtuyot harvest ani crops pananim',
  ],
  [['market', 'stall', 'rental'], 'palengke merkado tiangge puwesto pwesto vendor tindero tindera magtitinda nagtitinda tindahan upa renta rent'],
  [
    ['tourism', 'pinatubo', 'trekking', 'tour', 'guide'],
    'turista tourist turismo crater trek hike hiking akyat umakyat bundok mountain volcano bulkan 4x4 gabay pasyalan travel lakbay bakasyon visitor bisita adventure lahar',
  ],
  [['heritage', 'shrine', 'memorial'], 'pamana dambana monument monumento historical kasaysayan history museum museo war gyera digmaan veterans beterano odonnell bataan'],
  [
    ['disaster', 'flood', 'rescue', 'preparedness'],
    'sakuna kalamidad calamity baha bagyo typhoon storm unos rescuer sagip evacuation lumikas evacuate drrm mdrrmo emergency earthquake lindol landslide ilog river',
  ],
  [['road', 'access', 'infrastructure'], 'kalsada daan daanan highway bridge tulay nccc imprastraktura construction konstruksyon proyekto project lubak pothole'],
  [['funds', 'appropriating', 'supplemental', 'budget'], 'badyet pondo fund funding appropriation gastos pera money finance pananalapi'],
  [['videoke', 'sound'], 'karaoke ingay maingay noise noisy speaker tugtog music musika'],
  [['environment', 'environmental'], 'kapaligiran kalikasan nature pollution polusyon tree puno forest gubat climate'],
  [['prohibiting', 'regulating', 'penalties'], 'bawal ban banned bans prohibit prohibited ipinagbabawal pinagbabawal'],
];

const SYNONYMS = new Map<string, string[]>();
for (const [targets, words] of SYNONYM_GROUPS) {
  const stemmedTargets = targets.map(stem);
  for (const word of words.split(' ')) {
    const key = stem(word.replace(/-/g, ''));
    SYNONYMS.set(key, [...new Set([...(SYNONYMS.get(key) ?? []), ...stemmedTargets])]);
  }
}

// Words in the records that say nothing about the topic.
const INDEX_STOP = new Set(
  'an the of and for in to within by with its at on as from into ordinance resolution capas municipality municipal mun ord res prop no sb new'.split(' ')
);

const indexText = (fields: [string | undefined, number][]) => {
  const terms = new Map<string, number>();
  for (const [text, weight] of fields) {
    for (const word of splitWords(fold(text ?? ''))) {
      if (/^\d+$/.test(word) || word.length < 3 || INDEX_STOP.has(word)) continue;
      const term = stem(word);
      terms.set(term, Math.max(terms.get(term) ?? 0, weight));
    }
  }
  return terms;
};

const RECORD_INDEX = RECORDS.map((record) => ({
  record,
  terms: indexText([
    [record.subject, 3],
    [record.title, 2],
    [record.category, 2],
    [record.description, 1],
    [record.committee, 0.5],
    [record.actionTaken, 0.3],
  ]),
}));

const IDF = new Map<string, number>();
{
  const df = new Map<string, number>();
  for (const { terms } of RECORD_INDEX) for (const term of terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  for (const [term, count] of df) IDF.set(term, Math.log(1 + RECORD_INDEX.length / count));
}

// The sample calendar's sessions and hearings, as published (meetings are internal). Changes made during a
// demo are not reflected here: the assistant answers from the published schedule.
const PUBLIC_SESSIONS: Session[] = [...mockSessions, ...mockSeededSessions.filter((session) => session.type !== 'Meeting')];

const SESSION_INDEX = PUBLIC_SESSIONS.map((session) => ({
  session,
  terms: indexText([
    [session.title, 2],
    [mockCommittees.find((c) => c.id === session.committeeId)?.name, 1],
  ]),
}));

const COMMITTEE_INDEX = mockCommittees.map((committee) => ({
  committee,
  terms: indexText([
    [committee.name.replace(/^Committee on /, ''), 2],
    [RECORDS.filter((r) => r.committee === committee.name).map((r) => `${r.category ?? ''} ${r.subject ?? ''}`).join(' '), 1],
  ]),
}));

const VOCAB = new Set<string>();
for (const { terms } of [...RECORD_INDEX, ...SESSION_INDEX, ...COMMITTEE_INDEX]) for (const term of terms.keys()) VOCAB.add(term);
for (const name of BARANGAYS) for (const word of splitWords(fold(name))) if (word.length > 2) VOCAB.add(stem(word));

const KNOWN_WORDS = [...new Set([...ALIAS.keys(), ...SYNONYMS.keys(), ...VOCAB])].filter((word) => word.length >= 3 && !word.includes('_'));

// Optimal string alignment distance: edits, including swapped neighbours ("tricyle" -> "tricycle").
function editDistance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, rows[i][j]);
    }
    if (rowMin > limit) return limit + 1;
  }
  return rows[a.length][b.length];
}

function nearestKnownWord(word: string) {
  const limit = word.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestDistance = limit + 1;
  for (const candidate of KNOWN_WORDS) {
    // Shorter words must at least start with the same letter.
    if (word.length < 6 && candidate[0] !== word[0]) continue;
    const distance = editDistance(word, candidate, limit);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

const TL_PREFIXES = ['pinaka', 'nakaka', 'makaka', 'ipag', 'naka', 'maka', 'ipa', 'nag', 'mag', 'pag', 'nang', 'mang', 'pang', 'ka', 'ma', 'na', 'pa', 'i'];
const TL_SUFFIXES = ['han', 'hin', 'an', 'in'];

// Possible root words of a Filipino word: "naipasa" -> "ipasa" -> "pasa", "basurahan" -> "basura",
// "nagbabasura" -> "basura", "nakabinbing" -> "nakabinbin", "sertipikadong" -> "sertipikado".
function filipinoRoots(word: string) {
  const roots = new Set<string>();
  const add = (root: string) => {
    if (root.length >= 3 && root !== word) roots.add(root);
    // Reduplicated first syllable: "babasa" -> "basa", "kakalat" -> "kalat".
    if (root.length >= 6 && root.slice(0, 2) === root.slice(2, 4)) roots.add(root.slice(2));
  };
  if (word.endsWith('ng')) {
    add(word.slice(0, -1));
    add(word.slice(0, -2));
  }
  for (const prefix of TL_PREFIXES) if (word.startsWith(prefix)) add(word.slice(prefix.length));
  for (const suffix of TL_SUFFIXES) if (word.endsWith(suffix)) add(word.slice(0, -suffix.length));
  // Infixes: "tumakbo" -> "takbo", "pinasa" -> "pasa".
  if (/^[^aeiou](um|in)/.test(word)) add(word[0] + word.slice(3));
  return [...roots];
}

type WordMeaning =
  | { kind: 'concept'; value: string }
  | { kind: 'topic'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'stop' }
  | { kind: 'unknown'; value: string };

function understandWord(word: string, depth = 0): WordMeaning & { corrected?: string } {
  if (/^\d+$/.test(word)) return { kind: 'number', value: word };
  const concept = ALIAS.get(word) ?? ALIAS.get(stem(word));
  if (concept) return { kind: 'concept', value: concept };
  if (STOP.has(word)) return { kind: 'stop' };
  const term = stem(word.replace(/-/g, ''));
  if (SYNONYMS.has(term) || VOCAB.has(term)) return { kind: 'topic', value: term };
  if (depth < 2) {
    for (const root of filipinoRoots(word)) {
      const meaning = understandWord(root, depth + 1);
      if (meaning.kind === 'concept' || meaning.kind === 'topic') return meaning;
    }
  }
  // Only longer words are spell-corrected; short ones are too easy to misread ("dogs" is not "docs").
  if (depth === 0 && word.length >= 5) {
    const near = nearestKnownWord(word);
    if (near) {
      const meaning = understandWord(near, 1);
      if (meaning.kind === 'concept' || meaning.kind === 'topic') return { ...meaning, corrected: near };
    }
  }
  return { kind: 'unknown', value: word };
}

const FIL_MARKERS = new Set(
  (
    'ang ng mga sa po ba ano anong sino kailan kelan saan paano pano ilan ilang may meron mayroon wala yung ung ito iyan yan naman lang kasi ' +
    'pwede puwede gusto ko mo namin natin kayo tungkol magandang salamat kumusta kamusta musta opo hindi oo nga daw raw bakit nasaan sana ' +
    'paki pakisabi tayo niyo nyo ninyo si ni kay nang din rin pala dito diyan doon ordinansa resolusyon sesyon susunod bukas ngayon lahat ' +
    'naipasa nakabinbin konsehal humingi kopya'
  ).split(' ')
);
const EN_MARKERS = new Set(
  'the is are what whats when where how who which of about please can do does there any my was will could would you your thanks thank for with this that show list me'.split(
    ' '
  )
);

function detectLanguage(words: string[], fallback: AssistantLang): AssistantLang {
  const filipino = words.filter((word) => FIL_MARKERS.has(word)).length;
  const english = words.filter((word) => EN_MARKERS.has(word)).length;
  if (filipino > english) return 'FIL';
  if (english > filipino) return 'EN';
  return fallback;
}

interface Parsed {
  text: string;
  lang: AssistantLang;
  concepts: Set<string>;
  topics: string[];
  unknown: string[];
  corrections: string[];
  year?: string;
  ordinal?: number;
  /** Asks about several things ("sessions", "mga komite", "what are"), not one. */
  plural: boolean;
}

const ORDINALS: [RegExp, number][] = [
  [/\b(first|1st|una|unang|number 1|no\.? ?1)\b/, 0],
  [/\b(second|2nd|pangalawa|pangalawang|ikalawa|number 2|no\.? ?2)\b/, 1],
  [/\b(third|3rd|pangatlo|pangatlong|ikatlo|number 3|no\.? ?3)\b/, 2],
];

function parse(question: string, uiLang: AssistantLang): Parsed {
  const folded = fold(question);
  let text = ` ${folded} `;
  for (const [pattern, concept] of PHRASES) text = text.replace(pattern, ` ${concept} `);

  const parsed: Parsed = {
    text,
    lang: detectLanguage(splitWords(folded), uiLang),
    concepts: new Set(),
    topics: [],
    unknown: [],
    corrections: [],
    plural: /\b(sessions|hearings|meetings|schedules|committees|ordinances|resolutions|measures|bills|mga|all|lahat|what are|ano-?ano)\b/.test(folded),
  };
  for (const word of splitWords(text)) {
    const meaning = understandWord(word);
    if (meaning.kind === 'concept') parsed.concepts.add(meaning.value);
    else if (meaning.kind === 'topic') {
      if (!parsed.topics.includes(meaning.value)) parsed.topics.push(meaning.value);
      if (meaning.corrected) parsed.corrections.push(meaning.corrected);
    } else if (meaning.kind === 'number' && /^(19|20)\d{2}$/.test(meaning.value)) parsed.year = meaning.value;
    else if (meaning.kind === 'unknown') parsed.unknown.push(meaning.value);
  }
  // Ordinals ("the second one", "yung pangalawa") are only read after readings were turned into concepts.
  const ordinal = ORDINALS.find(([pattern]) => pattern.test(text));
  if (ordinal) parsed.ordinal = ordinal[1];
  return parsed;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const termMatch = (recordTerm: string, queryTerm: string) => {
  if (recordTerm === queryTerm) return 1;
  const [shorter, longer] = recordTerm.length <= queryTerm.length ? [recordTerm, queryTerm] : [queryTerm, recordTerm];
  // Prefix matches ("tricycle" ~ "tricycles", "rent" ~ "rental") only for longer, similar-length words.
  if (shorter.length >= 4 && shorter.length / longer.length >= 0.5 && longer.startsWith(shorter)) return 0.8;
  return 0;
};

const expandTopic = (topic: string): [string, number][] => [[topic, 1], ...(SYNONYMS.get(topic) ?? []).map((term): [string, number] => [term, 0.9])];

function scoreTerms(terms: Map<string, number>, topics: string[], idf?: Map<string, number>) {
  let score = 0;
  let matched = 0;
  for (const topic of topics) {
    let best = 0;
    for (const [queryTerm, queryWeight] of expandTopic(topic)) {
      for (const [recordTerm, fieldWeight] of terms) {
        const match = termMatch(recordTerm, queryTerm);
        if (match) best = Math.max(best, match * queryWeight * fieldWeight * (idf?.get(recordTerm) ?? 1));
      }
    }
    if (best > 0) {
      score += best;
      matched++;
    }
  }
  return { score, matched };
}

interface Hit {
  record: LegislativeRecord;
  score: number;
  matched: number;
}

function searchRecords(topics: string[]): Hit[] {
  if (!topics.length) return [];
  return RECORD_INDEX.map(({ record, terms }) => ({ record, ...scoreTerms(terms, topics, IDF) }))
    .filter((hit) => hit.score >= 1)
    .sort((a, b) => b.matched - a.matched || b.score - a.score);
}

function searchSessions(topics: string[]) {
  if (!topics.length) return [];
  return SESSION_INDEX.map(({ session, terms }) => ({ session, ...scoreTerms(terms, topics) }))
    .filter((hit) => hit.score >= 1)
    .sort((a, b) => b.matched - a.matched || b.score - a.score)
    .map((hit) => hit.session);
}

function searchCommittees(topics: string[]) {
  if (!topics.length) return [];
  return COMMITTEE_INDEX.map(({ committee, terms }) => ({ committee, ...scoreTerms(terms, topics) }))
    .filter((hit) => hit.score >= 1.5)
    .sort((a, b) => b.matched - a.matched || b.score - a.score)
    .map((hit) => hit.committee);
}

// A session about a record, e.g. the public hearing on the tricycle ordinance.
function sessionsFor(record: LegislativeRecord) {
  const topics = [...indexText([[record.subject ?? record.title, 1]]).keys()].filter((term) => !['public', 'hearing', 'session'].includes(term));
  return searchSessions(topics).filter((session) => session.date >= todayIso());
}

const findRecordByNumber = (text: string) => {
  const match = /\b(20\d{2})\s*-\s*(p\s*-\s*)?(\d{2,3})\b/.exec(text);
  if (!match) return undefined;
  const [, year, proposed, seq] = match;
  const wanted = `${year}-${proposed ? 'p-' : ''}${seq.padStart(3, '0')}`;
  const found =
    RECORDS.find((record) => fold(record.number).endsWith(wanted)) ??
    RECORDS.find((record) => fold(record.number).replace('-p-', '-').endsWith(`${year}-${seq.padStart(3, '0')}`));
  return { query: match[0].replace(/\s+/g, '').toUpperCase(), record: found };
};

// ---------------------------------------------------------------------------
// Wording helpers
// ---------------------------------------------------------------------------

const say = (lang: AssistantLang, en: string, fil: string) => (lang === 'FIL' ? fil : en);

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const daysFromToday = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) / 86_400_000);

const formatDate = (iso: string, lang: AssistantLang, weekday = true) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'FIL' ? 'fil-PH' : 'en-PH', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

function relativeDay(iso: string, lang: AssistantLang) {
  const days = daysFromToday(iso);
  if (days === 0) return say(lang, 'today', 'ngayong araw');
  if (days === 1) return say(lang, 'tomorrow', 'bukas');
  if (days === -1) return say(lang, 'yesterday', 'kahapon');
  if (days > 1) return say(lang, `in ${days} days`, `sa loob ng ${days} araw`);
  return say(lang, `${-days} days ago`, `${-days} araw na ang nakalipas`);
}

const STATUS_TEXT: Record<Status, { EN: string; FIL: string; meaningEN: string; meaningFIL: string }> = {
  Draft: {
    EN: 'Draft',
    FIL: 'Borador (Draft)',
    meaningEN: 'It is still being prepared and has not yet been filed for first reading.',
    meaningFIL: 'Inihahanda pa ito at hindi pa naihahain para sa unang pagbasa.',
  },
  'First Reading': {
    EN: 'First Reading',
    FIL: 'Unang Pagbasa',
    meaningEN: 'It has been filed and will be read by title in session, then referred to a committee for study.',
    meaningFIL: 'Naihain na ito at babasahin ang pamagat sa sesyon, saka ire-refer sa komite para pag-aralan.',
  },
  Committee: {
    EN: 'In Committee',
    FIL: 'Nasa Komite',
    meaningEN: 'The committee is studying it and may hold a public hearing before reporting it back to the floor for second reading.',
    meaningFIL: 'Pinag-aaralan ito ng komite, na maaaring magsagawa ng pampublikong pagdinig bago ito ibalik sa sesyon para sa ikalawang pagbasa.',
  },
  'Second Reading': {
    EN: 'Second Reading',
    FIL: 'Ikalawang Pagbasa',
    meaningEN: 'It has been debated and approved on second reading. The next step is the final vote on third reading.',
    meaningFIL: 'Napagdebatehan at naaprubahan na ito sa ikalawang pagbasa. Susunod ang huling botohan sa ikatlong pagbasa.',
  },
  'Third Reading': {
    EN: 'Third Reading',
    FIL: 'Ikatlong Pagbasa',
    meaningEN: 'It is up for final deliberation and vote on third reading, where no more amendments are allowed.',
    meaningFIL: 'Nakatakda na ito sa huling deliberasyon at botohan sa ikatlong pagbasa, kung saan wala nang susog na pinapayagan.',
  },
  Passed: {
    EN: 'Passed',
    FIL: 'Naipasa',
    meaningEN: 'The Sanggunian has approved it.',
    meaningFIL: 'Inaprubahan na ito ng Sanggunian.',
  },
  Vetoed: {
    EN: 'Vetoed',
    FIL: 'Na-veto',
    meaningEN: 'The Municipal Mayor vetoed it. The Sanggunian may override the veto by a two-thirds vote of all its members.',
    meaningFIL: 'Vineto ito ng Punong Bayan. Maaaring baligtarin ng Sanggunian ang veto sa boto ng dalawang-katlo ng lahat ng kasapi nito.',
  },
  Enacted: {
    EN: 'Enacted',
    FIL: 'Naisabatas',
    meaningEN: 'It has been enacted and approved by the Municipal Mayor.',
    meaningFIL: 'Naisabatas na ito at inaprubahan ng Punong Bayan.',
  },
};

const statusLabel = (status: Status, lang: AssistantLang) => STATUS_TEXT[status][lang];

function statusMeaning(record: LegislativeRecord, lang: AssistantLang) {
  const info = STATUS_TEXT[record.status];
  let meaning = lang === 'FIL' ? info.meaningFIL : info.meaningEN;
  if (record.status === 'Passed') {
    meaning +=
      record.classification === 'Ordinance'
        ? say(lang, ' It now goes to the Municipal Mayor, who has 10 days to approve or veto it.', ' Ipapadala ito sa Punong Bayan, na may 10 araw para aprubahan o i-veto ito.')
        : say(lang, ' A resolution takes effect once adopted.', ' May bisa na ang resolusyon kapag pinagtibay.');
  }
  return meaning;
}

const classificationWord = (record: LegislativeRecord, lang: AssistantLang) =>
  record.classification === 'Ordinance' ? say(lang, 'ordinance', 'ordinansa') : say(lang, 'resolution', 'resolusyon');

const memberPosition = (memberId: string) => mockMembers.find((member) => member.id === memberId)?.name ?? memberId;

// ---------------------------------------------------------------------------
// Conversation memory, per chat session
// ---------------------------------------------------------------------------

interface ConversationContext {
  lastRecords: LegislativeRecord[];
  lastSession: Session | null;
  lastKind: 'record' | 'session' | null;
}

const conversations = new Map<string, ConversationContext>();

const contextFor = (sessionId: string) => {
  let context = conversations.get(sessionId);
  if (!context) {
    context = { lastRecords: [], lastSession: null, lastKind: null };
    conversations.set(sessionId, context);
  }
  return context;
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

type Attribute = 'status' | 'author' | 'committee' | 'date' | 'full';

const STATUS_CONCEPTS = ['status', 'approved', 'enacted', 'pending', 'draft', 'vetoed', 'firstreading', 'secondreading', 'thirdreading', 'incommittee'];

const suggestionsFor = (lang: AssistantLang) =>
  lang === 'FIL'
    ? ['Kailan ang susunod na sesyon?', 'May ordinansa ba tungkol sa basura?', 'Ipakita ang mga nakabinbing ordinansa', 'Paano humingi ng sertipikadong kopya?']
    : ['When is the next session?', 'Is there an ordinance on garbage?', 'Show pending ordinances', 'How do I request a certified copy?'];

function greeting(lang: AssistantLang) {
  const hour = new Date().getHours();
  if (hour < 12) return say(lang, 'Good morning!', 'Magandang umaga!');
  if (hour < 18) return say(lang, 'Good afternoon!', 'Magandang hapon!');
  return say(lang, 'Good evening!', 'Magandang gabi!');
}

const capabilities = (lang: AssistantLang) =>
  say(
    lang,
    'I can help you with:\n\n- **Ordinances and resolutions**: search by topic, record number, or status\n- **Sessions and public hearings**: schedules, venue, and agenda\n- **The Sanggunian**: its composition and committees\n- **Documents**: how to request certified copies\n- **Contact details** of the SB Secretariat',
    'Matutulungan kita sa:\n\n- **Mga ordinansa at resolusyon**: hanapin ayon sa paksa, numero, o estado\n- **Mga sesyon at pampublikong pagdinig**: iskedyul, lugar, at agenda\n- **Ang Sanggunian**: mga kasapi at komite\n- **Mga dokumento**: paano humingi ng sertipikadong kopya\n- **Contact details** ng SB Secretariat'
  );

/** `exact`: the record was named (by number or as a follow-up), rather than found by searching. */
function recordAnswer(hits: Hit[], attribute: Attribute, parsed: Parsed, context: ConversationContext, exact = false): AssistantAnswer {
  const { lang } = parsed;
  const top = hits[0].record;
  const others = hits
    .slice(1)
    .filter((hit) => hit.matched === hits[0].matched && hit.score >= hits[0].score * 0.5)
    .slice(0, 3)
    .map((hit) => hit.record);
  context.lastRecords = [top, ...others];
  context.lastKind = 'record';

  const kind = classificationWord(top, lang);
  const heading = `**${top.number}**: ${top.title}`;
  const lead: string[] = [];
  switch (attribute) {
    case 'status':
      lead.push(
        say(lang, `The ${shortName(top)} ${kind} (**${top.number}**) is currently at **${statusLabel(top.status, lang)}**.`, `Ang kasalukuyang estado ng ${kind} tungkol sa ${shortName(top)} (**${top.number}**) ay **${statusLabel(top.status, lang)}**.`),
        statusMeaning(top, lang)
      );
      break;
    case 'author':
      lead.push(
        top.author
          ? say(
              lang,
              `**${top.number}** was sponsored by the **${top.author}**${top.coAuthor ? `, with the **${top.coAuthor}** as co-sponsor` : ''}.`,
              `Ang **${top.number}** ay inakda ng **${top.author}**${top.coAuthor ? `, kasama ang **${top.coAuthor}** bilang co-sponsor` : ''}.`
            )
          : say(lang, `The sponsor of **${top.number}** is not listed on LIMS.`, `Hindi nakalista sa LIMS ang may-akda ng **${top.number}**.`),
        heading
      );
      break;
    case 'committee':
      lead.push(
        top.committee
          ? say(lang, `**${top.number}** is handled by the **${top.committee}**.`, `Ang **${top.number}** ay hawak ng **${top.committee}**.`)
          : say(lang, `No committee is listed for **${top.number}**.`, `Walang nakalistang komite para sa **${top.number}**.`),
        heading
      );
      break;
    case 'date': {
      const filed = top.dateFiled ? formatDate(top.dateFiled, lang, false) : '';
      const status = statusLabel(top.status, lang);
      const approved = top.status === 'Passed' || top.status === 'Enacted';
      let answer: string;
      if (parsed.concepts.has('approved') || parsed.concepts.has('enacted')) {
        // "Kailan naipasa…?": answer with the approval date, and say so when LIMS doesn't have it.
        answer = top.publication
          ? say(lang, `**${top.number}** was approved on **${formatDate(top.publication.approvedOn, lang, false)}**.`, `Inaprubahan ang **${top.number}** noong **${formatDate(top.publication.approvedOn, lang, false)}**.`)
          : approved
            ? say(lang, `LIMS does not list the approval date of **${top.number}**. It was filed on ${filed} and is now **${status}**.`, `Hindi nakalista sa LIMS ang petsa ng pag-apruba ng **${top.number}**. Inihain ito noong ${filed} at ngayon ay **${status}** na.`)
            : say(lang, `**${top.number}** has not been approved yet. It was filed on ${filed} and is at **${status}**.`, `Hindi pa naaaprubahan ang **${top.number}**. Inihain ito noong ${filed} at nasa **${status}** pa.`);
      } else {
        answer = filed
          ? say(lang, `**${top.number}** was filed on **${filed}**.`, `Inihain ang **${top.number}** noong **${filed}**.`)
          : top.publication
            ? say(lang, `**${top.number}** was approved on **${formatDate(top.publication.approvedOn, lang, false)}**.`, `Inaprubahan ang **${top.number}** noong **${formatDate(top.publication.approvedOn, lang, false)}**.`)
            : say(lang, `The filing date of **${top.number}** is not listed on LIMS.`, `Hindi nakalista sa LIMS ang petsa ng paghain ng **${top.number}**.`);
      }
      lead.push(answer, heading);
      break;
    }
    default:
      lead.push(exact ? say(lang, `Here are the details of ${heading}.`, `Narito ang detalye ng ${heading}.`) : say(lang, `The closest match is ${heading}.`, `Ang pinakamalapit na tugma ay ${heading}.`));
      if (top.description) lead.push(top.description);
  }

  const details = [
    `- **${say(lang, 'Status', 'Estado')}:** ${statusLabel(top.status, lang)}`,
    top.committee && attribute !== 'committee' ? `- **${say(lang, 'Committee', 'Komite')}:** ${top.committee}` : '',
    top.author && attribute !== 'author' ? `- **${say(lang, 'Sponsor', 'May-akda')}:** ${top.author}${top.coAuthor ? ` · ${top.coAuthor}` : ''}` : '',
    top.dateFiled && attribute !== 'date' ? `- **${say(lang, 'Filed', 'Inihain')}:** ${formatDate(top.dateFiled, lang, false)}` : '',
    top.actionTaken ? `- **${say(lang, 'Latest action', 'Huling aksyon')}:** ${top.actionTaken}` : '',
  ].filter(Boolean);

  const notes: string[] = [];
  if (attribute === 'full' && top.status !== 'Enacted') notes.push(statusMeaning(top, lang));
  const publication = top.publication;
  if (publication) {
    notes.push(
      publication.postedOn
        ? say(
            lang,
            `It was approved on ${formatDate(publication.approvedOn, lang, false)} and posted in ${publication.placesPosted} public places on ${formatDate(publication.postedOn, lang, false)}. Ordinances generally take effect 10 days after posting, unless the ordinance states otherwise.`,
            `Inaprubahan ito noong ${formatDate(publication.approvedOn, lang, false)} at ipinaskil sa ${publication.placesPosted} pampublikong lugar noong ${formatDate(publication.postedOn, lang, false)}. Karaniwang nagkakabisa ang ordinansa 10 araw matapos maipaskil, maliban kung iba ang itinakda nito.`
          )
        : say(
            lang,
            `It was approved on ${formatDate(publication.approvedOn, lang, false)} and is awaiting posting in public places before it takes effect.`,
            `Inaprubahan ito noong ${formatDate(publication.approvedOn, lang, false)} at hinihintay pang maipaskil sa mga pampublikong lugar bago magkabisa.`
          )
    );
  }
  const related = sessionsFor(top)[0];
  if (related) {
    notes.push(
      say(
        lang,
        `📅 **${related.title}** is scheduled on ${formatDate(related.date, lang)} (${relativeDay(related.date, lang)}), ${related.time}, at the ${related.location}.`,
        `📅 Nakatakda ang **${related.title}** sa ${formatDate(related.date, lang)} (${relativeDay(related.date, lang)}), ${related.time}, sa ${related.location}.`
      )
    );
  }

  const parts = [lead.join('\n\n'), details.join('\n'), ...notes];
  if (others.length) {
    parts.push(say(lang, 'Possibly related:', 'Maaaring may kaugnayan din:'), others.map((r) => `- **${r.number}**: ${r.title}`).join('\n'));
  }
  if (parsed.corrections.length) {
    parts.push(say(lang, `_Searched for: ${parsed.corrections.join(', ')}_`, `_Hinanap bilang: ${parsed.corrections.join(', ')}_`));
  }

  const followUps = [
    attribute !== 'author' && top.author ? say(lang, 'Who sponsored it?', 'Sino ang may-akda nito?') : '',
    related ? say(lang, 'When is the hearing?', 'Kailan ang pagdinig?') : '',
    say(lang, 'How do I request a certified copy?', 'Paano humingi ng sertipikadong kopya?'),
    others[0] ? say(lang, `Tell me more about ${others[0].number}`, `Detalye ng ${others[0].number}`) : '',
  ].filter(Boolean);

  return {
    progress: [say(lang, 'Searching ordinances and resolutions', 'Hinahanap sa mga ordinansa at resolusyon'), say(lang, `Reading ${top.number}`, `Binabasa ang ${top.number}`)],
    text: parts.join('\n\n'),
    sources: [top.number, ...others.map((r) => r.number)],
    followUps: followUps.slice(0, 3),
  };
}

function recordListAnswer(records: LegislativeRecord[], header: string, parsed: Parsed, context: ConversationContext): AssistantAnswer {
  const { lang } = parsed;
  const shown = records.slice(0, 6);
  context.lastRecords = shown;
  context.lastKind = 'record';
  const lines = shown.map((record) => `- **${record.number}**: ${shortName(record)} (${statusLabel(record.status, lang)})`);
  const more = records.length > shown.length ? say(lang, `…and ${records.length - shown.length} more.`, `…at ${records.length - shown.length} pa.`) : '';
  return {
    progress: [say(lang, 'Searching ordinances and resolutions', 'Hinahanap sa mga ordinansa at resolusyon')],
    text: [header, lines.join('\n'), more, say(lang, 'Ask me about any of these for the details.', 'Magtanong tungkol sa alinman dito para sa detalye.')].filter(Boolean).join('\n\n'),
    sources: shown.map((record) => record.number),
    followUps: [
      say(lang, 'Tell me more about the first one', 'Detalye ng una'),
      shown[1] ? say(lang, 'What about the second one?', 'Paano ang pangalawa?') : '',
      say(lang, 'How do I request a certified copy?', 'Paano humingi ng sertipikadong kopya?'),
    ].filter(Boolean),
  };
}

interface Filters {
  classification?: 'Ordinance' | 'Resolution';
  statuses?: Status[];
  year?: string;
}

const PENDING_STATUSES: Status[] = ['Draft', 'First Reading', 'Committee', 'Second Reading', 'Third Reading'];

function readFilters(parsed: Parsed): Filters {
  const has = (concept: string) => parsed.concepts.has(concept);
  const filters: Filters = {};
  if (has('ordinance') !== has('resolution')) filters.classification = has('ordinance') ? 'Ordinance' : 'Resolution';
  const statuses = new Set<Status>();
  if (has('pending')) PENDING_STATUSES.forEach((status) => statuses.add(status));
  if (has('approved')) ['Passed', 'Enacted'].forEach((status) => statuses.add(status as Status));
  if (has('enacted')) statuses.add('Enacted');
  if (has('draft')) statuses.add('Draft');
  if (has('vetoed')) statuses.add('Vetoed');
  if (has('firstreading')) statuses.add('First Reading');
  if (has('secondreading')) statuses.add('Second Reading');
  if (has('thirdreading')) statuses.add('Third Reading');
  if (has('incommittee')) statuses.add('Committee');
  if (statuses.size) filters.statuses = [...statuses];
  if (parsed.year) filters.year = parsed.year;
  else if (has('thisyear')) filters.year = todayIso().slice(0, 4);
  return filters;
}

const applyFilters = (records: LegislativeRecord[], filters: Filters) =>
  records.filter(
    (record) =>
      (!filters.classification || record.classification === filters.classification) &&
      (!filters.statuses || filters.statuses.includes(record.status)) &&
      (!filters.year || recordDate(record).startsWith(filters.year))
  );

function describeFilters(filters: Filters, lang: AssistantLang) {
  const statuses = filters.statuses ?? [];
  const statusWord =
    statuses.length === PENDING_STATUSES.length
      ? say(lang, 'pending', 'nakabinbing')
      : statuses.length === 2 && statuses.includes('Passed') && statuses.includes('Enacted')
        ? say(lang, 'approved', 'naaprubahang')
        : statuses.length === 1
          ? say(lang, statusLabel(statuses[0], 'EN').toLowerCase(), `${statusLabel(statuses[0], 'FIL').toLowerCase()} na`)
          : '';
  const kind =
    filters.classification === 'Ordinance'
      ? say(lang, 'ordinances', 'ordinansa')
      : filters.classification === 'Resolution'
        ? say(lang, 'resolutions', 'resolusyon')
        : say(lang, 'measures', 'panukala');
  const year = filters.year ? say(lang, ` from ${filters.year}`, ` noong ${filters.year}`) : '';
  return say(lang, `${statusWord} ${kind}${year}`.trim(), `mga ${statusWord} ${kind}${year}`.replace(/\s+/g, ' ').trim());
}

function sessionDetails(session: Session, lang: AssistantLang) {
  return [
    `**${session.title}** (${session.type})`,
    [
      `- **${say(lang, 'Date', 'Petsa')}:** ${formatDate(session.date, lang)} (${relativeDay(session.date, lang)})`,
      `- **${say(lang, 'Time', 'Oras')}:** ${session.time}`,
      `- **${say(lang, 'Venue', 'Lugar')}:** ${session.location}`,
    ].join('\n'),
  ].join('\n\n');
}

const attendNote = (lang: AssistantLang) =>
  say(
    lang,
    'Sessions and public hearings are open to the public. To speak at a public hearing, coordinate with the SB Secretariat ahead of time; written position papers may be submitted before the hearing.',
    'Bukas sa publiko ang mga sesyon at pampublikong pagdinig. Para makapagsalita sa pagdinig, makipag-ugnayan muna sa SB Secretariat; maaari ring magsumite ng position paper bago ang pagdinig.'
  );

function sessionAnswer(parsed: Parsed, context: ConversationContext, focusSession?: Session | null): AssistantAnswer {
  const { lang } = parsed;
  const has = (...concepts: string[]) => concepts.some((concept) => parsed.concepts.has(concept));
  const progress = [say(lang, 'Checking the session calendar', 'Tinitingnan ang kalendaryo ng sesyon')];
  const followUps = (session: Session) =>
    [
      !has('agenda') && session.type !== 'Committee Hearing' ? say(lang, 'What is on the agenda?', 'Ano ang agenda?') : '',
      !has('agenda') && session.type === 'Committee Hearing' ? say(lang, 'What will be discussed?', 'Ano ang tatalakayin?') : '',
      !has('attend') ? say(lang, 'Can I attend?', 'Puwede ba akong dumalo?') : '',
      say(lang, 'Show all upcoming sessions', 'Ipakita lahat ng paparating na sesyon'),
    ].filter(Boolean);

  // The most recent session held.
  if (has('last') && !focusSession) {
    const wantSpecial = has('special');
    const past = mockAttendanceSessions
      .filter((session) => session.date < todayIso() && (!wantSpecial || session.type === 'Special'))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (past) {
      const title = past.type === 'Special' ? past.label : `${past.label} Session`;
      return {
        progress,
        text: say(
          lang,
          `The most recent session was the **${title}** on ${formatDate(past.date, lang)} (${relativeDay(past.date, lang)}). Its minutes are taken up for approval at the next regular session.`,
          `Ang pinakahuling sesyon ay ang **${title}** noong ${formatDate(past.date, lang)} (${relativeDay(past.date, lang)}). Ang katitikan nito ay aaprubahan sa susunod na regular na sesyon.`
        ),
        sources: ['Attendance Register'],
        followUps: [say(lang, 'When is the next session?', 'Kailan ang susunod na sesyon?')],
      };
    }
  }

  const upcoming = PUBLIC_SESSIONS.filter((session) => session.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date));
  const ofType = has('special')
    ? upcoming.filter((s) => s.type === 'Special')
    : has('hearing')
      ? upcoming.filter((s) => s.type === 'Committee Hearing')
      : has('regular')
        ? upcoming.filter((s) => s.type === 'Regular')
        : upcoming;
  let sessions = ofType;
  let topicMatched = false;
  if (focusSession) sessions = [focusSession];
  else {
    const within = (days: number) => sessions.filter((s) => daysFromToday(s.date) <= days);
    if (has('today')) sessions = sessions.filter((s) => daysFromToday(s.date) === 0);
    else if (has('tomorrow')) sessions = sessions.filter((s) => daysFromToday(s.date) === 1);
    else if (has('thisweek')) sessions = within(7 - new Date().getDay());
    else if (has('nextweek')) sessions = sessions.filter((s) => daysFromToday(s.date) > 7 - new Date().getDay() && daysFromToday(s.date) <= 14 - new Date().getDay());
    else if (has('thismonth')) sessions = sessions.filter((s) => s.date.slice(0, 7) === todayIso().slice(0, 7));
    if (parsed.topics.length) {
      const matching = searchSessions(parsed.topics).filter((s) => sessions.includes(s));
      if (matching.length) {
        sessions = matching;
        topicMatched = true;
      }
    }
  }

  if (!sessions.length) {
    // Nothing in that period: offer the next one of the kind asked about ("special session this month?").
    const next = ofType[0] ?? upcoming[0];
    return {
      progress,
      text: [
        say(lang, 'There is no session scheduled for that on the calendar.', 'Walang nakatakdang sesyon para diyan sa kalendaryo.'),
        next ? say(lang, `The next scheduled one is:`, `Ang susunod na nakatakda ay:`) : '',
        next ? sessionDetails(next, lang) : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      sources: ['Session Calendar'],
      followUps: [say(lang, 'Show all upcoming sessions', 'Ipakita lahat ng paparating na sesyon')],
    };
  }

  const single =
    focusSession || sessions.length === 1 || topicMatched || has('next', 'agenda') || (has('when', 'where', 'time') && !parsed.plural);
  if (single && !has('list', 'schedule')) {
    const session = sessions[0];
    context.lastSession = session;
    context.lastKind = 'session';
    const parts: string[] = [];
    if (has('where') && !has('when', 'time', 'agenda')) {
      parts.push(say(lang, `It will be held at the **${session.location}**.`, `Gaganapin ito sa **${session.location}**.`));
    } else if (has('time') && !has('agenda')) {
      parts.push(say(lang, `It starts at **${session.time}**.`, `Magsisimula ito ng **${session.time}**.`));
    }
    parts.push(sessionDetails(session, lang));
    if (has('agenda')) {
      parts.push(say(lang, 'Order of business:', 'Pagkakasunod-sunod ng usapin:'), buildAgenda(session).map((item) => `- ${item}`).join('\n'));
    }
    if (has('attend') || (session.type === 'Committee Hearing' && !focusSession)) parts.push(attendNote(lang));
    return { progress, text: parts.join('\n\n'), sources: ['Session Calendar'], followUps: followUps(session).slice(0, 3) };
  }

  context.lastSession = sessions[0];
  context.lastKind = 'session';
  return {
    progress,
    text: [
      say(lang, 'Here are the scheduled sessions and hearings:', 'Narito ang mga nakatakdang sesyon at pagdinig:'),
      sessions.map((s) => `- **${s.title}** (${s.type}): ${formatDate(s.date, lang)} (${relativeDay(s.date, lang)}), ${s.time}`).join('\n'),
      say(lang, `All are held at the ${LGU_PROFILE.sessionHall}.`, `Lahat ay gaganapin sa ${LGU_PROFILE.sessionHall}.`),
      attendNote(lang),
    ].join('\n\n'),
    sources: ['Session Calendar'],
    followUps: [say(lang, 'What is on the agenda of the next session?', 'Ano ang agenda ng susunod na sesyon?'), say(lang, 'Can I attend?', 'Puwede ba akong dumalo?')],
  };
}

function committeeLines(committee: Committee, lang: AssistantLang) {
  const assignment = mockCommitteeAssignments[committee.id];
  const hearings = mockCommitteeHearings.find((h) => committee.name.endsWith(h.committee));
  const measures = RECORDS.filter((record) => record.committee === committee.name);
  return [
    `**${committee.name}**`,
    [
      assignment ? `- **${say(lang, 'Chair', 'Tagapangulo')}:** ${memberPosition(assignment.chair)}` : '',
      assignment ? `- **${say(lang, 'Vice Chair', 'Pangalawang Tagapangulo')}:** ${memberPosition(assignment.viceChair)}` : '',
      assignment ? `- **${say(lang, 'Members', 'Mga Kasapi')}:** ${assignment.members.map(memberPosition).join(', ')}` : '',
      hearings ? `- **${say(lang, 'Hearings this year', 'Mga pagdinig ngayong taon')}:** ${hearings.monthly.reduce((sum, n) => sum + n, 0)}` : '',
      ...measures.map((record) => `- ${record.number}: ${shortName(record)} (${statusLabel(record.status, lang)})`),
    ]
      .filter(Boolean)
      .join('\n'),
  ].join('\n\n');
}

function committeeAnswer(parsed: Parsed): AssistantAnswer {
  const { lang } = parsed;
  const matches = searchCommittees(parsed.topics).slice(0, 2);
  if (matches.length) {
    return {
      progress: [say(lang, 'Checking committee assignments', 'Tinitingnan ang mga komite')],
      text: [say(lang, 'This is handled by:', 'Ito ay hawak ng:'), ...matches.map((committee) => committeeLines(committee, lang))].join('\n\n'),
      sources: ['Committee Assignments'],
      followUps: [say(lang, 'List all committees', 'Ipakita lahat ng komite'), say(lang, 'What does a committee do?', 'Ano ang ginagawa ng komite?')],
    };
  }
  return {
    progress: [say(lang, 'Checking committee assignments', 'Tinitingnan ang mga komite')],
    text: [
      say(lang, `The Sanggunian has **${mockCommittees.length} standing committees**:`, `May **${mockCommittees.length} na standing committee** ang Sanggunian:`),
      mockCommittees
        .map((c) => {
          const assignment = mockCommitteeAssignments[c.id];
          return `- **${c.name.replace(/^Committee on /, '')}**${assignment ? `: ${say(lang, 'chaired by the', 'pinamumunuan ng')} ${memberPosition(assignment.chair)}` : ''}`;
        })
        .join('\n'),
      say(lang, 'Ask me about a specific committee, e.g. "Which committee handles tricycles?"', 'Magtanong tungkol sa isang komite, hal. "Anong komite ang may hawak sa traysikel?"'),
    ].join('\n\n'),
    sources: ['Committee Assignments'],
    followUps: [say(lang, 'Which committee handles health?', 'Anong komite ang para sa kalusugan?'), say(lang, 'What does a committee do?', 'Ano ang ginagawa ng komite?')],
  };
}

function membersAnswer(parsed: Parsed): AssistantAnswer {
  const { lang } = parsed;
  const has = (...concepts: string[]) => concepts.some((concept) => parsed.concepts.has(concept));
  const progress = [say(lang, 'Checking the Sanggunian composition', 'Tinitingnan ang komposisyon ng Sanggunian')];
  const chairs = (memberId: string) =>
    Object.entries(mockCommitteeAssignments)
      .filter(([, assignment]) => assignment.chair === memberId)
      .map(([id]) => mockCommittees.find((c) => c.id === id)?.name)
      .filter(Boolean);
  const seats = (memberId: string) =>
    Object.entries(mockCommitteeAssignments)
      .filter(([, a]) => a.viceChair === memberId || a.members.includes(memberId))
      .map(([id]) => mockCommittees.find((c) => c.id === id)?.name.replace(/^Committee on /, ''))
      .filter(Boolean);
  const exOfficio = (memberId: string, en: string, fil: string) => {
    const committees = seats(memberId);
    return [say(lang, en, fil), committees.length ? say(lang, `They sit on the committees on ${committees.join('; ')}.`, `Kasapi sila ng mga komite sa ${committees.join('; ')}.`) : ''].filter(Boolean).join(' ');
  };

  let text: string;
  if (has('vicemayor', 'presiding')) {
    text = say(
      lang,
      'The **Municipal Vice Mayor** is the **Presiding Officer** of the Sangguniang Bayan. They preside over sessions, sign the ordinances and resolutions passed, and vote only to break a tie.',
      'Ang **Pangalawang Punong Bayan (Vice Mayor)** ang **Presiding Officer** ng Sangguniang Bayan. Pinamumunuan nila ang mga sesyon, pinipirmahan ang mga naipasang ordinansa at resolusyon, at bumoboto lamang kapag tabla.'
    );
  } else if (has('mayor')) {
    text = say(
      lang,
      'The **Municipal Mayor** heads the executive branch and is not a member of the Sanggunian. Ordinances passed by the Sanggunian go to the Mayor, who has **10 days** to approve or veto them; if the Mayor does not act, the ordinance is deemed approved. A veto can be overridden by two-thirds of all Sanggunian members.',
      'Ang **Punong Bayan (Mayor)** ang namumuno sa sangay ehekutibo at hindi kasapi ng Sanggunian. Ipinapadala sa Punong Bayan ang mga naipasang ordinansa, at may **10 araw** siya para aprubahan o i-veto ang mga ito; kung walang aksyon, ituturing itong aprubado. Maaaring baligtarin ang veto sa boto ng dalawang-katlo ng lahat ng kasapi ng Sanggunian.'
    );
  } else if (has('ipmr')) {
    text = exOfficio('m10', 'The **IPMR** (Indigenous Peoples Mandatory Representative) represents indigenous communities in the Sanggunian as an ex-officio member.', 'Ang **IPMR** (Indigenous Peoples Mandatory Representative) ang kinatawan ng mga katutubo sa Sanggunian bilang ex-officio na kasapi.');
  } else if (has('abc')) {
    text = exOfficio('m11', 'The **ABC President** (Liga ng mga Barangay) represents the barangays in the Sanggunian as an ex-officio member.', 'Ang **ABC President** (Liga ng mga Barangay) ang kinatawan ng mga barangay sa Sanggunian bilang ex-officio na kasapi.');
  } else if (has('sk')) {
    text = exOfficio('m12', 'The **SK Federation President** represents the youth (Sangguniang Kabataan) in the Sanggunian as an ex-officio member.', 'Ang **SK Federation President** ang kinatawan ng kabataan (Sangguniang Kabataan) sa Sanggunian bilang ex-officio na kasapi.');
  } else {
    const councilors = mockMembers.filter((m) => m.seat === 'At-large');
    const ex = mockMembers.filter((m) => m.seat === 'Ex-officio');
    const chairLines = councilors
      .map((m) => ({ member: m, committees: chairs(m.id) }))
      .filter((entry) => entry.committees.length)
      .map((entry) => `- **${entry.member.name}**: ${entry.committees.map((name) => name!.replace(/^Committee on /, '')).join('; ')}`);
    text = [
      say(lang, `The Sangguniang Bayan has **${mockMembers.length} members**:`, `May **${mockMembers.length} na kasapi** ang Sangguniang Bayan:`),
      [
        `- **${say(lang, 'Presiding Officer', 'Presiding Officer')}:** ${say(lang, 'Municipal Vice Mayor', 'Pangalawang Punong Bayan (Vice Mayor)')}`,
        `- **${councilors.length} ${say(lang, 'Municipal Councilors', 'Konsehal')}** ${say(lang, '(elected at large)', '(inihalal ng buong bayan)')}`,
        `- **${ex.length} ${say(lang, 'ex-officio members', 'ex-officio na kasapi')}:** ${ex.map((m) => m.name).join(', ')}`,
      ].join('\n'),
      say(lang, 'Committee chairs:', 'Mga tagapangulo ng komite:'),
      chairLines.join('\n'),
      say(lang, 'LIMS identifies officials by position. For the names of current officials, please contact the SB Secretariat.', 'Kinikilala ng LIMS ang mga opisyal ayon sa posisyon. Para sa pangalan ng kasalukuyang mga opisyal, makipag-ugnayan sa SB Secretariat.'),
    ].join('\n\n');
  }
  return {
    progress,
    text,
    sources: ['SB Composition'],
    followUps: [
      say(lang, 'List all committees', 'Ipakita lahat ng komite'),
      has('vicemayor', 'presiding') ? '' : say(lang, 'What does the Vice Mayor do?', 'Ano ang papel ng Vice Mayor?'),
      say(lang, 'How does an ordinance become law?', 'Paano naipapasa ang ordinansa?'),
    ].filter(Boolean),
  };
}

function contactAnswer(lang: AssistantLang): AssistantAnswer {
  return {
    progress: [say(lang, 'Retrieving contact information', 'Kinukuha ang contact information')],
    text: [
      say(lang, 'You can reach the SB Secretariat here:', 'Maaari mong kontakin ang SB Secretariat dito:'),
      [`- **${say(lang, 'Office', 'Opisina')}:** ${LGU_PROFILE.address}`, `- **Email:** ${LGU_PROFILE.email}`, `- **Viber:** ${LGU_PROFILE.viber}`].join('\n'),
      say(lang, 'For copies of records, you can also use the **Request a Document** button at the top of this page.', 'Para sa kopya ng mga rekord, maaari ring gamitin ang **Humiling ng Dokumento** sa itaas ng pahinang ito.'),
    ].join('\n\n'),
    sources: ['LGU Profile'],
    followUps: [say(lang, 'How do I request a certified copy?', 'Paano humingi ng sertipikadong kopya?'), say(lang, 'When is the next session?', 'Kailan ang susunod na sesyon?')],
  };
}

function requestAnswer(lang: AssistantLang, record: LegislativeRecord | undefined, foi: boolean): AssistantAnswer {
  const steps = say(
    lang,
    `1. Click **Request a Document** at the top of this page.\n2. Enter your name, email address, and the ${record ? `record number (**${record.number}**)` : 'record number or title'}.\n3. Submit the request. The Office of the Secretary to the Sanggunian will send updates to your email.`,
    `1. I-click ang **Humiling ng Dokumento** sa itaas ng pahinang ito.\n2. Ilagay ang iyong pangalan, email address, at ang ${record ? `numero ng rekord (**${record.number}**)` : 'numero o pamagat ng rekord'}.\n3. Isumite ang kahilingan. Magpapadala ng update sa iyong email ang Tanggapan ng Kalihim ng Sanggunian.`
  );
  return {
    progress: [say(lang, 'Checking the document request process', 'Tinitingnan ang proseso ng paghingi ng dokumento')],
    text: [
      say(lang, 'To request a certified true copy of a legislative record:', 'Para humingi ng sertipikadong kopya ng isang rekord:'),
      steps,
      say(
        lang,
        'Copies downloaded or printed from LIMS are marked "Public Copy" and are not certified true copies.',
        'Ang mga kopyang na-download o na-print mula sa LIMS ay may markang "Public Copy" at hindi sertipikadong kopya.'
      ),
      foi
        ? say(lang, 'You may also file a Freedom of Information (FOI) request online at **foi.gov.ph**.', 'Maaari ka ring maghain ng Freedom of Information (FOI) request online sa **foi.gov.ph**.')
        : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    sources: record ? [record.number, 'Document Requests'] : ['Document Requests'],
    followUps: [say(lang, 'How do I contact the SB Secretariat?', 'Paano makipag-ugnayan sa SB Secretariat?')],
  };
}

const GLOSSARY: Record<string, { EN: string; FIL: string }> = {
  ordinance: {
    EN: "An **ordinance** is a local law passed by the Sanggunian. It has general and lasting effect, can impose fees or penalties, and needs the Municipal Mayor's approval to take effect.",
    FIL: 'Ang **ordinansa** ay lokal na batas na ipinapasa ng Sanggunian. Pangkalahatan at pangmatagalan ang bisa nito, maaaring magpataw ng bayarin o multa, at kailangan ng pag-apruba ng Punong Bayan bago magkabisa.',
  },
  resolution: {
    EN: "A **resolution** states the Sanggunian's position or decision on a specific matter, such as endorsing a project, requesting help from another agency, or authorizing the Mayor to sign an agreement. It does not create a local law.",
    FIL: 'Ang **resolusyon** ay nagpapahayag ng posisyon o desisyon ng Sanggunian sa isang partikular na usapin, gaya ng pag-endorso ng proyekto, paghingi ng tulong sa ibang ahensya, o pagbibigay-awtoridad sa Punong Bayan na pumirma ng kasunduan. Hindi ito lumilikha ng lokal na batas.',
  },
  firstreading: {
    EN: 'On **first reading**, the proposed measure is read by its number and title during session and referred to the proper committee.',
    FIL: 'Sa **unang pagbasa**, binabasa ang numero at pamagat ng panukala sa sesyon at ire-refer ito sa angkop na komite.',
  },
  secondreading: {
    EN: 'On **second reading**, the committee report is presented, and the full text of the measure is debated and may be amended on the floor.',
    FIL: 'Sa **ikalawang pagbasa**, inilalahad ang ulat ng komite, at pinagdedebatehan at maaaring susugan ang buong teksto ng panukala.',
  },
  thirdreading: {
    EN: 'On **third reading**, the final version is put to a vote and no more amendments are allowed. An approved ordinance is then sent to the Mayor.',
    FIL: 'Sa **ikatlong pagbasa**, binobotohan ang huling bersyon at wala nang susog na pinapayagan. Ang naaprubahang ordinansa ay ipinapadala sa Punong Bayan.',
  },
  committee: {
    EN: 'A **committee** studies the measures referred to it, may hold public hearings, and submits a committee report recommending approval, amendment, or rejection.',
    FIL: 'Pinag-aaralan ng **komite** ang mga panukalang ini-refer dito, maaaring magsagawa ng pampublikong pagdinig, at nagsusumite ng ulat na nagrerekomenda ng pag-apruba, pagsusog, o pagtanggi.',
  },
  hearing: {
    EN: 'A **public hearing** is a consultation held by a committee where residents and stakeholders can give comments or submit position papers on a proposed measure.',
    FIL: 'Ang **pampublikong pagdinig** ay konsultasyong isinasagawa ng komite kung saan maaaring magbigay ng puna o magsumite ng position paper ang mga residente at stakeholder tungkol sa panukala.',
  },
  vetoed: {
    EN: "A **veto** is the Mayor's written rejection of an ordinance, with reasons. The Sanggunian can override it by a two-thirds vote of all its members.",
    FIL: 'Ang **veto** ay ang nakasulat na pagtanggi ng Punong Bayan sa isang ordinansa, kasama ang dahilan. Maaari itong baligtarin ng Sanggunian sa boto ng dalawang-katlo ng lahat ng kasapi.',
  },
  enacted: {
    EN: 'An ordinance is **enacted** once approved by the Sanggunian and the Mayor, or when the Mayor does not act on it within 10 days. It generally takes effect 10 days after being posted in public places, unless it states otherwise.',
    FIL: 'Ang ordinansa ay **naisabatas** kapag inaprubahan ng Sanggunian at ng Punong Bayan, o kung walang aksyon ang Punong Bayan sa loob ng 10 araw. Karaniwan itong nagkakabisa 10 araw matapos maipaskil sa mga pampublikong lugar, maliban kung iba ang itinakda nito.',
  },
  quorum: {
    EN: 'A **quorum** is a majority of all Sanggunian members, the minimum needed to hold a session and conduct business.',
    FIL: 'Ang **quorum** ay ang mayorya ng lahat ng kasapi ng Sanggunian, ang pinakamababang bilang na kailangan para makapagsesyon.',
  },
  sanggunian: {
    EN: 'The **Sangguniang Bayan (SB)** is the municipal legislative body. It is presided over by the Vice Mayor and made up of 8 elected councilors and 3 ex-officio members (IPMR, ABC President, SK Federation President).',
    FIL: 'Ang **Sangguniang Bayan (SB)** ang lehislatibong sangay ng bayan. Pinamumunuan ito ng Vice Mayor at binubuo ng 8 inihalal na konsehal at 3 ex-officio na kasapi (IPMR, ABC President, SK Federation President).',
  },
  copy: {
    EN: 'A **certified true copy** is an official copy of a record certified by the Secretary to the Sanggunian. Copies downloaded from LIMS are marked "Public Copy" and are not certified.',
    FIL: 'Ang **sertipikadong kopya** ay opisyal na kopya ng rekord na pinatunayan ng Kalihim ng Sanggunian. Ang mga kopyang na-download mula sa LIMS ay may markang "Public Copy" at hindi sertipikado.',
  },
  foi: {
    EN: '**Freedom of Information (FOI)** lets the public request government records. You can file online at foi.gov.ph, or request legislative records here through **Request a Document**.',
    FIL: 'Sa **Freedom of Information (FOI)**, maaaring humingi ang publiko ng mga rekord ng pamahalaan. Maaaring maghain online sa foi.gov.ph, o humingi ng rekord dito sa **Humiling ng Dokumento**.',
  },
};

function glossaryAnswer(terms: string[], lang: AssistantLang): AssistantAnswer {
  const text = terms.map((term) => GLOSSARY[term][lang]).join('\n\n');
  return {
    progress: [say(lang, 'Looking up the term', 'Hinahanap ang kahulugan')],
    text,
    sources: ['Local Government Code (RA 7160)'],
    followUps: [say(lang, 'How does an ordinance become law?', 'Paano naipapasa ang ordinansa?'), say(lang, 'Show pending ordinances', 'Ipakita ang mga nakabinbing ordinansa')],
  };
}

function processAnswer(lang: AssistantLang): AssistantAnswer {
  return {
    progress: [say(lang, 'Explaining the legislative process', 'Ipinapaliwanag ang proseso')],
    text: [
      say(lang, 'This is how a proposed ordinance becomes law:', 'Ganito naipapasa ang isang panukalang ordinansa:'),
      say(
        lang,
        '1. **Filing**: a Sanggunian member files the proposed measure with the Secretariat.\n2. **First reading**: it is read by title in session and referred to a committee.\n3. **Committee study**: the committee studies it and may hold a public hearing, then submits its report.\n4. **Second reading**: the measure is debated and may be amended.\n5. **Third reading**: the final version is put to a vote.\n6. **Mayor\'s action**: the Mayor has 10 days to approve or veto it. A veto can be overridden by two-thirds of all members.\n7. **Posting and effectivity**: the ordinance is posted in public places and generally takes effect 10 days later.',
        '1. **Paghahain**: naghahain ang isang kasapi ng Sanggunian ng panukala sa Secretariat.\n2. **Unang pagbasa**: binabasa ang pamagat sa sesyon at ini-refer sa komite.\n3. **Pag-aaral ng komite**: pinag-aaralan ito ng komite, maaaring magsagawa ng pampublikong pagdinig, at nagsusumite ng ulat.\n4. **Ikalawang pagbasa**: pinagdedebatehan at maaaring susugan ang panukala.\n5. **Ikatlong pagbasa**: binobotohan ang huling bersyon.\n6. **Aksyon ng Punong Bayan**: may 10 araw ang Punong Bayan para aprubahan o i-veto ito. Maaaring baligtarin ang veto ng dalawang-katlo ng lahat ng kasapi.\n7. **Pagpapaskil at pagkakabisa**: ipinapaskil ang ordinansa sa mga pampublikong lugar at karaniwang nagkakabisa pagkalipas ng 10 araw.'
      ),
      say(lang, 'Resolutions follow a shorter path and take effect once adopted by the Sanggunian.', 'Mas maikli ang proseso ng resolusyon at may bisa na ito kapag pinagtibay ng Sanggunian.'),
    ].join('\n\n'),
    sources: ['Local Government Code (RA 7160)'],
    followUps: [say(lang, 'Show pending ordinances', 'Ipakita ang mga nakabinbing ordinansa'), say(lang, 'What is a public hearing?', 'Ano ang pampublikong pagdinig?')],
  };
}

function statsAnswer(parsed: Parsed, filters: Filters): AssistantAnswer {
  const { lang } = parsed;
  const has = (concept: string) => parsed.concepts.has(concept);
  const year = filters.year ?? mockYearlyActivity[mockYearlyActivity.length - 1].year;
  const stats = mockYearlyActivity.find((entry) => entry.year === year);
  const progress = [say(lang, 'Checking legislative statistics', 'Tinitingnan ang estadistika')];
  if (!stats) {
    return {
      progress,
      text: say(lang, `I only have statistics for ${mockYearlyActivity.map((e) => e.year).join(', ')}.`, `Mayroon lamang akong estadistika para sa ${mockYearlyActivity.map((e) => e.year).join(', ')}.`),
      sources: ['Legislative Statistics'],
      followUps: [],
    };
  }
  const isCurrentYear = year === todayIso().slice(0, 4);
  const label = isCurrentYear ? say(lang, `${year} (year to date)`, `${year} (hanggang ngayon)`) : year;

  if (has('quorum') || has('attendance')) {
    const marks = Object.values(mockAttendanceMarks).join('');
    const present = [...marks].filter((mark) => mark !== 'A').length;
    return {
      progress,
      text: [
        say(lang, `In **${label}**, the Sanggunian had a **${stats.quorumRate}% quorum rate**, holding ${stats.sessionsHeld} of ${stats.sessionsPlanned} planned sessions.`, `Noong **${label}**, may **${stats.quorumRate}% quorum rate** ang Sanggunian, at nakapagsagawa ng ${stats.sessionsHeld} sa ${stats.sessionsPlanned} na nakaplanong sesyon.`),
        say(lang, `Across the last ${mockAttendanceSessions.length} sessions, members were present **${Math.round((present / marks.length) * 100)}%** of the time.`, `Sa huling ${mockAttendanceSessions.length} na sesyon, **${Math.round((present / marks.length) * 100)}%** ang pagdalo ng mga kasapi.`),
      ].join('\n\n'),
      sources: ['Legislative Statistics', 'Attendance Register'],
      followUps: [say(lang, 'When is the next session?', 'Kailan ang susunod na sesyon?')],
    };
  }

  const onPortal = applyFilters(RECORDS, { classification: filters.classification });
  const pending = onPortal.filter((r) => PENDING_STATUSES.includes(r.status)).length;
  const approved = onPortal.filter((r) => r.status === 'Passed' || r.status === 'Enacted').length;
  return {
    progress,
    text: [
      say(lang, `Legislative output for **${label}**:`, `Mga nagawa ng Sanggunian noong **${label}**:`),
      [
        `- **${stats.filed}** ${say(lang, 'measures filed', 'panukalang inihain')}`,
        `- **${stats.approved}** ${say(lang, 'measures approved', 'panukalang naaprubahan')}`,
        `- **${stats.sessionsHeld}** ${say(lang, `of ${stats.sessionsPlanned} planned sessions held`, `sa ${stats.sessionsPlanned} na nakaplanong sesyon ang naisagawa`)}`,
        `- **${stats.quorumRate}%** quorum rate`,
        `- **${stats.avgDaysToApprove}** ${say(lang, 'days on average from filing to approval', 'araw sa karaniwan mula paghahain hanggang pag-apruba')}`,
        `- **${stats.publishedOnTime}%** ${say(lang, 'published on time', 'nailathala sa takdang oras')}`,
      ].join('\n'),
      say(
        lang,
        `Of the ${describeFilters({ classification: filters.classification }, lang)} currently posted on LIMS, ${pending} are pending and ${approved} are approved or enacted.`,
        `Sa ${describeFilters({ classification: filters.classification }, lang)} na nasa LIMS ngayon, ${pending} ang nakabinbin at ${approved} ang naaprubahan o naisabatas.`
      ),
    ].join('\n\n'),
    sources: ['Legislative Statistics'],
    followUps: [say(lang, 'Show pending ordinances', 'Ipakita ang mga nakabinbing ordinansa'), say(lang, 'Show the latest approved measures', 'Ipakita ang mga bagong naaprubahan')],
  };
}

function barangayAnswer(lang: AssistantLang): AssistantAnswer {
  return {
    progress: [say(lang, 'Checking the LGU profile', 'Tinitingnan ang profile ng bayan')],
    text: [
      say(lang, `Capas has **${BARANGAYS.length} barangays**:`, `May **${BARANGAYS.length} na barangay** ang Capas:`),
      BARANGAYS.join(', ') + '.',
      say(lang, 'The barangays are represented in the Sanggunian by the ABC President.', 'Kinakatawan ang mga barangay sa Sanggunian ng ABC President.'),
    ].join('\n\n'),
    sources: ['LGU Profile'],
    followUps: [say(lang, 'Who are the members of the Sanggunian?', 'Sino ang mga kasapi ng Sanggunian?')],
  };
}

function aboutAnswer(lang: AssistantLang, aboutCapas: boolean): AssistantAnswer {
  const text = aboutCapas
    ? say(
        lang,
        `**Capas** is a municipality in the province of ${LGU_PROFILE.province}, founded in ${LGU_PROFILE.founded}, with ${LGU_PROFILE.barangayCount} barangays. It is home to the Capas National Shrine and the gateway to Mt. Pinatubo.`,
        `Ang **Capas** ay bayan sa lalawigan ng ${LGU_PROFILE.province}, itinatag noong ${LGU_PROFILE.founded}, na may ${LGU_PROFILE.barangayCount} na barangay. Narito ang Capas National Shrine at ang daan patungong Bundok Pinatubo.`
      )
    : say(
        lang,
        `**LIMS** (${LGU_PROFILE.systemName}) is the public portal for the Sanggunian's ordinances, resolutions, sessions, and documents.`,
        `Ang **LIMS** (${LGU_PROFILE.systemName}) ang pampublikong portal para sa mga ordinansa, resolusyon, sesyon, at dokumento ng Sanggunian.`
      );
  return { progress: [], text: `${text}\n\n${capabilities(lang)}`, sources: ['LGU Profile'], followUps: suggestionsFor(lang).slice(0, 3) };
}

// Services that other offices handle; the Sanggunian only makes local legislation.
const REFERRALS: { pattern: RegExp; EN: string; FIL: string }[] = [
  { pattern: /\bcedula\b|\bcommunity tax\b/, EN: "Municipal Treasurer's Office", FIL: 'Tanggapan ng Ingat-Yaman ng Bayan (Treasurer)' },
  { pattern: /\bamilyar\b|\breal property tax\b|\btax declaration\b/, EN: "Municipal Assessor's and Treasurer's Offices", FIL: 'Tanggapan ng Assessor at Treasurer ng Bayan' },
  { pattern: /\b(birth|marriage|death) cert(ificate)?\b|\bpsa\b|\bcivil regist(ry|rar)\b|\blate registration\b/, EN: 'Municipal Civil Registrar', FIL: 'Municipal Civil Registrar' },
  { pattern: /\bbusiness (permit|registration|license)\b|\bmayor'?s permit\b|\bnegosyo\b/, EN: 'Business Permits and Licensing Office (BPLO)', FIL: 'Business Permits and Licensing Office (BPLO)' },
  { pattern: /\b(building|occupancy|construction) permit\b/, EN: 'Office of the Municipal Engineer / Building Official', FIL: 'Tanggapan ng Municipal Engineer / Building Official' },
  { pattern: /\bbarangay (clearance|certificate)\b|\bindigency\b/, EN: 'barangay hall in your barangay', FIL: 'barangay hall ng inyong barangay' },
  { pattern: /\bpolice clearance\b|\bblotter\b/, EN: 'Capas Municipal Police Station (PNP)', FIL: 'Capas Municipal Police Station (PNP)' },
  { pattern: /\bayuda\b|\baics\b|\b4ps\b|\bfinancial assistance\b|\bsenior citizen\b|\bpwd\b|\bsolo parent\b/, EN: 'Municipal Social Welfare and Development Office (MSWDO)', FIL: 'Municipal Social Welfare and Development Office (MSWDO)' },
  { pattern: /\btrabaho\b|\bjobs?\b|\bhiring\b|\bemployment\b|\bjob fair\b/, EN: 'Public Employment Service Office (PESO)', FIL: 'Public Employment Service Office (PESO)' },
  { pattern: /\bbakuna\b|\bvaccin(e|ation)\b|\bmedical assistance\b/, EN: 'Municipal Health Office / Rural Health Unit', FIL: 'Municipal Health Office / Rural Health Unit' },
  { pattern: /\bweather\b|\bpanahon\b/, EN: 'PAGASA (pagasa.dost.gov.ph)', FIL: 'PAGASA (pagasa.dost.gov.ph)' },
];

function referralAnswer(office: { EN: string; FIL: string }, lang: AssistantLang): AssistantAnswer {
  return {
    progress: [],
    text: [
      say(
        lang,
        `That is handled by the **${office.EN}**, not the Sanggunian. The Sanggunian makes local ordinances and resolutions, but does not process permits, certificates, or assistance.`,
        `Ang **${office.FIL}** ang may hawak niyan, hindi ang Sanggunian. Gumagawa ang Sanggunian ng mga ordinansa at resolusyon, pero hindi ito nagpoproseso ng permit, sertipiko, o tulong.`
      ),
      say(lang, `Most municipal offices are at the ${LGU_PROFILE.address}.`, `Karamihan sa mga tanggapan ng bayan ay nasa ${LGU_PROFILE.address}.`),
    ].join('\n\n'),
    sources: [],
    followUps: suggestionsFor(lang).slice(0, 2),
  };
}

function fallbackAnswer(parsed: Parsed): AssistantAnswer {
  const { lang } = parsed;
  const words = [...parsed.topics, ...parsed.unknown].slice(0, 4);
  const topics = [...new Set(RECORDS.map((record) => record.subject).filter(Boolean))].slice(0, 8);
  const text = words.length
    ? [
        say(
          lang,
          `I couldn't find an ordinance or resolution about **${words.join(' ')}** on LIMS. It may not have been filed yet, or it may use different wording.`,
          `Wala akong nahanap na ordinansa o resolusyon tungkol sa **${words.join(' ')}** sa LIMS. Maaaring hindi pa ito naihahain, o iba ang pagkakasulat nito.`
        ),
        say(lang, 'Topics with records on LIMS include:', 'Ilan sa mga paksang may rekord sa LIMS:'),
        topics.map((topic) => `- ${topic}`).join('\n'),
        say(lang, `For anything else, contact the SB Secretariat at ${LGU_PROFILE.email}.`, `Para sa iba pang tanong, makipag-ugnayan sa SB Secretariat sa ${LGU_PROFILE.email}.`),
      ].join('\n\n')
    : [say(lang, "Sorry, I didn't quite get that.", 'Paumanhin, hindi ko masyadong naintindihan.'), capabilities(lang)].join('\n\n');
  return {
    progress: [say(lang, 'Searching ordinances and resolutions', 'Hinahanap sa mga ordinansa at resolusyon')],
    text,
    sources: [],
    followUps: suggestionsFor(lang).slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const SMALL_TALK = new Set(['hello', 'thanks', 'bye', 'praise', 'ack']);
const QUESTION_WORDS = new Set(['what', 'when', 'where', 'who', 'how', 'why', 'howmany']);
const FOLLOW_UP_CONCEPTS = new Set(['author', 'committee', 'chair', 'filed', 'date', ...STATUS_CONCEPTS]);

export function answerQuestion(question: string, { sessionId, uiLang, confirmationToken }: AnswerOptions): AssistantAnswer {
  const parsed = parse(question, uiLang);
  const { lang, concepts, topics } = parsed;
  const context = contextFor(sessionId);
  const has = (...names: string[]) => names.some((name) => concepts.has(name));

  if (confirmationToken === SUBSCRIBE_TOKEN) {
    return {
      progress: [say(lang, 'Processing subscription', 'Pinoproseso ang subscription')],
      text: say(
        lang,
        'You are now subscribed to **LIMS session notices**. You will be notified before every regular session, special session, and public hearing.\n\n_(This is a demo only; no actual subscription was made.)_',
        'Naka-subscribe ka na sa **mga abiso ng sesyon ng LIMS**. Aabisuhan ka bago ang bawat regular na sesyon, special session, at pampublikong pagdinig.\n\n_(Demo lamang ito; walang aktwal na subscription na ginawa.)_'
      ),
      sources: ['Notification service (demo)'],
      followUps: [say(lang, 'When is the next session?', 'Kailan ang susunod na sesyon?')],
    };
  }

  const answer = route();
  // A greeting in front of a real question gets a greeting back, then the answer.
  if (has('hello') && !answer.text.startsWith(greeting(lang))) {
    answer.text = `${say(lang, 'Hello!', 'Kumusta!')} ${answer.text}`;
  }
  return answer;

  function route(): AssistantAnswer {
    const substantive = [...concepts].filter((concept) => !SMALL_TALK.has(concept) && !QUESTION_WORDS.has(concept));
    const byNumber = findRecordByNumber(parsed.text);

    if (!substantive.length && !topics.length && !parsed.unknown.length && !byNumber && parsed.ordinal === undefined) {
      if (has('thanks') || has('praise')) {
        return { progress: [], text: say(lang, "You're welcome! Anything else I can help you with?", 'Walang anuman! May iba ka pa bang tanong?'), sources: [], followUps: suggestionsFor(lang).slice(0, 3) };
      }
      if (has('bye')) {
        return { progress: [], text: say(lang, 'Thank you for visiting LIMS. Have a good day!', 'Salamat sa pagbisita sa LIMS. Magandang araw!'), sources: [], followUps: [] };
      }
      if (has('ack')) {
        return { progress: [], text: say(lang, 'Got it. Is there anything else you would like to know?', 'Sige. May iba ka pa bang gustong malaman?'), sources: [], followUps: suggestionsFor(lang).slice(0, 3) };
      }
      return {
        progress: [],
        text: `${greeting(lang)} ${say(lang, 'How can I help you today?', 'Paano kita matutulungan ngayon?')}\n\n${capabilities(lang)}`,
        sources: [],
        followUps: suggestionsFor(lang),
      };
    }

    const filters = readFilters(parsed);
    const hits = searchRecords(topics);
    const contextRecord = context.lastKind === 'record' ? context.lastRecords[parsed.ordinal ?? 0] : undefined;
    // "Sino ang author nito?", "the second one", "approved na ba?" after a record was discussed.
    const refersBack =
      has('ref', 'more') ||
      parsed.ordinal !== undefined ||
      (!topics.length && !parsed.unknown.length && substantive.every((concept) => FOLLOW_UP_CONCEPTS.has(concept)));

    // A record number, e.g. "2026-P-012" or "Res. 2026-041".
    if (byNumber) {
      if (!byNumber.record) {
        return {
          progress: [say(lang, 'Looking up the record number', 'Hinahanap ang numero ng rekord')],
          text: say(
            lang,
            `I couldn't find record number **${byNumber.query}** on LIMS. Record numbers look like "Mun. Ord. No. 2026-005", "Prop. Ord. No. 2026-P-012", or "SB Res. No. 2026-041".`,
            `Walang rekord na may numerong **${byNumber.query}** sa LIMS. Ganito ang anyo ng mga numero: "Mun. Ord. No. 2026-005", "Prop. Ord. No. 2026-P-012", o "SB Res. No. 2026-041".`
          ),
          sources: [],
          followUps: [say(lang, 'Show the latest ordinances', 'Ipakita ang mga bagong ordinansa')],
        };
      }
      if (has('request', 'copy', 'foi')) return requestAnswer(lang, byNumber.record, has('foi'));
      return recordAnswer([{ record: byNumber.record, score: 1, matched: 1 }], attributeOf(), parsed, context, true);
    }

    if (has('subscribe')) {
      return {
        progress: [say(lang, 'Preparing action', 'Inihahanda ang aksyon')],
        text: say(lang, 'I can subscribe you to session notices so you are notified before every session and public hearing.', 'Maaari kitang i-subscribe sa mga abiso ng sesyon para maabisuhan ka bago ang bawat sesyon at pampublikong pagdinig.'),
        sources: [],
        followUps: [],
        pendingConfirmation: { token: SUBSCRIBE_TOKEN, message: say(lang, 'Subscribe you to LIMS session notices?', 'I-subscribe ka sa mga abiso ng sesyon ng LIMS?') },
      };
    }

    if (has('identity')) {
      return {
        progress: [],
        text: `${say(lang, "I'm the **LIMS virtual assistant**, an AI helper for the public legislative portal. I answer using the records posted on LIMS, and I can't give legal advice.", 'Ako ang **virtual assistant ng LIMS**, isang AI na katulong para sa pampublikong portal ng lehislatura. Sumasagot ako batay sa mga rekord na nasa LIMS, at hindi ako nagbibigay ng legal na payo.')}\n\n${capabilities(lang)}`,
        sources: [],
        followUps: suggestionsFor(lang).slice(0, 3),
      };
    }
    if (has('help') && !topics.length) {
      return { progress: [], text: capabilities(lang), sources: [], followUps: suggestionsFor(lang) };
    }

    const referral = REFERRALS.find((entry) => entry.pattern.test(parsed.text));
    if (referral && !hits.length) return referralAnswer(referral, lang);

    if (has('request', 'copy', 'foi') && (has('copy', 'foi', 'document') || !topics.length)) {
      const record = hits[0]?.record ?? (topics.length ? undefined : contextRecord);
      if (has('copy', 'foi') && !has('request', 'how') && has('what', 'define') && !record) return glossaryAnswer([has('foi') ? 'foi' : 'copy'], lang);
      return requestAnswer(lang, record, has('foi'));
    }

    if (has('process')) return processAnswer(lang);
    if (!hits.length && !topics.length) {
      // "What is a quorum?", "ano ang ibig sabihin ng veto", "difference between ordinance and resolution".
      const definable = Object.keys(GLOSSARY).filter((term) => concepts.has(term));
      const asksMeaning = has('define') || /\b(what is|whats|what's|what does|ano ang|ano ba ang|ano yung|ano ung|anu ang)\b/.test(parsed.text);
      const asksForList =
        parsed.plural ||
        has('list', 'latest', 'howmany', 'next', 'schedule', 'chair', 'who') ||
        Boolean(filters.year) ||
        (!has('define') && has('ordinance', 'resolution') && STATUS_CONCEPTS.some((concept) => concepts.has(concept)));
      if (definable.length && asksMeaning && !asksForList) return glossaryAnswer(definable.slice(0, 2), lang);
      if (has('how') && has('ordinance', 'measure', 'resolution') && has('approved', 'enacted')) return processAnswer(lang);
    }

    // Follow-up questions about the session just discussed ("anong oras?", "where is it?", "agenda?").
    const aboutSession = has('session', 'hearing', 'schedule', 'agenda', 'attend', 'today', 'tomorrow', 'thisweek', 'nextweek', 'thismonth');
    if (context.lastKind === 'session' && !aboutSession && !topics.length && has('when', 'where', 'time', 'ref', 'more', 'date')) {
      return sessionAnswer(parsed, context, context.lastSession);
    }
    if (aboutSession || (has('next', 'last') && !has('ordinance', 'resolution', 'measure'))) {
      const recordIsSubject = hits.length && !has('session', 'schedule', 'agenda', 'hearing', 'attend') && has('ordinance', 'resolution', 'measure');
      if (!recordIsSubject) {
        const matchingSessions = searchSessions(topics);
        if (topics.length && hits.length && !matchingSessions.length && !has('next', 'agenda')) {
          // The topic has a record but no scheduled session: answer about the record, which mentions sessions if any.
          return recordAnswer(hits, 'full', parsed, context);
        }
        return sessionAnswer(parsed, context, has('agenda', 'attend') && context.lastKind === 'session' && !topics.length && !has('next') ? context.lastSession : null);
      }
    }

    if (has('committee', 'chair') && !(hits.length && has('ordinance', 'resolution', 'measure', 'ref', 'status'))) {
      return committeeAnswer(parsed);
    }

    if (has('contact', 'address') || (has('office') && !hits.length) || (has('where') && !topics.length && !hits.length && context.lastKind !== 'record')) {
      return contactAnswer(lang);
    }

    if (has('councilor', 'vicemayor', 'mayor', 'presiding', 'ipmr', 'abc', 'sk') || (has('sanggunian') && has('who', 'howmany', 'list'))) {
      if (!hits.length || !has('author', 'ref', 'ordinance', 'resolution')) return membersAnswer(parsed);
    }

    if (has('barangay') && !hits.length) return barangayAnswer(lang);

    if (has('stats', 'quorum', 'attendance') || (has('howmany') && !hits.length)) return statsAnswer(parsed, filters);

    if ((has('lims', 'capas') || has('sanggunian')) && !hits.length && !topics.length && !STATUS_CONCEPTS.some((c) => concepts.has(c)) && !has('ordinance', 'resolution', 'measure', 'list', 'latest')) {
      if (has('sanggunian')) return glossaryAnswer(['sanggunian'], lang);
      return aboutAnswer(lang, has('capas') && !has('lims'));
    }

    // Follow-ups about the record(s) just discussed ("sino author nito?", "the second one", "more details").
    if (!hits.length && contextRecord && refersBack && !parsed.unknown.length && !has('list', 'latest')) {
      return recordAnswer([{ record: contextRecord, score: 1, matched: 1 }], attributeOf(), parsed, context, true);
    }

    if (hits.length) {
      const attribute = attributeOf();
      // Several equally good matches and no specific question: list them.
      const strong = hits.filter((hit) => hit.matched === hits[0].matched && hit.score >= hits[0].score * 0.6);
      const narrowed = filters.statuses || filters.classification || filters.year ? applyFilters(strong.map((h) => h.record), filters) : null;
      if (has('list', 'howmany') || (narrowed && narrowed.length > 1 && attribute !== 'status')) {
        const records = narrowed?.length ? narrowed : strong.map((h) => h.record);
        return recordListAnswer(
          records,
          say(lang, `I found ${records.length} record${records.length === 1 ? '' : 's'} related to your question:`, `May ${records.length} rekord na may kaugnayan sa tanong mo:`),
          parsed,
          context
        );
      }
      if (narrowed?.length) {
        const preferred = hits.filter((hit) => narrowed.includes(hit.record));
        return recordAnswer([...preferred, ...hits.filter((hit) => !preferred.includes(hit))], attribute, parsed, context);
      }
      return recordAnswer(hits, attribute, parsed, context);
    }

    // Listing by status, type, year or recency ("pending ordinances", "latest resolutions", "naipasa ngayong 2026").
    if (filters.classification || filters.statuses || filters.year || has('list', 'latest', 'measure')) {
      // "Is there an ordinance about dogs?": a subject we have no records on, not a request for every ordinance.
      if (topics.length || parsed.unknown.some((word) => word.length >= 4)) return fallbackAnswer(parsed);
      const records = applyFilters(RECORDS, filters).sort((a, b) => recordDate(b).localeCompare(recordDate(a)));
      const phrase = describeFilters(filters, lang);
      if (!records.length) {
        return {
          progress: [say(lang, 'Searching ordinances and resolutions', 'Hinahanap sa mga ordinansa at resolusyon')],
          text: say(lang, `There are no ${phrase} on LIMS right now.`, `Walang ${phrase} sa LIMS ngayon.`),
          sources: [],
          followUps: suggestionsFor(lang).slice(0, 3),
        };
      }
      const shown = has('latest') && !filters.statuses ? records.slice(0, 3) : records;
      return recordListAnswer(
        shown,
        has('latest') ? say(lang, `Here are the latest ${phrase} on LIMS:`, `Narito ang pinakabagong ${phrase} sa LIMS:`) : say(lang, `Here are the ${phrase} on LIMS (${records.length}):`, `Narito ang ${phrase} sa LIMS (${records.length}):`),
        parsed,
        context
      );
    }

    return fallbackAnswer(parsed);
  }

  function attributeOf(): Attribute {
    if (has('author')) return 'author';
    if (has('committee', 'chair')) return 'committee';
    if (has('filed') || (has('when') && !has('session', 'hearing'))) return 'date';
    if (STATUS_CONCEPTS.some((concept) => concepts.has(concept))) return 'status';
    return 'full';
  }
}
