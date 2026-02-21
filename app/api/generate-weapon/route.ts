import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DEBUG_GEMINI_WEAPON = process.env.DEBUG_GEMINI_WEAPON === "1";

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
    image_url?: string;
};

const ELEMENTS: WeaponPayload["element"][] = ["fire", "ice", "thunder", "wind", "earth", "light", "dark", "none"];
const TYPES: WeaponPayload["type"][] = ["melee", "ranged", "magic"];
const RANGES: WeaponPayload["range"][] = ["short", "medium", "long"];
const ANIMATIONS: WeaponPayload["attack_animation"][] = ["slash", "slash_wide", "thrust", "projectile", "explosion", "beam"];

function tryParseWeaponJson(raw: string): unknown {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [
        trimmed,
        fenceMatch?.[1]?.trim() || "",
        trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(),
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {
            const match = candidate.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
        }
    }

    throw new Error(`Model returned non-JSON output: ${raw.slice(0, 200)}`);
}

function normalizeWeaponPayload(input: unknown, userInput: string): WeaponPayload | null {
    const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const from = (keys: string[]) => {
        for (const key of keys) {
            const value = data[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") return value;
        }
        return undefined;
    };
    const toNumber = (value: unknown, fallback: number, min?: number, max?: number) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        const rounded = Math.round(n);
        if (min !== undefined && rounded < min) return min;
        if (max !== undefined && rounded > max) return max;
        return rounded;
    };
    const toString = (value: unknown, fallback: string) => {
        const s = String(value ?? "").trim();
        return s || fallback;
    };

    const rawType = toString(from(["type", "weapon_type", "weaponType", "種類"]), "melee");
    const rawRange = toString(from(["range", "weapon_range", "weaponRange", "射程"]), "short");
    const rawElement = toString(from(["element", "attribute", "attr", "属性"]), "none");
    const rawAnimation = toString(from(["attack_animation", "attackAnimation", "animation", "攻撃アニメーション"]), "slash");

    const type = TYPES.includes(rawType as WeaponPayload["type"]) ? (rawType as WeaponPayload["type"]) : "melee";
    const range = RANGES.includes(rawRange as WeaponPayload["range"]) ? (rawRange as WeaponPayload["range"]) : "short";
    const element = ELEMENTS.includes(rawElement as WeaponPayload["element"]) ? (rawElement as WeaponPayload["element"]) : "none";
    const attack_animation = ANIMATIONS.includes(rawAnimation as WeaponPayload["attack_animation"])
        ? (rawAnimation as WeaponPayload["attack_animation"])
        : "slash";

    const weapon: WeaponPayload = {
        weapon_name: toString(from(["weapon_name", "name", "weaponName", "武器名"]), `${userInput.slice(0, 10) || "ことば"}の武器`),
        type,
        damage: toNumber(from(["damage", "power", "attack", "ダメージ"]), 20, 1, 999),
        mp_cost: toNumber(from(["mp_cost", "mpCost", "mana_cost", "消費MP"]), 8, 0, 999),
        range,
        element,
        sprite_emoji: toString(from(["sprite_emoji", "emoji", "icon", "絵文字"]), "🗡️"),
        color: /^#[0-9A-Fa-f]{6}$/.test(toString(from(["color", "hex", "カラー"]), "")) ? toString(from(["color", "hex", "カラー"]), "#4B5563") : "#4B5563",
        attack_animation,
        description: toString(from(["description", "desc", "説明"]), "生成武器"),
        uniqueness_score: toNumber(from(["uniqueness_score", "uniqueness", "独自性"]), 20, 0, 100),
    };

    if (!weapon.weapon_name || !Number.isFinite(weapon.damage)) return null;
    return weapon;
}

function logGeminiDebug(stage: string, payload: Record<string, unknown>) {
    if (!DEBUG_GEMINI_WEAPON) return;
    console.warn(`[generate-weapon][debug] ${stage}`, payload);
}

