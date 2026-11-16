import type { DisciplineId, Player, Stint } from "../model.ts";

/**
 * Sample rosters. Handles are real professionals, but lineups, roles, join dates and birth
 * years are approximate and unverified: they exist so pages have realistic shape.
 *
 * Row format: handle | real name ("" when not confidently known) | country | role | joined (YYYY-MM) | birth year (unused: not published)
 */
type Row = [string, string, string, string, string, number];

const CS2: Record<string, Row[]> = {
  mouz: [
    ["torzsi", "Ádám Torzsás", "HU", "AWPer", "2022-01", 2002],
    ["Jimpphat", "Jimi Salo", "FI", "Rifler", "2022-07", 2006],
    ["xertioN", "Dorian Berman", "IL", "Entry", "2022-01", 2004],
    ["Brollan", "Ludvig Brolin", "SE", "In-game leader", "2024-07", 2002],
    ["Spinx", "Lotan Giladi", "IL", "Lurker", "2025-01", 2000],
  ],
  spirit: [
    ["chopper", "Leonid Vishnyakov", "RU", "In-game leader", "2021-06", 1997],
    ["donk", "Danil Kryshkovets", "RU", "Entry", "2023-07", 2007],
    ["sh1ro", "Dmitriy Sokolov", "RU", "AWPer", "2023-05", 2001],
    ["zont1x", "Myroslav Plakhotja", "UA", "Rifler", "2023-01", 2003],
    ["zweih", "Ivan Gogin", "RU", "Lurker", "2024-11", 2006],
  ],
  mongolz: [
    ["bLitz", "Garidmagnai Byambasuren", "MN", "In-game leader", "2021-01", 2001],
    ["Techno4K", "Sodbayar Munkhbold", "MN", "Rifler", "2022-01", 2001],
    ["910", "", "MN", "AWPer", "2023-01", 2003],
    ["mzinho", "Ayush Batbold", "MN", "Entry", "2023-07", 2006],
    ["Senzu", "Azbayar Munkhbold", "MN", "Rifler", "2023-03", 2005],
  ],
  falcons: [
    ["NiKo", "Nikola Kovač", "BA", "Rifler", "2024-01", 1997],
    ["m0NESY", "Ilya Osipov", "RU", "AWPer", "2025-01", 2005],
    ["kyxsan", "Damjan Stoilkovski", "MK", "In-game leader", "2024-07", 1999],
    ["TeSeS", "René Madsen", "DK", "Rifler", "2024-01", 2000],
    ["Magisk", "Emil Reif", "DK", "Support", "2024-01", 1998],
  ],
  faze: [
    ["karrigan", "Finn Andersen", "DK", "In-game leader", "2021-01", 1990],
    ["rain", "Håvard Nygaard", "NO", "Entry", "2016-01", 1994],
    ["broky", "Helvijs Saukants", "LV", "AWPer", "2020-11", 2001],
    ["frozen", "David Čerňanský", "SK", "Rifler", "2024-11", 2002],
    ["EliGE", "", "US", "Rifler", "2025-04", 1997],
  ],
  navi: [
    ["Aleksib", "Aleksi Virolainen", "FI", "In-game leader", "2023-07", 1997],
    ["iM", "Mihai Ivan", "RO", "Rifler", "2023-07", 1999],
    ["b1t", "Valeriy Vakhovskiy", "UA", "Rifler", "2020-12", 2003],
    ["w0nderful", "Ihor Zhdanov", "UA", "AWPer", "2023-07", 2004],
    ["jL", "Justinas Lekavicius", "LT", "Entry", "2023-07", 1999],
  ],
  aurora: [
    ["MAJ3R", "Engin Küpeli", "TR", "In-game leader", "2025-01", 1991],
    ["XANTARES", "İsmailcan Dörtkardeş", "TR", "Rifler", "2025-01", 1995],
    ["woxic", "Özgür Eker", "TR", "AWPer", "2025-01", 1998],
    ["wicadia", "Ali Haydar Yalçın", "TR", "Entry", "2025-01", 2005],
    ["jottAAA", "", "TR", "Rifler", "2025-01", 2004],
  ],
  g2: [
    ["huNter-", "Nemanja Kovač", "BA", "In-game leader", "2018-06", 1996],
    ["malbsMd", "Mario Samayoa", "GT", "Rifler", "2023-03", 2003],
    ["HeavyGod", "", "IL", "Entry", "2025-01", 2004],
    ["MATYS", "", "SK", "AWPer", "2025-04", 2005],
    ["SunPayus", "Álvaro García", "ES", "Rifler", "2025-07", 1999],
  ],
  furia: [
    ["FalleN", "Gabriel Toledo", "BR", "In-game leader", "2023-07", 1991],
    ["KSCERATO", "Kaike Cerato", "BR", "Rifler", "2018-01", 1999],
    ["yuurih", "Yuri Boian", "BR", "Rifler", "2017-11", 1999],
    ["molodoy", "Danil Golubenko", "KZ", "AWPer", "2025-04", 2005],
    ["YEKINDAR", "Mareks Gaļinskis", "LV", "Entry", "2025-04", 1999],
  ],
  astralis: [
    ["device", "Nicolai Reedtz", "DK", "AWPer", "2023-07", 1995],
    ["HooXi", "", "DK", "In-game leader", "2025-01", 1995],
    ["jabbi", "", "DK", "Rifler", "2025-01", 2003],
    ["Staehr", "", "DK", "Entry", "2023-07", 2002],
    ["cadiaN", "", "DK", "Support", "2025-01", 1995],
  ],
  pain: [
    ["biguzera", "Rodrigo Bittencourt", "BR", "In-game leader", "2022-01", 1999],
    ["dav1deuS", "", "CL", "AWPer", "2024-01", 2001],
    ["snow", "", "BR", "Rifler", "2024-01", 2003],
    ["nqz", "", "BR", "Entry", "2023-01", 2004],
    ["dgt", "", "UY", "Rifler", "2025-01", 2003],
  ],
  liquid: [
    ["NAF", "Keith Markovic", "CA", "Rifler", "2019-01", 1997],
    ["ultimate", "Roland Tomkowiak", "PL", "AWPer", "2024-07", 2003],
    ["NertZ", "Guy Iluz", "IL", "Entry", "2025-01", 2001],
    ["siuhy", "Kamil Szkaradek", "PL", "In-game leader", "2025-01", 2002],
    ["Twistzz", "Russel Van Dulken", "CA", "Rifler", "2024-01", 1999],
  ],
  "3dmax": [
    ["Lucky", "Lucas Chastang", "FR", "AWPer", "2023-07", 2002],
    ["Maka", "Bryan Canda", "FR", "In-game leader", "2023-07", 2000],
    ["Ex3rcice", "", "FR", "Rifler", "2023-07", 2001],
    ["Graviti", "", "FR", "Entry", "2023-07", 2002],
    ["bodyy", "Alexandre Pianaro", "FR", "Rifler", "2024-01", 1997],
  ],
  vp: [
    ["fame", "Petr Bolyshev", "RU", "Rifler", "2022-01", 2002],
    ["FL1T", "Evgeniy Lebedev", "RU", "Entry", "2022-01", 2001],
    ["ICY", "", "KZ", "AWPer", "2025-01", 2006],
    ["FL4MUS", "", "RU", "Rifler", "2024-07", 2004],
    ["electroNic", "Denis Sharipov", "RU", "In-game leader", "2024-01", 1998],
  ],
  heroic: [
    ["tN1R", "", "UA", "Rifler", "2024-01", 2001],
    ["xfl0ud", "", "TR", "AWPer", "2024-01", 2002],
    ["yxngstxr", "", "RU", "Entry", "2024-07", 2005],
    ["Chr1zN", "", "DK", "In-game leader", "2025-01", 2000],
    ["LNZ", "", "SE", "Rifler", "2025-01", 2004],
  ],
};

