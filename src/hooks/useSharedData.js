import { useQuery } from "@tanstack/react-query";
import {recordQueryOptions} from "@/api/recordQueries";

/**
 * MF LEGACY — Shared data cache via TanStack React Query.
 *
 * These hooks fetch raw entity lists and cache them in memory with
 * consistent query keys. When the user navigates between Players and
 * Teams, the cached data is returned instantly (stale-while-revalidate)
 * while a background refresh runs if the data is stale.
 *
 * After any mutation (create / update / delete / import), call
 * queryClient.invalidateQueries({ queryKey: ['mf-legacy', '<entity>'] })
 * to trigger a background refetch so the cache stays fresh.
 */

export const useCountriesQuery=()=>useQuery(recordQueryOptions('Country'));
export const useLeaguesQuery=()=>useQuery(recordQueryOptions('League'));
export const useTeamsQuery=()=>useQuery(recordQueryOptions('Team'));
export const usePlayersQuery=()=>useQuery(recordQueryOptions('Player'));
export const useTeamLeaguesQuery=()=>useQuery(recordQueryOptions('TeamLeague'));