# 🚀 Antigravity IDE 向けプロンプト指示書

## このドキュメントの目的
Google Antigravity IDE にこのファイルを読み込ませて、ゲーム開発を効率的に進めるための指示書です。

---

## プロジェクト概要

**プロジェクト名**: ノージャンプダイナソー (No Jump Dinosaur)
**概要**: Google Chrome Dinosaur Game のリミックス。ジャンプしない恐竜が、プレイヤーの音声/テキスト入力からAI生成された武器で障害物を破壊して進むサイドスクロールゲーム。
**技術スタック**: Next.js 14 (App Router) + Phaser.js 3 + TypeScript + Gemini API + Banana API

---

## 開発ルール

1. **Next.js App Routerを使用**（Pages Routerは不可）
2. **TypeScript必須**（any禁止、型定義を types/game.ts に集約）
3. **Phaser.jsはdynamic importでSSR回避**
4. **API KeyはサーバーサイドのAPI Routesで管理**（クライアントに露出させない。Live APIのみ例外）
5. **Tailwind CSSでUI実装**（ゲーム部分はPhaserのCanvas）
6. **日本語コメント推奨**（デモ時に見せる可能性あり）

---

## 初期セットアップ手順

```bash
# プロジェクト作成
npx create-next-app@latest no-jump-dino --typescript --tailwind --app --src-dir=false

# ゲームエンジン
npm install phaser

# Gemini SDK
npm install @google/generative-ai

# その他
npm install zustand  # 状態管理（軽量）
```

---

## 型定義（最初に作成）

```typescript
// types/game.ts

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
```

---

## コア実装の優先順（Antigravityに伝える順序）

### Step 1: ゲーム基盤
「Next.js + Phaser.jsのサイドスクローラーを作って。地面が右から左にスクロールし、左端にプレイヤーキャラ（恐竜の絵文字でOK）が立っている。右端からサボテン障害物がスクロールしてくる。」

### Step 2: 攻撃メカニクス
「スペースキーを押したら攻撃アニメーション（前方に斬撃エフェクト）が出て、範囲内の障害物にダメージを与える。障害物のHPが0になったら破壊エフェクトと共に消える。衝突したらプレイヤーがダメージを受ける。」

### Step 3: HP/MP HUD
「画面上部にReactでHP/MPバーとスコアを表示する。PhaserのイベントバスでReactに値を送る。MPは攻撃で消費し、時間で回復する。」

### Step 4: Gemini武器生成
「テキスト入力欄を画面下部に配置。テキストを入力してEnterを押すと、/api/generate-weapon にPOST。AI応答待ちの間はキャラ周辺にチャージエフェクト（パーティクル）を表示。武器が生成されたら「READY!」表示。次のスペースキーでその武器の攻撃が発動。」

### Step 5: 音声入力
「マイクボタンを追加。クリックで音声認識開始。認識されたテキストを自動的に武器生成に送る。Gemini Live APIかWeb Speech APIを使用。」

### Step 6: キャラクター生成
「/create ページにテキスト入力欄。入力した説明文からBanana APIで恐竜キャラ画像を生成。生成された画像をプレイヤースプライトに適用。」

---

## Gemini APIプロンプト（コピペ用）

### 武器生成プロンプト
```
あなたはファンタジーゲーム「ノージャンプダイナソー」の武器デザイナーAIです。
プレイヤーの入力テキストを元に、ゲーム内で使用可能な武器/魔法を1つ生成してください。

ルール:
1. どんな入力でも必ず武器・魔法として解釈すること（例: 「バナナ」→「バナナブーメラン」、「愛」→「愛の弓矢」）
2. 面白い・意外な解釈を積極的に行うこと
3. damage は入力の具体性・独創性に比例（曖昧→低ダメージ、具体的→高ダメージ）
4. 必ず以下のJSON形式のみで出力（余計なテキスト・マークダウン不要）

JSON形式:
{
  "weapon_name": "武器名（日本語）",
  "type": "melee" | "ranged" | "magic",
  "damage": 10-100の整数,
  "mp_cost": 5-50の整数,
  "range": "short" | "medium" | "long",
  "element": "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none",
  "sprite_emoji": "武器を表す絵文字1つ",
  "color": "HEXカラーコード",
  "attack_animation": "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam",
  "description": "武器の短い説明（20文字以内）",
  "uniqueness_score": 0-100の整数
}
```

---

## スプライト/アセット（最小構成）

ゲームアセットは全て **コードで描画** or **絵文字** で対応する（画像アセット準備の時間節約）。

```typescript
// 絵文字スプライトマッピング
const SPRITES = {
  player: "🦕",
  cactus_small: "🌵",
  cactus_large: "🌵",
  fire_wall: "🔥",
  spike: "⚡",
  pteranodon: "🦅",
  boss: "👹",
  heart: "❤️",
  magic: "✨",
} as const;
```

Phaser.jsで絵文字をテクスチャとして使う:
```typescript
// 絵文字からテクスチャを動的生成
function createEmojiTexture(scene: Phaser.Scene, key: string, emoji: string, size: number = 48) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${size * 0.8}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2);
  scene.textures.addCanvas(key, canvas);
}
```

---

## デモシナリオ（審査用）

### 3分デモの流れ:

**0:00-0:30** - イントロ
「皆さんGoogle ChromeのDino Gameをご存知ですか？あのゲームをAIでリミックスしました。ジャンプしない恐竜が、皆さんの言葉で武器を作って戦います。」

**0:30-1:00** - キャラクター生成デモ
テキスト入力でBanana APIキャラ生成を実演

**1:00-2:00** - ゲームプレイデモ
- テキスト入力で武器生成 → 攻撃
- 音声入力で「ファイアボール！」→ 魔法攻撃
- 面白い入力デモ（「寿司」→ 寿司手裏剣 等）

**2:00-2:30** - 技術説明
「Gemini 2.0 Flashで武器パラメータをリアルタイム生成。Gemini Live APIで音声入力。チャージシステムでAIのレイテンシをゲーム体験に変換しています。」

**2:30-3:00** - まとめ
「言葉が武器になる、新しいゲーム体験です。」

---

## トラブルシューティング

### Phaser.js + Next.js SSR エラー
```typescript
// 必ず dynamic import + ssr:false
import dynamic from "next/dynamic";
const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
  ssr: false,
});
```

### Gemini API が JSON を返さない場合
```typescript
// responseMimeType を指定
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});
```

### 音声認識が動かない場合
- HTTPS環境必須（localhost or Vercelデプロイ）
- マイクパーミッション確認
- Web Speech API にフォールバック
