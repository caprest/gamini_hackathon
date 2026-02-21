# 🔧 技術仕様書 - ノージャンプダイナソー

## 1. アーキテクチャ概要

```
┌──────────────────────────────────────────────────┐
│                   ブラウザ (Client)                │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Next.js   │  │  Phaser.js  │  │  Voice UI  │ │
│  │  (React)   │←→│  (Canvas)   │  │  (Mic)     │ │
│  │  HUD/UI    │  │  Game Logic │  │            │ │
│  └─────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│        │                │                │        │
│        └────────┬───────┴────────┬───────┘        │
│                 │    EventBus    │                 │
└─────────────────┼────────────────┼─────────────────┘
                  │                │
         ┌────────▼────────┐      │
         │  Next.js API    │      │
         │  Routes         │      │
         │  /api/*         │      │
         └───┬────┬────┬───┘      │
             │    │    │          │
     ┌───────▼┐ ┌─▼──┐ ┌▼────────▼───┐
     │Gemini  │ │Bana│ │Gemini Live  │
     │API     │ │na  │ │API (Voice)  │
     │(武器)  │ │API │ │(WebSocket)  │
     └────────┘ └────┘ └─────────────┘
```

---

## 2. Next.js API Routes

### 2.1 POST /api/generate-weapon

武器生成エンドポイント。テキスト入力からGemini APIで武器を生成。

```typescript
// app/api/generate-weapon/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const WEAPON_SYSTEM_PROMPT = `あなたはファンタジーゲーム「ノージャンプダイナソー」の武器デザイナーAIです。
プレイヤーの入力テキストを元に、ゲーム内で使用可能な武器/魔法を1つ生成してください。

### ルール:
1. どんな入力でも必ず武器・魔法として解釈すること（例: 「バナナ」→「バナナブーメラン」）
2. 面白い・意外な解釈を積極的に行うこと
3. damage は入力の具体性・独創性に比例
4. 必ず以下のJSON形式で出力（余計なテキスト不要）

### JSON形式:
{
  "weapon_name": "武器名（日本語）",
  "type": "melee" | "ranged" | "magic",
  "damage": 10-100,
  "mp_cost": 5-50,
  "range": "short" | "medium" | "long",
  "element": "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none",
  "sprite_emoji": "武器を表す絵文字1つ",
  "color": "HEXカラーコード",
  "attack_animation": "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam",
  "description": "武器の短い説明（20文字以内）",
  "uniqueness_score": 0-100
}`;

export async function POST(req: NextRequest) {
  const { userInput } = await req.json();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // 高速モデル推奨
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 300,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    { text: WEAPON_SYSTEM_PROMPT },
    { text: `プレイヤーの入力: "${userInput}"` },
  ]);

  const weapon = JSON.parse(result.response.text());
  return NextResponse.json(weapon);
}
```

### 2.2 POST /api/generate-character

キャラクター画像生成エンドポイント。

```typescript
// app/api/generate-character/route.ts

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  // Banana API (Nano Banana) でキャラクター画像生成
  const response = await fetch("https://api.banana.dev/v1/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.BANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `pixel art, 64x64 sprite sheet, side view, game character, ${description}, dinosaur style, cute, retro game aesthetic, transparent background`,
      negative_prompt: "realistic, photo, 3d render, blurry",
      width: 256,
      height: 256,
    }),
  });

  const data = await response.json();
  return NextResponse.json({ imageUrl: data.image_url });
}
```

---

## 3. Phaser.js ゲーム設計

### 3.1 ゲーム初期化

```typescript
// game/config.ts

import Phaser from "phaser";

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 300,
  parent: "game-container",
  backgroundColor: "#f7f7f7",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scene: [], // 動的にシーンを追加
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
};
```

### 3.2 GameScene 主要ロジック

```typescript
// game/scenes/GameScene.ts（概要）

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private ground!: Phaser.GameObjects.TileSprite;
  private scrollSpeed: number = 200;
  private score: number = 0;
  private hp: number = 100;
  private mp: number = 100;
  private currentWeapon: WeaponData | null = null;
  private isCharging: boolean = false;
  private chargeEffect!: Phaser.GameObjects.Particles.ParticleEmitter;

  // イベントバス経由でReact UIと通信
  private eventBus: Phaser.Events.EventEmitter;

  create() {
    // 地面作成
    this.ground = this.add.tileSprite(400, 280, 800, 40, "ground");

    // プレイヤー作成
    this.player = new Player(this, 100, 240);

    // 障害物グループ
    this.obstacles = this.physics.add.group();

    // 衝突判定
    this.physics.add.overlap(
      this.player, this.obstacles, this.onHit, undefined, this
    );

    // スペースキー（攻撃）
    this.input.keyboard!.on("keydown-SPACE", () => this.attack());

    // 障害物スポーンタイマー
    this.time.addEvent({
      delay: 1500,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true,
    });

    // MP自然回復
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.mp = Math.min(100, this.mp + 2);
        this.eventBus.emit("mp-update", this.mp);
      },
      callbackScope: this,
      loop: true,
    });
  }

  // 武器セット（React UIから呼ばれる）
  setWeapon(weaponData: WeaponData) {
    this.currentWeapon = weaponData;
    this.isCharging = false;
    this.chargeEffect?.stop();
    this.eventBus.emit("weapon-ready", weaponData);
  }

  // チャージ開始（AI処理中）
  startCharging() {
    this.isCharging = true;
    // パーティクルエフェクト開始
    this.chargeEffect = this.add.particles(
      this.player.x, this.player.y, "particle",
      {
        speed: { min: 50, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 500,
        frequency: 50,
        tint: 0xffff00,
      }
    );
  }

  // 攻撃実行
  attack() {
    if (!this.currentWeapon) {
      // 素手攻撃（弱い）
      this.performAttack({ damage: 5, range: "short", type: "melee" });
      return;
    }

    if (this.mp < this.currentWeapon.mp_cost) {
      this.eventBus.emit("mp-insufficient");
      return;
    }

    this.mp -= this.currentWeapon.mp_cost;
    this.performAttack(this.currentWeapon);
    this.currentWeapon = null; // 使用後リセット
  }

  update(time: number, delta: number) {
    // 地面スクロール
    this.ground.tilePositionX += this.scrollSpeed * (delta / 1000);

    // スコア加算
    this.score += delta / 100;
    this.eventBus.emit("score-update", Math.floor(this.score));

    // 難易度上昇（スクロール速度UP）
    this.scrollSpeed = 200 + Math.floor(this.score / 100) * 10;
  }
}
```

