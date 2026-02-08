import { TimeOfDay, Weather } from "../types/game";

export const WEATHER_STATES: Weather[] = ["clear", "rain", "storm", "fog", "heat"];
export const TIME_STATES: TimeOfDay[] = ["dawn", "morning", "afternoon", "evening", "night"];

export const STARTING_INVENTORY = {
  trail_ration: 3,
  automon_chow: 4,
  bait: 4,
  basic_trap: 2,
  quick_berries_seed: 2,
};
