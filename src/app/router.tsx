import { createHashRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AthletesPage } from "@/features/athletes/AthletesPage";
import { CategoriesPage } from "@/features/categories/CategoriesPage";
import { ExercisesPage } from "@/features/exercises/ExercisesPage";
import { CompetitionsPage } from "@/features/competitions/CompetitionsPage";
import { CompetitionDetailPage } from "@/features/competitions/detail/CompetitionDetailPage";

// Hash routing: the bundled app is served from a custom protocol with no server-side fallback,
// so a path-based URL would not survive a reload.
export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/competitions" replace /> },
      { path: "competitions", element: <CompetitionsPage /> },
      { path: "competitions/:competitionId", element: <CompetitionDetailPage /> },
      { path: "athletes", element: <AthletesPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "exercises", element: <ExercisesPage /> },
    ],
  },
]);
