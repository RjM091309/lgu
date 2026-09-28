import { LGU_PROFILE } from '@/lib/mock-data';

// Filipino wording for the public portal, keyed by the English text shown on the page.
// `{name}` placeholders are filled in by the translator. Anything missing here stays in English,
// which is intended for official record content (ordinance titles, descriptions, subjects).

export type Lang = 'EN' | 'FIL';
export type Translator = (text: string, vars?: Record<string, string | number>) => string;

const FIL: Record<string, string> = {
  // Header and top bar
  'Republic of the Philippines': 'Republika ng Pilipinas',
  'Skip to main content': 'Lumaktaw sa pangunahing nilalaman',
  Language: 'Wika',
  'Legislative Information Management System': 'Sistema ng Pamamahala ng Impormasyong Pambatasan',
  'Request a Document': 'Humiling ng Dokumento',
  'Request a document': 'Humiling ng dokumento',
  'Open menu': 'Buksan ang menu',
  'Close menu': 'Isara ang menu',
  'LIMS logo': 'Logo ng LIMS',

  // Hero
  'Quick links:': 'Mabilisang link:',
  'Clear search': 'Burahin ang hinahanap',
  'Search suggestions': 'Mga mungkahi sa paghahanap',
  'No records match "{query}".': 'Walang rekord na tumutugma sa "{query}".',
  'Try a record number, title, or subject.': 'Subukan ang numero, pamagat, o paksa ng rekord.',
  'See the result in Legislation': 'Tingnan ang resulta sa Lehislasyon',
  'See all {count} results in Legislation': 'Tingnan ang lahat ng {count} resulta sa Lehislasyon',
  Ordinances: 'Mga Ordinansa',
  Resolutions: 'Mga Resolusyon',
  'Session calendar': 'Kalendaryo ng sesyon',
  'Next session': 'Susunod na sesyon',
  Time: 'Oras',
  Venue: 'Lugar',
  'View Agenda': 'Tingnan ang Agenda',
  'Add to Calendar': 'Idagdag sa Kalendaryo',
  Regular: 'Regular',
  Special: 'Espesyal',
  'Committee Hearing': 'Pagdinig ng Komite',
  '38th Regular Session': 'Ika-38 na Regular na Sesyon',
  'Public Hearing: Tricycle Franchising Ordinance': 'Pampublikong Pagdinig: Ordinansa sa Prangkisa ng Traysikel',
  'Special Session on the 2027 Annual Budget': 'Espesyal na Sesyon sa Taunang Badyet para sa 2027',
  [LGU_PROFILE.sessionHall]: 'Session Hall ng SB, Munisipyo ng Capas',

  // Public services
  'How can we help you?': 'Paano kami makakatulong?',
  'Search enacted and proposed ordinances': 'Maghanap ng mga naisabatas at iminumungkahing ordinansa',
  'Browse resolutions adopted by the SB': 'Tingnan ang mga resolusyong pinagtibay ng SB',
  'Session Calendar': 'Kalendaryo ng Sesyon',
  'Upcoming sessions and public hearings': 'Mga paparating na sesyon at pampublikong pagdinig',
  'Members & Committees': 'Mga Kasapi at Komite',
  'Composition of the Sanggunian': 'Komposisyon ng Sanggunian',
  'Copies of legislative records': 'Kopya ng mga rekord pambatasan',
  'Register for Updates': 'Magparehistro para sa mga Update',
  'Get notified of new legislation': 'Maabisuhan tungkol sa mga bagong lehislasyon',

  // Records at a glance
  Transparency: 'Transparency',
  'Totals of legislative records on file with the Office of the Secretary to the Sanggunian.':
    'Kabuuang bilang ng mga rekord pambatasan na nakatala sa Tanggapan ng Kalihim ng Sanggunian.',
  'Local laws enacted on public safety, revenue, environment, and local governance.':
    'Mga lokal na batas tungkol sa kaligtasang pampubliko, kita ng bayan, kapaligiran, at lokal na pamamahala.',
  'Browse ordinances': 'Tingnan ang mga ordinansa',
  'Formal expressions of the SB on policy direction, endorsements, and authorizations.':
    'Mga pormal na pahayag ng SB tungkol sa direksiyon ng patakaran, mga endorso, at mga pahintulot.',
  'Browse resolutions': 'Tingnan ang mga resolusyon',
  'Sessions Held': 'Mga Sesyong Naidaos',
  'Regular and special sessions where the SB deliberates on proposed measures.':
    'Mga regular at espesyal na sesyon kung saan tinatalakay ng SB ang mga panukala.',
  'View session calendar': 'Tingnan ang kalendaryo ng sesyon',
  'Committee Hearings': 'Mga Pagdinig ng Komite',
  'Hearings and consultations conducted before committee recommendations.':
    'Mga pagdinig at konsultasyong isinasagawa bago maglabas ng rekomendasyon ang komite.',
  'View hearings': 'Tingnan ang mga pagdinig',

  // Legislation (public inquiry)
  'Public Inquiry': 'Pampublikong Pagtatanong',
  'Search ordinances, resolutions, incoming documents, and public resources. Open a record to view, download, or print a watermarked public copy.':
    'Maghanap ng mga ordinansa, resolusyon, papasok na dokumento, at pampublikong sanggunian. Buksan ang isang rekord upang tingnan, i-download, o i-print ang pampublikong kopyang may watermark.',
  'Record type': 'Uri ng rekord',
  'All Records': 'Lahat ng Rekord',
  'Incoming Documents': 'Mga Papasok na Dokumento',
  Resources: 'Mga Sanggunian',
  'Keyword, record no., author, subject...': 'Keyword, numero ng rekord, may-akda, paksa...',
  'Search records': 'Maghanap ng rekord',
  Status: 'Katayuan',
  Category: 'Kategorya',
  Type: 'Uri',
  Subject: 'Paksa',
  Referral: 'Isinangguni sa',
  Classification: 'Klasipikasyon',
  'Action taken': 'Aksyong ginawa',
  Authorship: 'Pagka-may-akda',
  Sponsor: 'Isponsor',
  Author: 'May-akda',
  'Co-author': 'Kapwa may-akda',
  'Fewer filters': 'Mas kaunting filter',
  'More filters': 'Higit pang filter',
  Reset: 'I-reset',
  '{count} record found': '{count} rekord ang nakita',
  '{count} records found': '{count} rekord ang nakita',
  ' · {count} filter applied': ' · {count} filter ang nakalapat',
  ' · {count} filters applied': ' · {count} filter ang nakalapat',
  'Record No.': 'Numero ng Rekord',
  Title: 'Pamagat',
  Date: 'Petsa',
  Actions: 'Mga Aksyon',
  'Actions for {number}': 'Mga aksyon para sa {number}',
  View: 'Tingnan',
  'Download public copy': 'I-download ang pampublikong kopya',
  'Print public copy': 'I-print ang pampublikong kopya',
  'Request certified copy': 'Humiling ng sertipikadong kopya',
  'No matching public records found.': 'Walang tumugmang pampublikong rekord.',
  'Clear filters': 'Alisin ang mga filter',

  // Pagination
  'Showing {start}-{end} of {total}': 'Ipinapakita ang {start}-{end} sa {total}',
  Previous: 'Nakaraan',
  Next: 'Susunod',
  'Page {page} / {pages}': 'Pahina {page} / {pages}',

  // Filter values and record fields
  All: 'Lahat',
  Draft: 'Burador',
  'First Reading': 'Unang Pagbasa',
  Committee: 'Komite',
  'Second Reading': 'Ikalawang Pagbasa',
  'Third Reading': 'Ikatlong Pagbasa',
  Passed: 'Naipasa',
  Enacted: 'Naisabatas',
  Vetoed: 'Na-veto',
  Received: 'Natanggap',
  Referred: 'Isinangguni',
  Available: 'Makukuha',
  Legislation: 'Lehislasyon',
  'Incoming Document': 'Papasok na Dokumento',
  Resource: 'Sanggunian',
  Ordinance: 'Ordinansa',
  Resolution: 'Resolusyon',
  'Transmittal Letter': 'Liham ng Pagpapadala',
  'Incoming Letter': 'Papasok na Liham',
  'Reference Material': 'Materyal na Sanggunian',
  Form: 'Porma',
  Index: 'Indeks',
  Minutes: 'Katitikan',
  Transportation: 'Transportasyon',
  Tourism: 'Turismo',
  Finance: 'Pananalapi',
  Education: 'Edukasyon',
  Environment: 'Kapaligiran',
  'Public Works': 'Pampublikong Gawain',
  Agriculture: 'Agrikultura',
  Health: 'Kalusugan',
  Transmittal: 'Pagpapadala',
  'Citizen Inquiry': 'Tanong ng Mamamayan',
  Guidebook: 'Gabay',
  Archive: 'Arkibo',
  'Referred to committee; public hearing scheduled': 'Isinangguni sa komite; may nakatakdang pampublikong pagdinig',
  'Approved on second reading': 'Inaprubahan sa ikalawang pagbasa',
  'Enacted; approved by the Municipal Mayor': 'Naisabatas; inaprubahan ng Punong Bayan',
  'Approved on third reading; transmitted to the Municipal Mayor': 'Inaprubahan sa ikatlong pagbasa; ipinadala sa Punong Bayan',
  'Enacted; published and posted': 'Naisabatas; nailathala at naipaskil',
  'Filed; for first reading': 'Naihain; para sa unang pagbasa',
  'Draft under review by the Secretariat': 'Burador na sinusuri ng Sekretaryat',
  'Adopted; copies furnished to concerned agencies': 'Pinagtibay; binigyan ng kopya ang mga kinauukulang ahensya',
  'Adopted; transmitted to the Provincial Agriculture Office': 'Pinagtibay; ipinadala sa Tanggapang Panlalawigan ng Agrikultura',
  'For final deliberation': 'Para sa huling deliberasyon',
  'Acknowledged / For filing': 'Kinilala / Para sa paghahain',
  'Referred to committee secretariat': 'Isinangguni sa sekretaryat ng komite',
  Downloadable: 'Maaaring i-download',
  'Viewable / Downloadable': 'Maaaring tingnan / i-download',
  'Viewable / Printable': 'Maaaring tingnan / i-print',
  'Under review': 'Sinusuri',
  'Office of the Secretary to the Sanggunian': 'Tanggapan ng Kalihim ng Sanggunian',
  'Public Information Office': 'Tanggapan ng Pampublikong Impormasyon',
  'Records Management Unit': 'Yunit ng Pamamahala ng Rekord',
  'Public Portal': 'Pampublikong Portal',
  'SB Secretariat': 'Sekretaryat ng SB',

  // Stage progress (hover card)
  Filing: 'Paghahain',
  Deliberation: 'Deliberasyon',
  Approval: 'Pag-apruba',
  '{phase} · {step} of {total}': '{phase} · {step} sa {total}',
  '{phase} phase · Stage {step} of {total}': 'Yugto ng {phase} · Hakbang {step} sa {total}',
  '{percent}% complete, stage {step} of {total}': '{percent}% tapos, hakbang {step} sa {total}',
  Current: 'Kasalukuyan',
  'Next:': 'Susunod:',
  'Complete: the measure is in effect.': 'Tapos na: umiiral na ang panukala.',
  'Being prepared by the author before it is filed with the Secretariat.': 'Inihahanda pa ng may-akda bago ihain sa Sekretaryat.',
  'Read in session by title and number, then referred to the proper committee.':
    'Binasa sa sesyon ang pamagat at numero, saka isinangguni sa angkop na komite.',
  'Under committee study. Public hearings may be held and a committee report is prepared.':
    'Pinag-aaralan ng komite. Maaaring magdaos ng pampublikong pagdinig at inihahanda ang ulat ng komite.',
  'Committee report presented in session; the measure is debated and amended on the floor.':
    'Iniharap sa sesyon ang ulat ng komite; pinagdedebatehan at sinususugan ang panukala.',
  'Final reading; the body votes on the measure as a whole, without amendments.':
    'Huling pagbasa; bumoboto ang kapulungan sa kabuuan ng panukala nang walang susog.',
  "Approved by the Sanggunian and transmitted for the Mayor's approval.": 'Inaprubahan ng Sanggunian at ipinadala para sa pag-apruba ng Punong Bayan.',
  'Approved and posted or published; the measure is now in effect.': 'Inaprubahan at naipaskil o nailathala; umiiral na ang panukala.',

  // Members and committees
  'Legislative Body': 'Lehislatibong Kapulungan',
  'The legislative body of the Municipality of Capas, presided over by the Municipal Vice Mayor. It enacts ordinances, adopts resolutions, and appropriates funds for the general welfare of the municipality and its inhabitants.':
    'Ang lehislatibong kapulungan ng Bayan ng Capas na pinamumunuan ng Pangalawang Punong Bayan. Nagpapasa ito ng mga ordinansa, nagpapatibay ng mga resolusyon, at naglalaan ng pondo para sa pangkalahatang kapakanan ng bayan at ng mga mamamayan nito.',
  'Municipal Councilors': 'Mga Konsehal ng Bayan',
  'Ex-officio Members': 'Mga Ex-officio na Kasapi',
  'Standing Committees': 'Mga Palagiang Komite',
  'Member Composition': 'Komposisyon ng mga Kasapi',
  '{count} members · select a member to see their committee assignments': '{count} kasapi · pumili ng kasapi upang makita ang kanyang mga komite',
  Chair: 'Tagapangulo',
  'Vice Chair': 'Pangalawang Tagapangulo',
  Member: 'Kasapi',
  'chairs at least one committee': 'namumuno sa kahit isang komite',
  'Select a committee to see the measures referred to it.': 'Pumili ng komite upang makita ang mga panukalang isinangguni rito.',
  'Committee assignments': 'Mga komite',
  'The Municipal Vice Mayor presides over sessions and does not sit in standing committees.':
    'Ang Pangalawang Punong Bayan ang namumuno sa mga sesyon at hindi kasapi ng mga palagiang komite.',
  'No committee assignments.': 'Walang komite.',
  'Presiding Officer': 'Namumunong Opisyal',
  'At-large': 'Inihalal sa buong bayan',
  'SB Member': 'Kasapi ng SB',
  'Ex-officio SB Member': 'Ex-officio na Kasapi ng SB',
  'Presides over sessions': 'Namumuno sa mga sesyon',
  'Regular members': 'Mga regular na kasapi',
  '{count} councilors · elected at large': '{count} konsehal · inihalal sa buong bayan',
  'Ex-officio members': 'Mga ex-officio na kasapi',
  '{count} committees': '{count} komite',
  'Municipal Vice Mayor': 'Pangalawang Punong Bayan',
  'Municipal Councilor': 'Konsehal ng Bayan',
  'Municipal Councilor (1st)': 'Konsehal ng Bayan (Ika-1)',
  'Municipal Councilor (2nd)': 'Konsehal ng Bayan (Ika-2)',
  'Municipal Councilor (3rd)': 'Konsehal ng Bayan (Ika-3)',
  'Municipal Councilor (4th)': 'Konsehal ng Bayan (Ika-4)',
  'Municipal Councilor (5th)': 'Konsehal ng Bayan (Ika-5)',
  'Municipal Councilor (6th)': 'Konsehal ng Bayan (Ika-6)',
  'Municipal Councilor (7th)': 'Konsehal ng Bayan (Ika-7)',
  'Municipal Councilor (8th)': 'Konsehal ng Bayan (Ika-8)',
  'IPMR Representative': 'Kinatawan ng IPMR',
  'ABC President': 'Pangulo ng ABC',
  'SK Federation President': 'Pangulo ng SK Federation',
  'Indigenous Peoples Mandatory Representative': 'Mandatoryong Kinatawan ng mga Katutubo',
  'Liga ng mga Barangay President': 'Pangulo ng Liga ng mga Barangay',
  'Sangguniang Kabataan Federation President': 'Pangulo ng Sangguniang Kabataan Federation',
  'Committee on Finance, Budget and Appropriations': 'Komite sa Pananalapi, Badyet at Paglalaan',
  'Committee on Tourism, Culture and Heritage': 'Komite sa Turismo, Kultura at Pamana',
  'Committee on Health and Social Welfare': 'Komite sa Kalusugan at Kapakanang Panlipunan',
  'Committee on Education': 'Komite sa Edukasyon',
  'Committee on Public Works and Infrastructure': 'Komite sa Pampublikong Gawain at Imprastruktura',
  'Committee on Agriculture': 'Komite sa Agrikultura',
  'Committee on Peace and Order and Public Safety': 'Komite sa Kapayapaan, Kaayusan at Kaligtasang Pampubliko',
  'Committee on Environment and Natural Resources': 'Komite sa Kapaligiran at Likas na Yaman',
  'Committee on Transportation': 'Komite sa Transportasyon',

  // Sessions
  Schedule: 'Iskedyul',
  'Sessions are open to the public and held at the {hall}. View the order of business, add a session to your calendar, or print the agenda.':
    'Bukas sa publiko ang mga sesyon at ginaganap sa {hall}. Tingnan ang kaayusan ng pagpupulong, idagdag ang sesyon sa iyong kalendaryo, o i-print ang agenda.',
  Agenda: 'Agenda',
  'Add {title} to calendar': 'Idagdag ang {title} sa kalendaryo',
  'Recently Approved Measures': 'Mga Kamakailang Inaprubahang Panukala',
  'Ordinances and resolutions approved by the SB.': 'Mga ordinansa at resolusyong inaprubahan ng SB.',
  'View all legislation': 'Tingnan ang lahat ng lehislasyon',
  'Order of Business': 'Kaayusan ng Pagpupulong',
  'Print agenda': 'I-print ang agenda',
  'Add to calendar': 'Idagdag sa kalendaryo',
  'Call to Order': 'Pagbubukas ng Pulong',
  'Opening Remarks of the Committee Chairperson': 'Pambungad na Pananalita ng Tagapangulo ng Komite',
  'Open Forum: Comments and Position Papers from Stakeholders': 'Bukas na Talakayan: Mga Puna at Posisyong Papel ng mga Stakeholder',
  'Committee Deliberation': 'Deliberasyon ng Komite',
  Adjournment: 'Pagtatapos ng Pulong',
  'Invocation and Singing of the Philippine National Anthem': 'Panalangin at Pag-awit ng Pambansang Awit ng Pilipinas',
  'Roll Call and Declaration of Quorum': 'Pagtawag ng Pangalan at Pagdeklara ng Korum',
  'Consideration of the Proposed 2027 Annual Budget of the Municipality of Capas':
    'Pagsasaalang-alang sa Iminumungkahing Taunang Badyet ng Bayan ng Capas para sa 2027',
  'Reading and Approval of the Minutes of the Previous Session': 'Pagbasa at Pag-apruba ng Katitikan ng Nakaraang Sesyon',
  'Committee Reports': 'Mga Ulat ng Komite',
  'Other Matters': 'Iba Pang Usapin',
  'Presentation of the Measure: ': 'Paglalahad ng Panukala: ',
  'First Reading and Referral: ': 'Unang Pagbasa at Pagsasangguni: ',
  'Unfinished Business: ': 'Hindi Pa Tapos na Usapin: ',

  // Resources
  Downloads: 'Mga Download',
  'Guides, archives, and forms for citizens and organizations. Downloaded and printed copies carry a public-copy watermark.':
    'Mga gabay, arkibo, at porma para sa mga mamamayan at organisasyon. May watermark na "pampublikong kopya" ang mga na-download at na-print na kopya.',
  'Citizen Guidebook': 'Gabay ng Mamamayan',
  'How to participate in public hearings and legislative consultations.': 'Paano makilahok sa mga pampublikong pagdinig at konsultasyong pambatasan.',
  'Ordinance Archive': 'Arkibo ng mga Ordinansa',
  'Index of enacted municipal ordinances by number, title, and year.': 'Indeks ng mga naisabatas na ordinansa ayon sa numero, pamagat, at taon.',
  'Session Minutes': 'Katitikan ng Sesyon',
  'Approved minutes of regular and special sessions of the SB.': 'Mga inaprubahang katitikan ng regular at espesyal na sesyon ng SB.',
  'Accreditation Form': 'Porma ng Akreditasyon',
  'Request form for accreditation of civil society organizations.': 'Porma ng kahilingan para sa akreditasyon ng mga organisasyong sibiko.',
  Download: 'I-download',
  Print: 'I-print',
  'Download {title}': 'I-download ang {title}',
  'Print {title}': 'I-print ang {title}',
  'Register for Legislative Updates': 'Magparehistro para sa mga Update sa Lehislasyon',
  'Receive notices of new ordinances, resolutions, and public hearings.': 'Tumanggap ng abiso tungkol sa mga bagong ordinansa, resolusyon, at pampublikong pagdinig.',
  'Full name': 'Buong pangalan',
  'Email address': 'Email address',
  'Subscribe to ordinance and resolution updates': 'Mag-subscribe sa mga update sa ordinansa at resolusyon',
  Register: 'Magparehistro',
  'How we use your data': 'Paano namin ginagamit ang iyong datos',
  'Check Accreditation Status': 'Alamin ang Katayuan ng Akreditasyon',
  "Enter the reference number of your organization's accreditation request.": 'Ilagay ang reference number ng kahilingan sa akreditasyon ng inyong organisasyon.',
  'e.g. ACC-2026-005': 'hal. ACC-2026-005',
  'Accreditation reference number': 'Reference number ng akreditasyon',
  Check: 'Suriin',
  'Download accreditation form': 'I-download ang porma ng akreditasyon',
  'For Verification': 'Para sa Beripikasyon',
  Approved: 'Aprubado',
  Submitted: 'Naisumite',

  // News
  Updates: 'Mga Update',
  'Recent actions, notices, and announcements posted on LIMS.': 'Mga kamakailang aksyon, abiso, at anunsyo na nakapaskil sa LIMS.',
  'Read more': 'Magbasa pa',
  'View related document': 'Tingnan ang kaugnay na dokumento',
  Recognition: 'Pagkilala',
  'Public Hearing': 'Pampublikong Pagdinig',
  'Enacted Ordinance': 'Naisabatas na Ordinansa',
  '2022–2025 Term': 'Termino 2022–2025',
  'October 7, 2026': 'Oktubre 7, 2026',
  'February 2026': 'Pebrero 2026',
  'Regional Winner, Local Legislative Award': 'Regional Winner ng Local Legislative Award',
  'The municipal legislative council was recognized as Regional Winner of the Local Legislative Award for the 2022–2025 term.':
    'Kinilala ang lehislatibong kapulungan ng bayan bilang Regional Winner ng Local Legislative Award para sa terminong 2022–2025.',
  'The award recognizes local legislative bodies for the quality of their legislation, the efficiency of their procedures, and their engagement with constituents.':
    'Kinikilala ng parangal ang mga lokal na lehislatibong kapulungan dahil sa kalidad ng kanilang lehislasyon, husay ng kanilang proseso, at pakikipag-ugnayan sa mga mamamayan.',
  'Public Hearing on the Proposed Tricycle Franchising Ordinance': 'Pampublikong Pagdinig sa Iminumungkahing Ordinansa sa Prangkisa ng Traysikel',
  'Tricycle operators, drivers, and commuters are invited to share their views on Prop. Ord. No. 2026-P-012.':
    'Inaanyayahan ang mga operator, drayber, at pasahero ng traysikel na ibahagi ang kanilang pananaw sa Prop. Ord. No. 2026-P-012.',
  'The Committee on Transportation will conduct a public hearing on Prop. Ord. No. 2026-P-012, an ordinance regulating the operation of tricycles-for-hire and prescribing fare rates in the Municipality of Capas.':
    'Magsasagawa ang Komite sa Transportasyon ng pampublikong pagdinig sa Prop. Ord. No. 2026-P-012, isang ordinansang nagreregula sa operasyon ng mga paupahang traysikel at nagtatakda ng pamasahe sa Bayan ng Capas.',
  [`The hearing will be held on October 7, 2026 at 2:00 PM at the ${LGU_PROFILE.sessionHall}. Written position papers may be submitted to the Office of the Secretary to the Sanggunian before the hearing.`]:
    'Gaganapin ang pagdinig sa Oktubre 7, 2026, alas-2:00 ng hapon sa Session Hall ng SB, Munisipyo ng Capas. Maaaring magsumite ng nakasulat na posisyong papel sa Tanggapan ng Kalihim ng Sanggunian bago ang pagdinig.',
  'Capas National Shrine Environs Declared a Heritage Protection Zone': 'Paligid ng Capas National Shrine, Idineklarang Heritage Protection Zone',
  'Mun. Ord. No. 2026-005 regulates signage, vending, and new construction within the buffer zone of the Capas National Shrine.':
    'Nireregula ng Mun. Ord. No. 2026-005 ang mga karatula, pagtitinda, at bagong konstruksiyon sa buffer zone ng Capas National Shrine.',
  'Municipal Ordinance No. 2026-005 declares the environs of the Capas National Shrine a Heritage Protection Zone.':
    'Idinedeklara ng Municipal Ordinance No. 2026-005 ang paligid ng Capas National Shrine bilang Heritage Protection Zone.',
  'The ordinance regulates signage, vending, and new construction within the buffer zone to preserve the memorial site of the Bataan Death March.':
    'Nireregula ng ordinansa ang mga karatula, pagtitinda, at bagong konstruksiyon sa buffer zone upang mapangalagaan ang pook-alaala ng Bataan Death March.',

  // Transparency links
  'Transparency and Accountability': 'Transparency at Pananagutan',
  'Budget, procurement, and performance disclosures': 'Pagsisiwalat ng badyet, pagbili, at pagganap',
  'Service standards of the Municipality of Capas': 'Pamantayan ng serbisyo ng Bayan ng Capas',
  'File an FOI request online': 'Maghain ng FOI request online',
  'DILG Full Disclosure Policy Portal': 'Portal ng Full Disclosure Policy ng DILG',

  // Footer
  'Municipality of Capas': 'Bayan ng Capas',
  'All content is in the public domain unless otherwise stated.': 'Ang lahat ng nilalaman ay pampublikong pag-aari maliban kung may ibang nakasaad.',
  'Contact the SB Office': 'Makipag-ugnayan sa Tanggapan ng SB',
  'Legislative Office': 'Tanggapang Pambatasan',
  'Municipality of Capas website': 'Website ng Bayan ng Capas',
  'About GOVPH': 'Tungkol sa GOVPH',
  'Learn more about the Philippine government, its structure, how government works, and the people behind it.':
    'Alamin ang tungkol sa pamahalaan ng Pilipinas, ang istruktura nito, kung paano ito gumagana, at ang mga taong nasa likod nito.',
  'Government Links': 'Mga Link ng Pamahalaan',
  'Office of the President': 'Tanggapan ng Pangulo',
  'Office of the Vice President': 'Tanggapan ng Pangalawang Pangulo',
  'Senate of the Philippines': 'Senado ng Pilipinas',
  'House of Representatives': 'Kapulungan ng mga Kinatawan',
  'Supreme Court': 'Korte Suprema',
  'Department of the Interior and Local Government': 'Kagawaran ng Interyor at Pamahalaang Lokal',
  '© 2026 {name}. All rights reserved.': '© 2026 {name}. Nakalaan ang lahat ng karapatan.',
  'Privacy Notice': 'Abiso sa Privacy',
  'Terms of Use': 'Mga Tuntunin ng Paggamit',
  Accessibility: 'Accessibility',
  'Back to top': 'Bumalik sa itaas',

  // Staff login
  'For authorized LIMS personnel.': 'Para sa mga awtorisadong kawani ng LIMS.',
  Username: 'Username',
  'Enter username': 'Ilagay ang username',
  Password: 'Password',
  'Enter password': 'Ilagay ang password',
  'Remember me': 'Tandaan ako',
  'Sign in': 'Mag-sign in',
  'Demo access:': 'Demo access:',
  'Other roles:': 'Iba pang tungkulin:',
  '(same password)': '(parehong password)',
  'Please enter your username and password.': 'Pakilagay ang iyong username at password.',
  'Sign-in failed': 'Hindi nakapag-sign in',
  'This account is deactivated. Contact the SB Secretariat administrator.': 'Naka-deactivate ang account na ito. Makipag-ugnayan sa administrator ng SB Secretariat.',
  'This account is deactivated.': 'Naka-deactivate ang account na ito.',
  'Signed in': 'Naka-sign in',
  'Welcome, {name}. You are signed in as {role}.': 'Maligayang pagdating, {name}. Naka-sign in ka bilang {role}.',
  'Invalid username or password. Please try again.': 'Mali ang username o password. Pakisubukang muli.',

  // Registration
  'Please provide your full name and email address.': 'Pakilagay ang iyong buong pangalan at email address.',
  'Registration not saved': 'Hindi na-save ang rehistrasyon',
  'Please enter a valid email address.': 'Pakilagay ang wastong email address.',
  '{email} is not a valid email address.': 'Hindi wastong email address ang {email}.',
  'Submit your registration?': 'Isumite ang iyong rehistrasyon?',
  '{name} will be registered with {email} and subscribed to legislative updates.':
    'Irerehistro si {name} gamit ang {email} at isu-subscribe sa mga update sa lehislasyon.',
  '{name} will be registered with {email}.': 'Irerehistro si {name} gamit ang {email}.',
  'Registration saved': 'Na-save ang rehistrasyon',
  'You are now subscribed to legislative updates.': 'Naka-subscribe ka na sa mga update sa lehislasyon.',
  'You may enable updates anytime.': 'Maaari mong i-on ang mga update anumang oras.',
  'Registration saved. You are now subscribed to legislative updates.': 'Na-save ang rehistrasyon. Naka-subscribe ka na sa mga update sa lehislasyon.',
  'Registration saved. You may enable updates anytime.': 'Na-save ang rehistrasyon. Maaari mong i-on ang mga update anumang oras.',
  Cancel: 'Kanselahin',

  // Accreditation lookup
  'Please enter a reference number.': 'Pakilagay ang reference number.',
  'Lookup failed': 'Hindi nahanap',
  'Accreditation found': 'Nahanap ang akreditasyon',
  'Accreditation not found': 'Walang nahanap na akreditasyon',
  'No accreditation request found for {key}.': 'Walang nahanap na kahilingan sa akreditasyon para sa {key}.',

  // Document request
  'Please complete your name, email address, and the document requested.': 'Pakikumpleto ang iyong pangalan, email address, at ang hinihinging dokumento.',
  'Request not submitted': 'Hindi naisumite ang kahilingan',
  'Submit this document request?': 'Isumite ang kahilingang ito?',
  'A request for "{record}" will be sent to the SB Secretariat. Updates will go to {email}.':
    'Ipapadala sa SB Secretariat ang kahilingan para sa "{record}". Ipapadala ang mga update sa {email}.',
  'Submit request': 'Isumite ang kahilingan',
  'Request submitted': 'Naisumite ang kahilingan',
  'Your reference number is {reference}.': 'Ang iyong reference number ay {reference}.',
  'Request a certified copy of a legislative record from the Office of the Secretary to the Sanggunian.':
    'Humiling ng sertipikadong kopya ng rekord pambatasan mula sa Tanggapan ng Kalihim ng Sanggunian.',
  'Request received': 'Natanggap ang kahilingan',
  'Your reference number is': 'Ang iyong reference number ay',
  '. A confirmation will be sent to {email}. Please present this reference number when claiming your document at the SB Office.':
    '. Magpapadala ng kumpirmasyon sa {email}. Pakipakita ang reference number na ito sa pagkuha ng dokumento sa Tanggapan ng SB.',
  Done: 'Tapos na',
  'Record number or title (e.g. Mun. Ord. No. 2026-005)': 'Numero o pamagat ng rekord (hal. Mun. Ord. No. 2026-005)',
  'Document requested': 'Hinihinging dokumento',
  Purpose: 'Layunin',
  'Personal reference': 'Personal na sanggunian',
  'Research / Academic': 'Pananaliksik / Akademiko',
  'Legal proceedings': 'Legal na paglilitis',
  'Business compliance': 'Pagsunod ng negosyo',
  Other: 'Iba pa',
  'By submitting, you agree to the processing of your personal data under the': 'Sa pagsusumite, pumapayag ka sa pagproseso ng iyong personal na datos alinsunod sa',

  // Document viewer
  'Public Document Viewer': 'Tagatingin ng Pampublikong Dokumento',
  'View, download, or print a watermarked public copy.': 'Tingnan, i-download, o i-print ang pampublikong kopyang may watermark.',

  // Policies
  'LIMS collects only the personal information needed to process public registrations, inquiries, and requests for legislative documents, in accordance with the Data Privacy Act of 2012 (RA 10173).':
    'Kinokolekta lamang ng LIMS ang personal na impormasyong kailangan upang maproseso ang mga pampublikong rehistrasyon, pagtatanong, at kahilingan para sa mga dokumentong pambatasan, alinsunod sa Data Privacy Act of 2012 (RA 10173).',
  'Information is used solely for the stated purpose, kept only as long as necessary, and protected against unauthorized access. You may request access to, correction of, or deletion of your data through the Office of the Secretary to the Sanggunian at {email}.':
    "Ginagamit lamang ang impormasyon para sa nakasaad na layunin, iniingatan lamang hangga't kailangan, at pinoprotektahan laban sa hindi awtorisadong pag-access. Maaari kang humiling na ma-access, maitama, o mabura ang iyong datos sa pamamagitan ng Tanggapan ng Kalihim ng Sanggunian sa {email}.",
  'Documents on this portal are provided for public information. Downloaded and printed copies are marked “Public Copy” and are not certified true copies. Certified copies may be requested from the Office of the Secretary to the Sanggunian.':
    'Ang mga dokumento sa portal na ito ay para sa pampublikong kaalaman. May markang “Public Copy” ang mga na-download at na-print na kopya at hindi ito mga sertipikadong tunay na kopya. Maaaring humiling ng sertipikadong kopya sa Tanggapan ng Kalihim ng Sanggunian.',
  'This portal is designed to work on phones, tablets, and desktop computers, supports keyboard navigation, and uses readable text and color contrast. Report accessibility issues to {email}.':
    'Idinisenyo ang portal na ito para gumana sa mga telepono, tablet, at desktop computer, sumusuporta sa pag-navigate gamit ang keyboard, at gumagamit ng nababasang teksto at sapat na contrast ng kulay. Iulat ang mga isyu sa accessibility sa {email}.',
};

const fill = (text: string, vars?: Record<string, string | number>) =>
  vars ? Object.entries(vars).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text) : text;

export const makeTranslator =
  (lang: Lang): Translator =>
  (text, vars) =>
    fill(lang === 'FIL' ? (FIL[text] ?? text) : text, vars);

/** Order-of-business lines, including the ones that end in a measure title. */
export const translateAgendaItem = (tr: Translator, item: string) => {
  for (const prefix of ['Presentation of the Measure: ', 'First Reading and Referral: ', 'Unfinished Business: ']) {
    if (item.startsWith(prefix)) return tr(prefix) + item.slice(prefix.length);
  }
  return tr(item);
};

/** Dates in the portal's language (Filipino month and weekday names under FIL). */
export const localeOf = (lang: Lang) => (lang === 'FIL' ? 'fil-PH' : 'en-PH');
