import { queryOptions } from "@tanstack/react-query";
import { getPublicData } from "@/lib/public.functions";

export const publicDataQuery = queryOptions({
  queryKey: ["public-data"],
  queryFn: () => getPublicData(),
  staleTime: 60_000,
});
