import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { userInput } = await req.json();

        if (!userInput) {
            return NextResponse.json({ error: "No input provided" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API key is missing" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const WEAPON_SYSTEM_PROMPT = `あなたはファンタジーゲーム「ノージャンプダイナソー」の武器デザイナーAIです。
プレイヤーの入力テキストを元に、ゲーム内で使用可能な武器/魔法を1つ生成してください。

### ルール:
1. どんな入力でも必ず武器・魔法として解釈すること（例: 「バナナ」→「バナナブーメラン」、「猫」→「猫パンチ爆弾」など関連付けて無理やりでも武器にする）
2. 面白い・意外な解釈を積極的に行うこと
3. damageは入力の具体性・独創性に比例（適当な入力なら低め、凝ったテキストなら高め）
4. 必ず以下のJSON形式で出力（余計なテキスト不要、最初と最後の \`\`\`json 等のマークダウンも不要）

### JSON形式:
{
  "weapon_name": "武器名（日本語）",
  "type": "melee" | "ranged" | "magic",
  "damage": 10-100の数値,
  "mp_cost": 5-50の数値,
  "range": "short" | "medium" | "long",
  "element": "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none",
  "sprite_emoji": "武器を表す絵文字1文字",
  "color": "HEXカラーコード（例: #FF0000）",
  "attack_animation": "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam",
  "description": "武器の短い説明（20文字以内）",
  "uniqueness_score": 0-100の数値
}`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
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

        const weaponData = JSON.parse(result.response.text());
        return NextResponse.json(weaponData);

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ error: "Failed to generate weapon" }, { status: 500 });
    }
}
