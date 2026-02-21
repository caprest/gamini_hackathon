import rawGameBalance from "../game/gameBalance.json";

export type WeaponType = "melee" | "ranged" | "magic" | "heal";
export type WeaponRange = "short" | "medium" | "long";
export type Element = "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none";
export type AttackAnimation = "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam";

export interface WeaponData {
  weapon_name: string;
  type: WeaponType;
  damage: number;
  mp_cost: number;
  range: WeaponRange;
  element: Element;
  sprite_emoji: string;
  color: string;
  attack_animation: AttackAnimation;
  description: string;
  uniqueness_score: number;
  image_url?: string;
}

export interface PlayerState {
  hp: number;
  mp: number;
  score: number;
  currentWeapon: WeaponData | null;
  isCharging: boolean;
  isAlive: boolean;
}

export interface ObstacleConfig {
  type: "cactus_small" | "cactus_large" | "fire_wall" | "spike" | "pteranodon" | "boss";
  hp: number;
  damage: number;
  speed: number;
  sprite: string;
}

export interface GameConfig {
  initialHP: number;
  initialMP: number;
  mpRegenRate: number;     // MP/秒
  baseScrollSpeed: number;
  speedIncreaseRate: number;
  spawnInterval: number;   // ms
  bareHandDamage: number;
  meleeRecoveryMs: number; // 近接攻撃後の硬直時間
}

const toFiniteNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const gameBalance = rawGameBalance as Partial<GameConfig>;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  initialHP: toFiniteNumber(gameBalance.initialHP, 100),
  initialMP: toFiniteNumber(gameBalance.initialMP, 100),
  mpRegenRate: toFiniteNumber(gameBalance.mpRegenRate, 2),
  baseScrollSpeed: toFiniteNumber(gameBalance.baseScrollSpeed, 200),
  speedIncreaseRate: toFiniteNumber(gameBalance.speedIncreaseRate, 10),
  spawnInterval: toFiniteNumber(gameBalance.spawnInterval, 1500),
  bareHandDamage: toFiniteNumber(gameBalance.bareHandDamage, 5),
  meleeRecoveryMs: toFiniteNumber(gameBalance.meleeRecoveryMs, 100),
};
