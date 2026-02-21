export type WeaponType = "melee" | "ranged" | "magic";
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
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  initialHP: 100,
  initialMP: 100,
  mpRegenRate: 2,
  baseScrollSpeed: 200,
  speedIncreaseRate: 10,
  spawnInterval: 1500,
  bareHandDamage: 5,
};