### 3.3 EventBus（Phaser ↔ React 通信）

```typescript
// game/EventBus.ts

export const GameEventBus = new Phaser.Events.EventEmitter();

// イベント一覧:
// "weapon-request"   : React → Phaser : 武器リクエスト開始
// "weapon-charging"  : Phaser → React : チャージ中状態
// "weapon-ready"     : Phaser → React : 武器生成完了
// "attack-executed"  : Phaser → React : 攻撃実行
// "hp-update"        : Phaser → React : HP更新
// "mp-update"        : Phaser → React : MP更新
// "mp-insufficient"  : Phaser → React : MP不足通知
// "score-update"     : Phaser → React : スコア更新
// "game-over"        : Phaser → React : ゲームオーバー
// "obstacle-destroyed": Phaser → React : 障害物破壊
```

---

## 4. 音声入力仕様

### 4.1 Gemini Live API 統合

```typescript
// lib/gemini-live.ts

export class GeminiVoiceClient {
  private ws: WebSocket | null = null;
  private onResult: (text: string) => void;

  constructor(onResult: (text: string) => void) {
    this.onResult = onResult;
  }

  async connect() {
    // Gemini Live API WebSocket接続
    this.ws = new WebSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`
    );

    this.ws.onopen = () => {
      // セットアップメッセージ送信
      this.ws?.send(JSON.stringify({
        setup: {
          model: "models/gemini-2.0-flash-live",
          generationConfig: {
            responseModalities: ["TEXT"],
          },
        },
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.serverContent?.modelTurn?.parts) {
        const text = data.serverContent.modelTurn.parts
          .map((p: any) => p.text)
          .join("");
        this.onResult(text);
      }
    };
  }

  // 音声データ送信
  sendAudio(audioData: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(audioData))
      );
      this.ws.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          }],
        },
      }));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
```

### 4.2 Web Speech API フォールバック

```typescript
// lib/voice.ts

export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;

  start(onResult: (text: string) => void) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported");
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "ja-JP";
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        onResult(result[0].transcript);
      }
    };

    this.recognition.start();
    return true;
  }

  stop() {
    this.recognition?.stop();
  }
}
```

---

## 5. エフェクト仕様

### 5.1 チャージエフェクト
- キャラクター周囲に光のパーティクル回転
- 徐々にパーティクル量増加
- 色はニュートラル（白/金）→ 武器確定後に武器のelement色に変化
- 完了時にフラッシュ + 「READY!」テキスト

### 5.2 攻撃エフェクト

| animation | 描画 |
|-----------|------|
| `slash` | 前方に弧を描く斬撃 |
| `slash_wide` | 広範囲の横薙ぎ |
| `thrust` | 直線的な突き |
| `projectile` | 弾が前方に飛ぶ |
| `explosion` | 範囲爆発 |
| `beam` | 直線ビーム |

### 5.3 ダメージエフェクト
- プレイヤー被弾: 赤点滅 + 画面シェイク
- 障害物破壊: パーティクル飛散 + スコアポップアップ

---

## 6. 環境変数

```env
# .env.local
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key  # Live API用（クライアント側）
BANANA_API_KEY=your_banana_api_key
```

---

## 7. パフォーマンス考慮

### API呼び出し最適化
- **Gemini 2.0 Flash** を使用（レイテンシ最小）
- 武器生成は `maxOutputTokens: 300` に制限
- JSON形式指定で余計な出力を抑制
- チャージエフェクトでAPI待ち時間を体験的にカバー

### ゲーム描画最適化
- スプライトシート使用（個別画像ロード削減）
- オブジェクトプール活用（障害物の再利用）
- パーティクルの上限設定（maxParticles）
- 画面外オブジェクトの自動破棄

---

## 8. 既知のリスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Gemini API レイテンシ | 武器生成に2-3秒 | チャージエフェクトで待ち時間をゲーム体験に変換 |
| 音声認識精度 | 日本語認識エラー | テキスト入力フォールバック常時表示 |
| Banana API 遅延 | キャラ生成に10秒以上 | デフォルトキャラを用意、生成はオプション |
| APIクレジット枯渇 | ゲームが動かなくなる | $20クレジットでFlashなら数千回呼べる。テスト時は節約 |
| Phaser.js + Next.js SSR | hydration error | dynamic import + ssr: false |
