import type { DisciplineId } from "@bearing/domain";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * What a page is about, so the shell can colour itself: Arena picks its stage, every
 * direction sets `--tint`.
 */
export interface Mood {
  discipline?: DisciplineId;
  teamId?: string;
  tint?: string;
  deep?: string;
}

const MoodContext = createContext<{ mood: Mood; setMood: (m: Mood) => void }>({
  mood: {},
  setMood: () => {},
});

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<Mood>({});
  return <MoodContext.Provider value={{ mood, setMood }}>{children}</MoodContext.Provider>;
}

export function useMood(): Mood {
  return useContext(MoodContext).mood;
}

/** Declare the page's mood; resets when the page unmounts. */
export function useSetMood(m: Mood) {
  const { setMood } = useContext(MoodContext);
  const key = `${m.discipline ?? ""}|${m.teamId ?? ""}|${m.tint ?? ""}|${m.deep ?? ""}`;
  useEffect(() => {
    setMood(m);
    return () => setMood({});
    // The key captures every field of the mood.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setMood]);
}
