import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { DatabaseGate } from "./DatabaseGate";
import { router } from "./router";
import "./index.css";

// The database is local and only this window writes to it, so cached data never goes stale
// on its own — mutations invalidate exactly what they change. (Judges on the network write results
// too: useCompetitionResults polls for those.)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Animated icons follow the OS "reduce motion" setting, like the CSS animations do. */}
      <MotionConfig reducedMotion="user">
        <DatabaseGate>
          <RouterProvider router={router} />
        </DatabaseGate>
      </MotionConfig>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
