import type { FixtureTeam } from './fixtureSnapshot'

// Each provider ID is paired with its audited source spelling and a club identity shared across competitions.
const openLigaAliases: Record<number, [string, string, string, string, string]> = {
  6: ["Bayer 04 Leverkusen", "bayer-leverkusen", "Bayer Leverkusen", "B04", "#8797ae"],
  7: ["Borussia Dortmund", "borussia-dortmund", "Borussia Dortmund", "BVB", "#8797ae"],
  16: ["VfB Stuttgart", "vfb-stuttgart", "VfB Stuttgart", "STU", "#8797ae"],
  40: ["FC Bayern München", "bayern-munchen", "Bayern München", "BAY", "#d15a5e"],
  175: ["TSG Hoffenheim", "hoffenheim", "Hoffenheim", "TSG", "#8797ae"],
  356: ["FC Barcelona", "barcelona", "Barcelona", "BAR", "#8264c9"],
  364: ["Chelsea FC", "chelsea", "Chelsea", "CHE", "#547bdb"],
  366: ["Fenerbahçe SK", "fenerbahce", "Fenerbahçe", "FEN", "#8797ae"],
  369: ["Juventus Turin", "juventus", "Juventus", "JUV", "#d1d1d6"],
  370: ["FC Liverpool", "liverpool", "Liverpool", "LIV", "#d44755"],
  375: ["FC Porto", "porto", "Porto", "POR", "#8797ae"],
  376: ["PSV Eindhoven", "psv-eindhoven", "PSV Eindhoven", "PSV", "#8797ae"],
  378: ["AS Rom", "roma", "Roma", "ROM", "#b66763"],
  382: ["Villarreal CF", "villarreal", "Villarreal", "VIL", "#8797ae"],
  436: ["Olympiakos Piräus", "olympiacos", "Olympiacos", "OLY", "#8797ae"],
  438: ["Aston Villa", "aston-villa", "Aston Villa", "AVL", "#aa526b"],
  441: ["AC Mailand", "milan", "Milan", "MIL", "#d45453"],
  443: ["NEC Nijmegen", "n-e-c-nijmegen", "N.E.C. Nijmegen", "NEC", "#8797ae"],
  449: ["Lech Poznan", "lech-poznan", "Lech Poznań", "LPO", "#8797ae"],
  452: ["Tottenham Hotspur FC", "tottenham-hotspur", "Tottenham Hotspur", "TOT", "#e0e1e9"],
  541: ["Everton FC", "everton", "Everton", "EVE", "#5076d6"],
  546: ["Sunderland AFC", "sunderland", "Sunderland", "SUN", "#d15d59"],
  549: ["Fulham FC", "fulham", "Fulham", "FUL", "#ddd9d0"],
  632: ["Jagiellonia Bialystok", "jagiellonia-biaystok", "Jagiellonia Białystok", "JAG", "#8797ae"],
  727: ["AZ Alkmaar", "az-alkmaar", "AZ Alkmaar", "AZA", "#8797ae"],
  733: ["Inter Mailand", "inter", "Inter", "INT", "#8797ae"],
  1075: ["Newcastle United FC", "newcastle-united", "Newcastle United", "NEW", "#c5c8d0"],
  1133: ["Real Madrid", "real-madrid", "Real Madrid", "RMA", "#e8e4db"],
  1186: ["Shakhtar Donetsk", "shakhtar-donetsk", "Shakhtar Donetsk", "SHA", "#8797ae"],
  1201: ["RB Salzburg", "salzburg", "Salzburg", "SAL", "#8797ae"],
  1204: ["Lille OSC", "lille", "Lille", "LIL", "#8797ae"],
  1205: ["Sporting CP", "sporting-cp", "Sporting CP", "SCP", "#8797ae"],
  1206: ["Levski Sofia", "levski-sofia", "Levski Sofia", "LEV", "#8797ae"],
  1208: ["Dinamo Zagreb", "dinamo-zagreb", "Dinamo Zagreb", "DZG", "#8797ae"],
  1210: ["FC Brügge", "club-brugge", "Club Brugge", "BRU", "#8797ae"],
  1216: ["RSC Anderlecht", "anderlecht", "Anderlecht", "AND", "#8797ae"],
  1217: ["AEK Athen", "aek-athens", "AEK Athens", "AEK", "#8797ae"],
  1275: ["Real Sociedad", "real-sociedad", "Real Sociedad", "RSO", "#8797ae"],
  1472: ["Lillestrøm SK", "lillestrom", "Lillestrøm", "LSK", "#8797ae"],
  1484: ["Viking", "viking", "Viking", "VIK", "#8797ae"],
  1635: ["RB Leipzig", "rb-leipzig", "RB Leipzig", "RBL", "#8797ae"],
  1770: ["Feyenoord Rotterdam", "feyenoord", "Feyenoord", "FEY", "#8797ae"],
  1804: ["Real Betis", "real-betis", "Real Betis", "BET", "#8797ae"],
  1816: ["Benfica Lissabon", "benfica", "Benfica", "BEN", "#c55b61"],
  1819: ["Olympique Lyon", "lyon", "Lyon", "LYO", "#8797ae"],
  1837: ["Besiktas Istanbul", "besiktas", "Beşiktaş", "BES", "#8797ae"],
  2175: ["Celta Vigo", "celta-vigo", "Celta Vigo", "CEL", "#8797ae"],
  2281: ["Paris St. Germain", "paris-saint-germain", "Paris Saint-Germain", "PSG", "#707bd9"],
  2331: ["SSC Napoli", "napoli", "Napoli", "NAP", "#8797ae"],
  2489: ["Crystal Palace FC", "crystal-palace", "Crystal Palace", "CRY", "#6e73da"],
  2491: ["Sturm Graz", "sturm-graz", "Sturm Graz", "STG", "#8797ae"],
  2554: ["Galatasaray Istanbul", "galatasaray", "Galatasaray", "GAL", "#8797ae"],
  2556: ["Manchester United FC", "manchester-united", "Manchester United", "MUN", "#d34b51"],
  2557: ["Olympique Marseille", "marseille", "Marseille", "MAR", "#8797ae"],
  2617: ["FC Arsenal", "arsenal", "Arsenal", "ARS", "#df5554"],
  2804: ["Celtic Glasgow", "celtic", "Celtic", "CTC", "#68a877"],
  2942: ["AFC Bournemouth", "afc-bournemouth", "AFC Bournemouth", "BOU", "#d3565a"],
  4199: ["Sparta Prag", "sparta-praha", "Sparta Praha", "SPP", "#8797ae"],
  4241: ["Atletico Madrid", "atletico-madrid", "Atlético Madrid", "ATM", "#8797ae"],
  4244: ["Manchester City", "manchester-city", "Manchester City", "MCI", "#74b5e6"],
  4462: ["Hapoel Beer Scheva", "hapoel-beer-sheva", "Hapoel Beer-Sheva", "HBS", "#8797ae"],
  4468: ["Viktoria Pilsen", "viktoria-plzen", "Viktoria Plzeň", "PLZ", "#8797ae"],
  4578: ["Slavia Prag", "slavia-praha", "Slavia Praha", "SLP", "#8797ae"],
  4639: ["Stade Rennes", "rennes", "Rennes", "REN", "#8797ae"],
  4825: ["Union Saint-Gilloise", "union-saint-gilloise", "Union Saint-Gilloise", "USG", "#8797ae"],
  5139: ["LASK", "lask", "LASK", "LAS", "#8797ae"],
  5250: ["Ferencváros Budapest", "ferencvaros", "Ferencváros", "FTC", "#8797ae"],
  5699: ["Slovan Bratislava", "slovan-bratislava", "Slovan Bratislava", "SLO", "#8797ae"],
  5705: ["Omonia Nikosia", "omonia", "Omonia", "OMO", "#8797ae"],
  5707: ["FK Bodö/Glimt", "bodo-glimt", "Bodø/Glimt", "BOD", "#8797ae"],
  5962: ["RC Lens", "lens", "Lens", "LEN", "#8797ae"],
  5967: ["Brentford F.C.", "brentford", "Brentford", "BRE", "#dc6165"],
  8787: ["Como 1907", "como-1907", "Como 1907", "COM", "#8797ae"],
  8790: ["Brighton & Hove Albion", "brighton-hove-albion", "Brighton & Hove Albion", "BHA", "#5387e3"],
  8791: ["Hull City", "hull-city", "Hull City", "HUL", "#e9a25e"],
  8792: ["Leeds United", "leeds-united", "Leeds United", "LEE", "#e1dfd1"],
  8793: ["Nottingham Forest", "nottingham-forest", "Nottingham Forest", "NFO", "#d8535b"],
  8794: ["Sunderland", "sunderland", "Sunderland", "SUN", "#d15d59"],
  8795: ["Coventry City", "coventry-city", "Coventry City", "COV", "#77afce"],
  8796: ["Ipswich Town", "ipswich-town", "Ipswich Town", "IPS", "#577bce"],
  8798: ["Sabah", "sabah", "Sabah", "SAB", "#8797ae"],
  8811: ["OFI Kreta", "ofi-crete", "OFI Crete", "OFI", "#8797ae"],
  8876: ["FC Ararat-Armenia", "ararat-armenia", "Ararat-Armenia", "ARA", "#8797ae"],
  8877: ["SC União Torreense", "torreense", "Torreense", "TOR", "#8797ae"],
  8885: ["NK Celje", "celje", "Celje", "CLJ", "#8797ae"],
}

function normalizedName(value: string) {
  return value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function club(alias: [string, string, string, string, string]): FixtureTeam {
  const [, id, name, shortName, color] = alias
  return { id, name, shortName, color }
}

export function openLigaClub(id: number, name: string): FixtureTeam {
  const alias = openLigaAliases[id]
  if (!alias || normalizedName(alias[0]) !== normalizedName(name)) {
    throw new Error('Unmapped OpenLigaDB club ' + id + ' (' + name + '). Review its identity mapping.')
  }
  return club(alias)
}

export function clubByName(name: string): FixtureTeam | undefined {
  const normalized = normalizedName(name)
  const aliases = Object.values(openLigaAliases).filter(alias => [alias[0], alias[2]].some(candidate => normalizedName(candidate) === normalized))
  return aliases.length && aliases.every(alias => alias[1] === aliases[0][1]) ? club(aliases[0]) : undefined
}
