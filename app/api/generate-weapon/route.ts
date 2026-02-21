import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WEAPON_RESPONSE_SCHEMA: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        weapon_name: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING, format: "enum", enum: ["melee", "ranged", "magic"] },
        damage: { type: SchemaType.NUMBER },
        mp_cost: { type: SchemaType.NUMBER },
        range: { type: SchemaType.STRING, format: "enum", enum: ["short", "medium", "long"] },
        element: { type: SchemaType.STRING, format: "enum", enum: ["fire", "ice", "thunder", "wind", "earth", "light", "dark", "none"] },
        sprite_emoji: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING },
        attack_animation: { type: SchemaType.STRING, format: "enum", enum: ["slash", "slash_wide", "thrust", "projectile", "explosion", "beam"] },
        description: { type: SchemaType.STRING },
        uniqueness_score: { type: SchemaType.NUMBER },
    },
    required: [
        "weapon_name",
        "type",
        "damage",
        "mp_cost",
        "range",
        "element",
        "sprite_emoji",
        "color",
        "attack_animation",
        "description",
        "uniqueness_score",
    ],
};

type WeaponPayload = {
    weapon_name: string;
    type: "melee" | "ranged" | "magic";
    damage: number;
    mp_cost: number;
    range: "short" | "medium" | "long";
    element: "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none";
    sprite_emoji: string;
    color: string;
    attack_animation: "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam";
    description: string;
    uniqueness_score: number;
};

function tryParseWeaponJson(raw: string): WeaponPayload {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [
        trimmed,
        fenceMatch?.[1]?.trim() || "",
        trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(),
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate) as WeaponPayload;
        } catch {
            const match = candidate.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]) as WeaponPayload;
            }
        }
    }

    throw new Error(`Model returned non-JSON output: ${raw.slice(0, 200)}`);
}

function fallbackWeapon(userInput: string): WeaponPayload {
    const label = userInput.trim().slice(0, 10) || "ことば";
    const hash = Array.from(userInput).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const variants: WeaponPayload[] = [
        {
            weapon_name: `${label}の剣`,
            type: "melee",
            damage: 25,
            mp_cost: 8,
            range: "short",
            element: "none",
            sprite_emoji: "🗡️",
            color: "#4B5563",
            attack_animation: "slash",
            description: "安定した予備武器",
            uniqueness_score: 20,
        },
        {
            weapon_name: `${label}ブーメラン`,
            type: "ranged",
            damage: 28,
            mp_cost: 10,
            range: "long",
            element: "wind",
            sprite_emoji: "🪃",
            color: "#14B8A6",
            attack_animation: "projectile",
            description: "回転して戻る一撃",
            uniqueness_score: 28,
        },
        {
            weapon_name: `${label}ビーム`,
            type: "magic",
            damage: 32,
            mp_cost: 16,
            range: "long",
            element: "light",
            sprite_emoji: "✨",
            color: "#F59E0B",
            attack_animation: "beam",
            description: "直線を貫く魔光",
            uniqueness_score: 35,
        },
        {
            weapon_name: `${label}ボム`,
            type: "ranged",
            damage: 35,
            mp_cost: 14,
            range: "medium",
            element: "fire",
            sprite_emoji: "💣",
            color: "#EF4444",
            attack_animation: "explosion",
            description: "爆発で広範囲攻撃",
            uniqueness_score: 33,
        },
        {
            weapon_name: `${label}ランス`,
            type: "melee",
            damage: 30,
            mp_cost: 9,
            range: "medium",
            element: "thunder",
            sprite_emoji: "⚡",
            color: "#A78BFA",
            attack_animation: "thrust",
            description: "雷を纏う突撃槍",
            uniqueness_score: 31,
        },
        {
            weapon_name: `${label}召喚陣`,
            type: "magic",
            damage: 34,
            mp_cost: 18,
            range: "medium",
            element: "dark",
            sprite_emoji: "🔮",
            color: "#7C3AED",
            attack_animation: "slash_wide",
            description: "魔法陣で薙ぎ払う",
            uniqueness_score: 37,
        },
    ];

    return variants[hash % variants.length];
}

export async function POST(req: NextRequest) {
    try {
        const { userInput } = await req.json();

        if (!userInput) {
            return NextResponse.json({ error: "No input provided" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key is missing" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

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
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: WEAPON_RESPONSE_SCHEMA,
            },
        });
        const compactModel = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
                responseSchema: WEAPON_RESPONSE_SCHEMA,
            },
        });

        const prompts = [
            [
                { text: WEAPON_SYSTEM_PROMPT },
                { text: `プレイヤーの入力: "${userInput}"` },
            ],
            [
                { text: WEAPON_SYSTEM_PROMPT },
                { text: `プレイヤーの入力: "${userInput}"` },
                {
                    text: "必ずJSONオブジェクト1つだけを返してください。前置き・解説・Markdownコードブロックは禁止です。出力の先頭文字は {、末尾文字は } にしてください。",
                },
            ],
        ];

        for (const content of prompts) {
            const result = await model.generateContent(content);
            const raw = result.response.text();
            const finishReason = result.response.candidates?.[0]?.finishReason;
            try {
                const weaponData = tryParseWeaponJson(raw);
                return NextResponse.json(weaponData);
            } catch {
                console.warn("[generate-weapon] JSON parse failed", {
                    finishReason: finishReason || "UNKNOWN",
                    rawLength: raw.length,
                    rawPreview: raw.slice(0, 500),
                });
                if (finishReason && finishReason !== "STOP") {
                    console.warn("[generate-weapon] non-STOP finishReason", {
                        finishReason,
                        rawLength: raw.length,
                    });
                }
            }
        }

        // MAX_TOKENS時の最終リトライ: 出力を短く固定してJSON完了率を上げる
        const compactPrompt = `次の入力から武器を1つ生成し、JSONオブジェクト1つのみ返してください。
前置き・説明・Markdownは禁止。文字列は短く、descriptionは20文字以内。
入力: "${userInput}"`;
        const compactResult = await compactModel.generateContent([{ text: compactPrompt }]);
        const compactRaw = compactResult.response.text();
        try {
            const compactWeapon = tryParseWeaponJson(compactRaw);
            return NextResponse.json(compactWeapon);
        } catch {
            console.warn("[generate-weapon] compact retry parse failed", {
                finishReason: compactResult.response.candidates?.[0]?.finishReason || "UNKNOWN",
                rawLength: compactRaw.length,
                rawPreview: compactRaw.slice(0, 500),
            });
        }

        return NextResponse.json(fallbackWeapon(userInput));

    } catch (error: unknown) {
        console.error("Gemini API Error:", error);
        const maybeError = error as { status?: unknown; code?: unknown; message?: unknown };
        const status = Number(maybeError?.status) || Number(maybeError?.code) || 500;
        const details = String(maybeError?.message || "Unknown Gemini API error");
        const isAuthError = status === 401 || status === 403;
        const safeStatus = isAuthError ? status : 500;
        const safeError = isAuthError ? "Gemini authentication failed" : "Failed to generate weapon";
        return NextResponse.json({ error: safeError, details }, { status: safeStatus });
    }
}
