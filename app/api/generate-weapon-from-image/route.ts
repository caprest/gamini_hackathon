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
        "weapon_name", "type", "damage", "mp_cost", "range", "element",
        "sprite_emoji", "color", "attack_animation", "description", "uniqueness_score",
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

export async function POST(req: NextRequest) {
    try {
        const { imageDataUrl } = await req.json();

        if (!imageDataUrl || typeof imageDataUrl !== "string") {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key is missing" }, { status: 500 });
        }

        // Extract base64 data and mime type from data URL
        const dataUrlMatch = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!dataUrlMatch) {
            return NextResponse.json({ error: "Invalid image data URL format" }, { status: 400 });
        }
        const [, mimeType, base64Data] = dataUrlMatch;

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

        const systemPrompt = `あなたはファンタジーゲーム「ノージャンプダイナソー」の武器デザイナーAIです。
プレイヤーが撮影した写真の物体を元に、ゲーム内で使用可能な武器/魔法を1つ生成してください。

### ルール:
1. 画像に写っている物体を必ず武器・魔法として解釈すること（例: バナナ→「バナナブーメラン」、ペン→「魔法の杖」など）
2. 面白い・意外な解釈を積極的に行うこと
3. damageは物体の面白さ・意外性に比例させること
4. sprite_emojiは画像の物体に最も近い絵文字1文字を選ぶこと
5. 必ずJSON形式で出力`;

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: WEAPON_RESPONSE_SCHEMA,
            },
        });

        const result = await model.generateContent([
            { text: systemPrompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                },
            },
            { text: "この画像に写っている物体を武器化してください。" },
        ]);

        const raw = result.response.text();

        try {
            const weaponData = tryParseWeaponJson(raw);
            return NextResponse.json(weaponData);
        } catch {
            console.warn("[generate-weapon-from-image] JSON parse failed", {
                rawPreview: raw.slice(0, 500),
            });
        }

        // Fallback
        return NextResponse.json({
            weapon_name: "謎の撮影物体",
            type: "melee",
            damage: 20,
            mp_cost: 8,
            range: "short",
            element: "none",
            sprite_emoji: "📷",
            color: "#6B7280",
            attack_animation: "slash",
            description: "カメラで捉えた不思議な武器",
            uniqueness_score: 30,
        });
    } catch (error: unknown) {
        console.error("Gemini API Error (image):", error);
        const maybeError = error as { status?: unknown; code?: unknown; message?: unknown };
        const status = Number(maybeError?.status) || Number(maybeError?.code) || 500;
        const details = String(maybeError?.message || "Unknown Gemini API error");
        const isAuthError = status === 401 || status === 403;
        return NextResponse.json(
            { error: isAuthError ? "Gemini authentication failed" : "Failed to generate weapon from image", details },
            { status: isAuthError ? status : 500 }
        );
    }
}