const LOL: Record<string, Row[]> = {
  geng: [
    ["Kiin", "Kim Gi-in", "KR", "Top", "2024-11", 1999],
    ["Canyon", "Kim Geon-bu", "KR", "Jungle", "2024-11", 2001],
    ["Chovy", "Jeong Ji-hoon", "KR", "Mid", "2021-11", 2001],
    ["Ruler", "Park Jae-hyuk", "KR", "Bot", "2025-11", 1998],
    ["Duro", "Joo Min-kyu", "KR", "Support", "2024-11", 2003],
  ],
  blg: [
    ["Bin", "Chen Ze-Bin", "CN", "Top", "2022-11", 2003],
    ["Beichuan", "", "CN", "Jungle", "2025-01", 2004],
    ["knight", "Zhuo Ding", "CN", "Mid", "2023-11", 2000],
    ["Elk", "Zhao Jia-Hao", "CN", "Bot", "2022-11", 2001],
    ["ON", "Luo Wen-Jun", "CN", "Support", "2023-11", 2003],
  ],
  hle: [
    ["Zeus", "Choi Woo-je", "KR", "Top", "2024-11", 2004],
    ["Kanavi", "Seo Jin-hyeok", "KR", "Jungle", "2025-11", 2000],
    ["Zeka", "Kim Geon-woo", "KR", "Mid", "2023-11", 2002],
    ["Viper", "Park Do-hyeon", "KR", "Bot", "2023-11", 2000],
    ["Delight", "Yoo Hwan-joong", "KR", "Support", "2025-11", 2002],
  ],
  al: [
    ["Flandre", "Li Xuan-Jun", "CN", "Top", "2025-01", 1998],
    ["Tarzan", "Lee Seung-yong", "KR", "Jungle", "2025-01", 1999],
    ["Shanks", "Cui Xiao-Bin", "CN", "Mid", "2025-01", 2002],
    ["Hope", "Wang Jie", "CN", "Bot", "2025-01", 2000],
    ["Kael", "Kim Jin-hong", "KR", "Support", "2025-01", 2002],
  ],
  g2: [
    ["BrokenBlade", "Sergen Çelik", "DE", "Top", "2022-11", 2000],
    ["SkewMond", "Rudy Semaan", "FR", "Jungle", "2025-01", 2004],
    ["Caps", "Rasmus Winther", "DK", "Mid", "2019-11", 1999],
    ["Hans Sama", "Steven Liv", "FR", "Bot", "2024-01", 1999],
    ["Labrov", "Labros Papoutsakis", "GR", "Support", "2025-01", 2002],
  ],
  tes: [
    ["369", "Bai Jia-Hao", "CN", "Top", "2021-11", 2001],
    ["Tian", "Gao Tian-Liang", "CN", "Jungle", "2024-11", 2000],
    ["Creme", "Lin Jian", "CN", "Mid", "2024-01", 2003],
    ["JackeyLove", "Yu Wen-Bo", "CN", "Bot", "2023-11", 2000],
    ["Meiko", "Tian Ye", "CN", "Support", "2023-11", 1998],
  ],
  flyquest: [
    ["Bwipo", "Gabriël Rau", "BE", "Top", "2024-01", 1999],
    ["Inspired", "Kacper Słoma", "PL", "Jungle", "2024-01", 2002],
    ["Quad", "Song Su-hyeong", "KR", "Mid", "2024-01", 2002],
    ["Massu", "Fahad Abdulmalek", "US", "Bot", "2024-01", 2004],
    ["Busio", "Alan Cwalina", "US", "Support", "2024-01", 2003],
  ],
};

