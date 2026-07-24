import { createContext, useContext, type ReactNode } from "react";
import type { Capsule, DayPackage, NodeState } from "./types";

export type LearnerSessionState = {
  displayDay: number | null;
  week: number;
  progressPct: number;
  studyMinutes: number;
  dayPkg: DayPackage | null;
  activeNode: NodeState | null;
  learnCapsules: Capsule[];
  openCapsuleId: string | null;
  activeCapsule: Capsule | null;
  coachOpen: boolean;
  setCoachOpen: (open: boolean) => void;
};

const LearnerSessionContext = createContext<LearnerSessionState | null>(null);

export function LearnerSessionProvider({ value, children }: { value: LearnerSessionState; children: ReactNode }) {
  return <LearnerSessionContext.Provider value={value}>{children}</LearnerSessionContext.Provider>;
}

export function useLearnerSession(): LearnerSessionState | null {
  return useContext(LearnerSessionContext);
}

export function useLearnerSessionRequired(): LearnerSessionState {
  const ctx = useContext(LearnerSessionContext);
  if (!ctx) throw new Error("useLearnerSessionRequired must be used within LearnerSessionProvider");
  return ctx;
}
