import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export default function App() {
  const { data, isLoading, isError } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.get<HealthResponse>("/health");
      return response.data;
    },
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">NexusOps AI</h1>
        <div className="text-lg">
          {isLoading && (
            <span className="text-slate-600 font-medium">API: checking ...</span>
          )}
          {!isLoading && isError && (
            <span className="text-red-600 font-semibold">API: unreachable</span>
          )}
          {!isLoading && !isError && data?.status === "ok" && (
            <span className="text-green-600 font-semibold">API: connected</span>
          )}
        </div>
      </div>
    </div>
  );
}
