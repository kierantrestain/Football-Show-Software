import type { ComparisonSubject, Competition, Match, Metric, Panelist, Prediction, Source, Standing, Team } from './model'

export const demoSource: Source = { kind: 'demo', label: 'Demonstration data · fictional' }
const officialSeason: Source = { kind: 'official', label: 'Premier League · final 2023/24 records', url: 'https://www.premierleague.com/en/news/4029023', updatedAt: '2024-05-28' }
export const competitions: Competition[] = [
  { id: 'PL', label: 'Premier League' }, { id: 'CL', label: 'UEFA Champions League' },
  { id: 'EL', label: 'UEFA Europa League' }, { id: 'PD', label: 'La Liga' },
  { id: 'BL1', label: 'Bundesliga' }, { id: 'SA', label: 'Serie A' }, { id: 'FL1', label: 'Ligue 1' },
]
const roles433 = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'ST', 'LW']
const roles4231 = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'DM', 'RW', 'AM', 'LW', 'ST']
function makeTeam(id: string, name: string, color: string, formation: string, players: string[], bench: string[]): Team {
  const roles = formation === '4-2-3-1' ? roles4231 : roles433
  const numbers = formation === '4-2-3-1' ? [1, 2, 4, 5, 3, 6, 8, 7, 10, 11, 9] : [1, 2, 4, 5, 3, 6, 8, 10, 7, 9, 11]
  return {
    id, name, shortName: id.toUpperCase(), color, formation,
    players: players.map((player, index) => ({ id: `${id}-${numbers[index]}`, name: player, number: numbers[index], position: roles[index] })),
    bench: bench.map((player, index) => ({ id: `${id}-${20 + index}`, name: player, number: 20 + index, position: ['GK', 'DF', 'MF', 'FW'][index] })),
  }
}
export const demoTeams = [
  makeTeam('nbr', 'Northbridge FC', '#f36c62', '4-3-3',
    ['Eli Mercer', 'Jude Marsh', 'Isaac Ford', 'Kieran Holt', 'Cameron Dale', 'Leo Grant', 'Evan Foster', 'Noah Blake', 'Kai Voss', 'Owen Reeves', 'Finn Cole'],
    ['Miles Fox', 'Noah Reed', 'Felix Moss', 'Sam Blake']),
  makeTeam('sbc', 'Southbank City', '#68a9fc', '4-2-3-1',
    ['Milo Ellis', 'Arlo Cross', 'Theo Hayes', 'Oscar Lowe', 'Lucas Flynn', 'Max Shaw', 'Luca Wells', 'Axel King', 'Rory Lane', 'Nico Clarke', 'Ari Quinn'],
    ['Mika Park', 'Alex North', 'Oscar Finn', 'Aaron Holt']),
  makeTeam('rbk', 'Redbridge Town', '#d6ae57', '4-3-3',
    ['Finn Abbott', 'Glen Hart', 'Omar Lowe', 'Tariq Shaw', 'Jamie Kent', 'Aaron Rose', 'Elio Thomas', 'Jules Park', 'Zac Gray', 'Liam Bell', 'Kieran Flynn'],
    ['Zak Miller', 'Drew Moore', 'Leo Snow', 'Eden Khan']),
  makeTeam('vle', 'Vale Athletic', '#91cb91', '4-2-3-1',
    ['Erik Bell', 'Ike White', 'Leo Black', 'Hugo Ashe', 'Tomas Long', 'Owen Ross', 'Nate Ward', 'Marco Bell', 'Jalen King', 'Yuri Day', 'Evan Hill'],
    ['Noah Grant', 'Luis Good', 'Zane Cook', 'Vinny Dale']),
]
const [northside, acre, redbridge, vale] = demoTeams
const demoKickoff = new Date()
demoKickoff.setUTCHours(19, 45, 0, 0)
function fixtureDate(days: number) {
  return new Date(demoKickoff.getTime() + days * 86400000).toISOString()
}
const demoSeason = '2026/27'
export const demoMatches: Match[] = [
  {
    id: 'demo-feature', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(-3), status: 'finished',
    home: northside, away: acre, score: [2, 1], venue: 'Northfield Ground', round: 12, source: demoSource,
    moments: [
      { id: 'm1', minute: 18, kind: 'Press', title: 'Pressing trap on the right', description: 'Northbridge close the inside lane and force the build-up towards the touchline.', teamId: northside.id },
      { id: 'm2', minute: 32, kind: 'Goal', title: 'Owen Reeves opens the scoring', description: 'Leo Grant finds Kai Voss behind the full-back. Voss squares the ball for Reeves.', teamId: northside.id },
      { id: 'm3', minute: 52, kind: 'Goal', title: 'Southbank equalise in transition', description: 'Southbank break through the inside-left channel after recovering possession.', teamId: acre.id },
      { id: 'm4', minute: 67, kind: 'Substitution', title: 'Felix Moss replaces Noah Blake', description: 'Moss takes the left-sided midfield role.', teamId: northside.id, playerIn: northside.bench?.[2], playerOut: 'nbr-10' },
      { id: 'm5', minute: 76, kind: 'Goal', title: 'Finn Cole finds the winner', description: 'Cole arrives at the back post after a quick switch of play.', teamId: northside.id },
    ],
    stats: [
      { label: 'Possession', home: 54, away: 46, unit: '%' },
      { label: 'Shots', home: 15, away: 9 }, { label: 'Shots on target', home: 6, away: 3 },
      { label: 'Corners', home: 7, away: 4 }, { label: 'Saves', home: 2, away: 4 },
      { label: 'Expected goals', home: null, away: null },
    ],
    notes: 'Northbridge’s front three directed the build-up outside. A quick switch after Southbank’s equaliser exposed the far-side full-back.',
  },
  { id: 'demo-fixture-1', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(3), status: 'scheduled', home: northside, away: vale, venue: 'Northfield Ground', round: 13, source: demoSource, moments: [], stats: [], notes: 'Northbridge’s high press meets Vale’s double pivot. Watch the passing lane between the two holding midfielders.' },
  { id: 'demo-fixture-2', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(4), status: 'scheduled', home: acre, away: redbridge, venue: 'Southbank Stadium', round: 13, source: demoSource, moments: [], stats: [] },
  { id: 'demo-result-2', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(-4), status: 'finished', home: redbridge, away: vale, score: [1, 1], venue: 'Redbridge Park', round: 12, source: demoSource, moments: [], stats: [] },
  { id: 'demo-result-3', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(-11), status: 'finished', home: vale, away: northside, score: [0, 2], venue: 'Vale Stadium', round: 11, source: demoSource, moments: [], stats: [] },
  { id: 'demo-result-4', competition: 'Premier Division', season: demoSeason, kickoff: fixtureDate(-11), status: 'finished', home: redbridge, away: acre, score: [2, 0], venue: 'Redbridge Park', round: 11, source: demoSource, moments: [], stats: [] },
]
const tableValues = [[12, 8, 3, 1, 14, 27], [12, 6, 4, 2, 7, 22], [12, 5, 4, 3, 3, 19], [12, 4, 3, 5, -1, 15]]
export const demoStandings: Standing[] = [northside, redbridge, acre, vale].map((team, index) => {
  const [played, wins, draws, losses, goalDifference, points] = tableValues[index]
  return { rank: index + 1, team, played, wins, draws, losses, goalDifference, points }
})

