import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

interface CurrentDateResponse {
  hijri: { day: number; month: number; year: number; display: string };
  gregorian: string;
}

export function useCurrentDate() {
  return useQuery<CurrentDateResponse>({
    queryKey: ["current-date"],
    queryFn: () => api.get("/date/").then((res) => res.data),
    staleTime: 60 * 60 * 1000, // refresh every hour
  });
}
