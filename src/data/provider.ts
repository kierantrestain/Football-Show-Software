import type { Match, Source, Standing, Team } from './model'

type DeskPayload = {
  configured: boolean
  message?: string
  error?: string
  stale?: boolean
  source?: Source
  matches?: Match[]
  match?: Match | null
  standings?: Standing[]
  team?: Team
}
export interface FootballProvider {
  matches(competition: string, season: string, signal?: AbortSignal): Promise<DeskPayload>
  match(id: string, signal?: AbortSignal): Promise<DeskPayload>
  standings(competition: string, season: string, signal?: AbortSignal): Promise<DeskPayload>
  squad(id: string, signal?: AbortSignal): Promise<DeskPayload>
}
async function read(params: Record<string, string>, signal?: AbortSignal): Promise<DeskPayload> {
  try {
    const response = await fetch(`/api/football?${new URLSearchParams(params)}`, { signal })
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      return { configured: false, message: 'The live provider is unavailable in this environment. Use the demo or official archive.' }
    }
    return await response.json() as DeskPayload
  } catch (error) {
    if (signal?.aborted) throw error
    return { configured: false, error: 'The match data service could not be reached.' }
  }
}
export const footballProvider: FootballProvider = {
  matches: (competition, season, signal) => read({ competition, season }, signal),
  match: (id, signal) => read({ section: 'match', id }, signal),
  standings: (competition, season, signal) => read({ section: 'standings', competition, season }, signal),
  squad: (id, signal) => read({ section: 'squad', id }, signal),
}