async function attachWeaponImageIfAvailable(weaponData: WeaponPayload) {
    if (!process.env.BANANA_API_KEY) return weaponData;
    try {
        const bananaPrompt = `pixel art style, 32x32 sprite, side view, game weapon, ${weaponData.weapon_name}, ${weaponData.element !== "none" ? `${weaponData.element} element` : ""}, ${weaponData.description}, solid white background, retro game style`;
        const imageRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${process.env.BANANA_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: bananaPrompt }] }],
                }),
            }
        );
        if (!imageRes.ok) {
            console.error("Banana API Weapon Image generation failed:", await imageRes.text());
            return weaponData;
        }
        const imageData = await imageRes.json();
        const inlineData = imageData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData) {
            weaponData.image_url = `data:${inlineData.mimeType};base64,${inlineData.data}`;
        }
    } catch (imgError) {
        console.error("Banana API Error for Weapon:", imgError);
    }
    return weaponData;
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
        const { userInput, isMagic } = await req.json();

        if (!userInput) {
            return NextResponse.json({ error: "No input provided" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key is missing" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

        const promptContext = isMagic
            ? `あなたはゲームの魔法使いAIです。入力に基づき【魔法】を1つ生成してください。\n・回復の意図があれば type="heal", damage=0\n・攻撃魔法なら type="magic", 範囲は広めに設定\n・mp_costは必ず30\n・重要: typeは絶対に "magic" か "heal" にしてください。"melee"や"ranged"は使用禁止です。`
            : `あなたはゲームの鍛冶屋AIです。入力に基づき【武器】を1つ生成してください。\n・無理やりでも武器として解釈\n・typeは絶対に "melee" または "ranged" にしてください。"magic"や"heal"は使用禁止です。\n・mp_costは必ず20`;

        const WEAPON_SYSTEM_PROMPT = `${promptContext}

### ルール:
1. 面白い・意外な解釈を積極的に行うこと
2. damageは入力の具体性・独創性に比例
3. 必ず以下のJSON形式で出力（マークダウン不要）

### JSON形式:
{
  "weapon_name": "名前（日本語）",
  "type": "melee" | "ranged" | "magic" | "heal" (※絶対ルールの通りに指定),
  "damage": 0-100の数値,
  "mp_cost": 20 または 30,
  "range": "short" | "medium" | "long",
  "element": "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none",
  "sprite_emoji": "絵文字1文字",
  "color": "HEXカラーコード（例: #FF0000）",
  "attack_animation": "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam",
  "description": "説明（20文字以内）",
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
            logGeminiDebug("model-response", {
                finishReason: finishReason || "UNKNOWN",
                rawLength: raw.length,
                raw,
            });
            try {
                const parsed = tryParseWeaponJson(raw);
                logGeminiDebug("parsed-json", {
                    parsed,
                });
                const weaponData = normalizeWeaponPayload(parsed, userInput);
                if (weaponData) {
                    logGeminiDebug("normalized-weapon", weaponData as unknown as Record<string, unknown>);
                    const withImage = await attachWeaponImageIfAvailable(weaponData);
                    return NextResponse.json(withImage);
                }
                throw new Error("Normalized weapon payload is invalid");
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
        logGeminiDebug("compact-model-response", {
            finishReason: compactResult.response.candidates?.[0]?.finishReason || "UNKNOWN",
            rawLength: compactRaw.length,
            raw: compactRaw,
        });
        try {
            const compactParsed = tryParseWeaponJson(compactRaw);
            logGeminiDebug("compact-parsed-json", {
                parsed: compactParsed,
            });
            const compactWeapon = normalizeWeaponPayload(compactParsed, userInput);
            if (compactWeapon) {
                logGeminiDebug("compact-normalized-weapon", compactWeapon as unknown as Record<string, unknown>);
                const withImage = await attachWeaponImageIfAvailable(compactWeapon);
                return NextResponse.json(withImage);
            }
            throw new Error("Normalized compact weapon payload is invalid");
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
        const errorMessage = String(maybeError?.message || "");
        const status = Number(maybeError?.status) || Number(maybeError?.code) || 500;

        // Rate limit (429) — return clear error so client can show a useful message
        if (status === 429 || errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota")) {
            return NextResponse.json(
                { error: "rate_limit", details: "APIレート制限に達しました。しばらく待ってから再試行してください。" },
                { status: 429 }
            );
        }

        const isAuthError = status === 401 || status === 403;
        const safeStatus = isAuthError ? status : 500;
        const safeError = isAuthError ? "Gemini authentication failed" : "Failed to generate weapon";
        return NextResponse.json({ error: safeError, details: errorMessage || "Unknown error" }, { status: safeStatus });
    }
}
