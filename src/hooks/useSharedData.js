import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

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

const getList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.results)) return result.results;
  return [];
};

const STALE_TIME = 5 * 60 * 1000;

export function useCountriesQuery() {
  return useQuery({
    queryKey: ["mf-legacy", "countries"],
    queryFn: async () => {
      const result = await base44.entities.Country.list();
      return getList(result);
    },
    staleTime: STALE_TIME,
  });
}

export function useLeaguesQuery() {
  return useQuery({
    queryKey: ["mf-legacy", "leagues"],
    queryFn: async () => {
      const result = await base44.entities.League.list();
      return getList(result);
    },
    staleTime: STALE_TIME,
  });
}

export function useTeamsQuery() {
  return useQuery({
    queryKey: ["mf-legacy", "teams"],
    queryFn: async () => {
      const result = await base44.entities.Team.list();
      return getList(result);
    },
    staleTime: STALE_TIME,
  });
}

export function usePlayersQuery() {
  return useQuery({
    queryKey: ["mf-legacy", "players"],
    queryFn: async () => {
      const result = await base44.entities.Player.list();
      return getList(result);
    },
    staleTime: STALE_TIME,
  });
}