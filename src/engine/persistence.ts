import fs from "node:fs";
import path from "node:path";
import { createInitialState } from "../data/seed";
import { GameState } from "../types/game";

const SAVE_PATH = path.resolve(process.cwd(), "save/game-state.json");

export const loadState = (): GameState => {
  if (!fs.existsSync(SAVE_PATH)) {
    const initial = createInitialState();
    saveState(initial);
    return initial;
  }
  const raw = fs.readFileSync(SAVE_PATH, "utf8");
  return JSON.parse(raw) as GameState;
};

export const saveState = (state: GameState): void => {
  fs.mkdirSync(path.dirname(SAVE_PATH), { recursive: true });
  fs.writeFileSync(SAVE_PATH, JSON.stringify(state, null, 2));
};