const RL: Record<string, Row[]> = {
  kc: [
    ["Vatira", "", "FR", "Player", "2023-01", 2003],
    ["Atow.", "", "BE", "Player", "2024-01", 2004],
    ["Juicy", "", "DE", "Player", "2025-01", 2005],
  ],
  falcons: [
    ["Rw9", "", "SA", "Player", "2023-01", 2003],
    ["trk511", "", "SA", "Player", "2024-01", 2005],
    ["Kiileerrz", "", "SA", "Player", "2023-01", 2004],
  ],
  nrg: [
    ["Daniel", "", "US", "Player", "2022-07", 2005],
    ["BeastMode", "", "US", "Player", "2023-01", 2004],
    ["Atomic", "", "US", "Player", "2024-07", 2003],
  ],
  vitality: [
    ["ExoTiiK", "", "FR", "Player", "2024-01", 2004],
    ["Zen", "", "FR", "Player", "2023-01", 2007],
    ["Alpha54", "", "FR", "Player", "2024-07", 2004],
  ],
  furia: [
    ["drufinho", "", "BR", "Player", "2023-01", 2004],
    ["yanxnz", "", "BR", "Player", "2023-01", 2005],
    ["Lostt", "", "BR", "Player", "2024-01", 2005],
  ],
  ssg: [
    ["Retals", "", "US", "Player", "2023-07", 2002],
    ["Arsenal", "", "US", "Player", "2023-07", 2002],
    ["Chronic", "", "CA", "Player", "2024-07", 2004],
  ],
  gm: [
    ["Rise", "", "NL", "Player", "2024-07", 2003],
    ["M0nkey M00n", "", "FR", "Player", "2024-07", 2001],
    ["Itachi", "", "FR", "Player", "2025-01", 2006],
  ],
  g2: [
    ["Chicago", "", "US", "Player", "2022-01", 2001],
    ["dreaz", "", "US", "Player", "2024-01", 2004],
    ["Wahvey", "", "US", "Player", "2025-01", 2005],
  ],
  tm: [
    ["Ahmad", "", "SA", "Player", "2024-01", 2004],
    ["oKhaliD", "", "SA", "Player", "2024-01", 2005],
    ["Senzo", "", "SA", "Player", "2025-01", 2006],
  ],
  geekay: [
    ["Nwpo", "", "SA", "Player", "2024-01", 2004],
    ["Kv1", "", "SA", "Player", "2024-01", 2005],
    ["Dralii", "", "OM", "Player", "2025-01", 2006],
  ],
  dignitas: [
    ["ApparentlyJack", "", "GB", "Player", "2022-01", 2002],
    ["Joyo", "", "GB", "Player", "2023-01", 2003],
    ["Seikoo", "", "FR", "Player", "2024-01", 2005],
  ],
  wc: [
    ["Torsos", "", "US", "Player", "2024-01", 2003],
    ["Rapid", "", "US", "Player", "2024-01", 2004],
    ["2Piece", "", "US", "Player", "2025-01", 2006],
  ],
  ultimates: [
    ["Archie", "", "GB", "Player", "2024-01", 2006],
    ["Oaly", "", "GB", "Player", "2024-01", 2005],
    ["Tox", "", "GB", "Player", "2025-01", 2005],
  ],
  nip: [
    ["Reysbull", "", "BR", "Player", "2024-01", 2004],
    ["Swiftt", "", "BR", "Player", "2024-01", 2005],
    ["CaioTG1", "", "BR", "Player", "2025-01", 2005],
  ],
  mibr: [
    ["Bruno", "", "BR", "Player", "2024-01", 2004],
    ["Kv", "", "BR", "Player", "2024-01", 2005],
    ["Motta", "", "BR", "Player", "2025-01", 2006],
  ],
  pwr: [
    ["Torment", "", "AU", "Player", "2023-01", 2003],
    ["fever", "", "AU", "Player", "2024-01", 2004],
    ["Bananahead", "", "NZ", "Player", "2025-01", 2005],
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Player ids are `<prefix>-<handle>`, so a player who changed teams stays one person. */
export function playerId(prefix: string, handle: string): string {
  return `${prefix}-${slug(handle)}`;
}

function build(discipline: DisciplineId, prefix: string, table: Record<string, Row[]>) {
  const players: Player[] = [];
  const stints: Stint[] = [];
  for (const [team, rows] of Object.entries(table)) {
    for (const [handle, name, country, role, joined, born] of rows) {
      const id = playerId(prefix, handle);
      // Birth years are deliberately not published: a guessed age is a fabricated fact.
      void born;
      players.push({
        kind: "player",
        id,
        discipline,
        handle,
        name: name || undefined,
        country,
        role,
      });
      stints.push({
        id: `${id}-${team}-stint`,
        playerId: id,
        teamId: `${prefix}-${team}`,
        role,
        from: `${joined}-01`,
      });
    }
  }
  return { players, stints };
}

export const cs2Rosters = build("cs2", "cs2", CS2);
export const lolRosters = build("lol", "lol", LOL);
export const rlRosters = build("rocket-league", "rl", RL);

/** How much more than average each player tends to frag or carry. Default 1. */
export const IMPACT: Record<string, number> = {
  zywoo: 1.38,
  donk: 1.42,
  m0nesy: 1.3,
  niko: 1.18,
  sh1ro: 1.2,
  "910": 1.15,
  torzsi: 1.12,
  ropz: 1.12,
  b1t: 1.08,
  w0nderful: 1.12,
  broky: 1.08,
  kscerato: 1.12,
  xantares: 1.15,
  flamez: 1.05,
  apex: 0.86,
  chopper: 0.82,
  karrigan: 0.8,
  aleksib: 0.84,
  fallen: 0.9,
  maj3r: 0.85,
  faker: 1.12,
  chovy: 1.2,
  ruler: 1.15,
  knight: 1.18,
  caps: 1.1,
  viper: 1.12,
  zeka: 1.08,
};