export const playerMetrics: Metric[] = [
  { key: 'played', label: 'Appearances', definition: 'Matches in which the player appeared.' },
  { key: 'minutes', label: 'Minutes', definition: 'Minutes played in the selected competition.' },
  { key: 'starts', label: 'Starts', definition: 'Matches in the starting XI.' },
  { key: 'goals', label: 'Goals', definition: 'Goals credited to the player.', per90: true },
  { key: 'assists', label: 'Assists', definition: 'Assists credited by the provider.', per90: true },
  { key: 'involvements', label: 'Goal involvements', definition: 'Goals plus assists.', per90: true },
  { key: 'shots', label: 'Shots', definition: 'Total shot attempts.', per90: true },
  { key: 'shotsOnTarget', label: 'Shots on target', definition: 'Attempts on target.', per90: true },
  { key: 'xg', label: 'Expected goals', definition: 'Sum of modelled goal probabilities for shots.', per90: true },
  { key: 'xa', label: 'Expected assists', definition: 'Provider-modelled likelihood of passes becoming assists.', per90: true },
  { key: 'keyPasses', label: 'Key passes', definition: 'Passes directly leading to shots.', per90: true },
  { key: 'progressivePasses', label: 'Progressive passes', definition: 'Forward passes meeting the provider’s progress threshold.', per90: true },
  { key: 'progressiveCarries', label: 'Progressive carries', definition: 'Carries meeting the provider’s progress threshold.', per90: true },
  { key: 'passRate', label: 'Pass completion', unit: '%', definition: 'Share of attempted passes that were completed.' },
  { key: 'chances', label: 'Chances created', definition: 'Provider-credited chances created.', per90: true },
  { key: 'bigChances', label: 'Big chances created', definition: 'Provider-credited high-quality chances created.', per90: true },
  { key: 'touches', label: 'Touches', definition: 'Recorded touches of the ball.', per90: true },
  { key: 'duels', label: 'Duels won', definition: 'Challenges won against an opponent.', per90: true },
  { key: 'tackles', label: 'Tackles', definition: 'Recorded tackles.', per90: true },
  { key: 'interceptions', label: 'Interceptions', definition: 'Times the player cut out an opposition pass.', per90: true },
  { key: 'blocks', label: 'Blocks', definition: 'Recorded defensive blocks.', per90: true },
  { key: 'recoveries', label: 'Recoveries', definition: 'Times possession was recovered.', per90: true },
  { key: 'dribbles', label: 'Dribbles completed', definition: 'Successful attempts to beat an opponent with the ball.', per90: true },
  { key: 'aerials', label: 'Aerial duels won', definition: 'Challenges for an airborne ball won.', per90: true },
  { key: 'saves', label: 'Saves', definition: 'Shots prevented by a goalkeeper.', per90: true },
  { key: 'goalsPrevented', label: 'Goals prevented', definition: 'Post-shot expected goals faced minus goals conceded.', per90: true },
  { key: 'cleanSheets', label: 'Clean sheets', definition: 'Matches with no goals conceded credited by the provider.' },
  { key: 'cards', label: 'Cards', definition: 'Recorded cards.', per90: true },
]
export const teamMetrics: Metric[] = [
  { key: 'played', label: 'Matches played', definition: 'Completed league matches.' },
  { key: 'points', label: 'Points', definition: 'Competition points earned.' },
  { key: 'wins', label: 'Wins', definition: 'League matches won.' },
  { key: 'draws', label: 'Draws', definition: 'League matches drawn.' },
  { key: 'losses', label: 'Losses', definition: 'League matches lost.' },
  { key: 'goalDifference', label: 'Goal difference', definition: 'Goals scored minus goals conceded.' },
  { key: 'goals', label: 'Goals for', definition: 'Goals scored.' },
  { key: 'conceded', label: 'Goals against', definition: 'Goals conceded.' },
  { key: 'winRate', label: 'Win rate', unit: '%', definition: 'Percentage of matches won.' },
]
export const officialPlayers: ComparisonSubject[] = [
  { id: 'palmer', name: 'Cole Palmer', subtitle: 'Chelsea · attacking midfielder', club: 'Chelsea', position: 'Attacking midfield', color: '#68a9fc', stats: { played: 34, goals: 22, assists: 11, involvements: 33 }, source: officialSeason },
  { id: 'de-bruyne', name: 'Kevin De Bruyne', subtitle: 'Manchester City · midfielder', club: 'Manchester City', position: 'Attacking midfield', color: '#79c6d9', stats: { played: 18, goals: 4, assists: 10, involvements: 14, bigChances: 21 }, source: { ...officialSeason, url: 'https://www.mancity.com/annualreport2024/mens-team/' } },
  { id: 'foden', name: 'Phil Foden', subtitle: 'Manchester City · attacking midfielder', club: 'Manchester City', position: 'Attacking midfield', color: '#f0ad61', stats: { played: 35, goals: 19, assists: 8, involvements: 27 }, source: officialSeason },
  { id: 'rodri', name: 'Rodri', subtitle: 'Manchester City · defensive midfielder', club: 'Manchester City', position: 'Defensive midfield', color: '#bcabfb', stats: { played: 34, goals: 8, assists: 9, involvements: 17 }, source: officialSeason },
  { id: 'watkins', name: 'Ollie Watkins', subtitle: 'Aston Villa · forward', club: 'Aston Villa', position: 'Forward', color: '#e788aa', stats: { played: 37, goals: 19, assists: 13, involvements: 32 }, source: officialSeason },
  { id: 'haaland', name: 'Erling Haaland', subtitle: 'Manchester City · forward', club: 'Manchester City', position: 'Forward', color: '#b4d782', stats: { played: 31, goals: 27, assists: 5, involvements: 32 }, source: officialSeason },
]
const officialTable: Source = { ...officialSeason, label: 'Premier League · 2023/24 final table', url: 'https://resources.premierleague.pulselive.com/premierleague/document/2025/07/24/99839920-d274-42aa-a2ac-e5612b4f6c61/PL_Handbook_25-26_Digital_24.07.pdf' }
const officialTeams: [string, string, number, number, number, number, number, number][] = [
  ['Manchester City', '#79c6d9', 28, 7, 3, 96, 34, 91],
  ['Arsenal', '#ed746f', 28, 5, 5, 91, 29, 89],
  ['Liverpool', '#f4a77b', 24, 10, 4, 86, 41, 82],
  ['Aston Villa', '#e788aa', 20, 8, 10, 76, 61, 68],
  ['Tottenham Hotspur', '#b4d782', 20, 6, 12, 74, 61, 66],
]
export const officialTeamStats: ComparisonSubject[] = officialTeams.map(([name, color, wins, draws, losses, goals, conceded, points], index) => ({
  id: `club-${index}`, name, subtitle: 'Premier League · 2023/24', color, stats: { played: 38, wins, draws, losses, goals, conceded, points, goalDifference: goals - conceded, winRate: wins / 38 * 100 }, source: officialTable,
}))
export const demoPlayerStats: ComparisonSubject[] = [
  { id: 'nbr-6', name: 'Leo Grant', subtitle: 'Northbridge FC · defensive midfielder', club: northside.name, position: 'Defensive midfield', color: northside.color, stats: { played: 12, minutes: 1020, starts: 12, goals: 2, assists: 5, involvements: 7, shots: 15, shotsOnTarget: 6, keyPasses: 28, passRate: 91.3, touches: 880, tackles: 24, interceptions: 18 } },
  { id: 'nbr-8', name: 'Evan Foster', subtitle: 'Northbridge FC · central midfielder', club: northside.name, position: 'Central midfield', color: '#f0ad61', stats: { played: 10, minutes: 770, starts: 9, goals: 3, assists: 3, involvements: 6, shots: 21, shotsOnTarget: 9, keyPasses: 16, passRate: 87.2, touches: 602, tackles: 21, interceptions: 12 } },
  { id: 'sbc-10', name: 'Rory Lane', subtitle: 'Southbank City · attacking midfielder', club: acre.name, position: 'Attacking midfield', color: acre.color, stats: { played: 11, minutes: 890, starts: 10, goals: 4, assists: 4, involvements: 8, shots: 24, shotsOnTarget: 13, keyPasses: 23, passRate: 84.5, touches: 620, tackles: 13, interceptions: 8 } },
  { id: 'nbr-9', name: 'Owen Reeves', subtitle: 'Northbridge FC · forward', club: northside.name, position: 'Forward', color: '#e788aa', stats: { played: 12, minutes: 1034, starts: 12, goals: 9, assists: 2, involvements: 11, shots: 39, shotsOnTarget: 20, keyPasses: 12, passRate: 77.2, touches: 419, tackles: 8, interceptions: 4 } },
].map(player => ({ ...player, source: demoSource }))

export const demoTeamStats: ComparisonSubject[] = demoStandings.map(({ team, played, wins, draws, losses, points, goalDifference }) => ({
  id: team.id, name: team.name, color: team.color, subtitle: 'Premier Division · 2026/27',
  stats: { played, wins, draws, losses, points, goalDifference, winRate: wins / played * 100 }, source: demoSource,
}))
export const demoPanel: Panelist[] = [{ id: 'ana', name: 'Ana' }, { id: 'james', name: 'James' }, { id: 'ellis', name: 'Ellis' }]
export const demoPredictions: Prediction[] = [
  { matchId: 'demo-feature', panelistId: 'ana', home: 2, away: 1, notes: 'Northbridge edge a close game.', submittedAt: fixtureDate(-5) },
  { matchId: 'demo-feature', panelistId: 'james', home: 1, away: 0, notes: '', submittedAt: fixtureDate(-5) },
  { matchId: 'demo-feature', panelistId: 'ellis', home: 1, away: 1, notes: '', submittedAt: fixtureDate(-4) },
]
