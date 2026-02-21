import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { userInput, isMagic } = await req.json();

        if (!userInput) {
            return NextResponse.json({ error: "No input provided" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API key is missing" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
            model: "gemini-flash-latest",
            generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 1000,
                responseMimeType: "application/json",
            },
        });

        const result = await model.generateContent([
            { text: WEAPON_SYSTEM_PROMPT },
            { text: `プレイヤーの入力: "${userInput}"` },
        ]);

        let rawText = result.response.text();

        if (!rawText) {
            console.error("Gemini returned empty text. Candidate:", result.response.candidates?.[0]);
            throw new Error("Empty response from Gemini");
        }

        // Extract JSON block using regex if wrapped in markdown or conversational text
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            rawText = jsonMatch[1];
        } else {
            const start = rawText.indexOf('{');
            const end = rawText.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                rawText = rawText.substring(start, end + 1);
            }
        }

        rawText = rawText.trim();
        console.log("Cleaned raw text:", rawText);

        let weaponData;
        try {
            weaponData = JSON.parse(rawText);
        } catch (parseError) {
            console.error("Failed to parse JSON, using fallback data:", parseError);
            weaponData = {
                weapon_name: userInput + "（模造品）",
                type: "melee",
                damage: 50,
                mp_cost: 10,
                range: "short",
                element: "none",
                sprite_emoji: "❓",
                color: "#FFFFFF",
                attack_animation: "slash",
                description: "AIの混乱から生まれた奇妙な武器",
                uniqueness_score: 50
            };
        }

        // Call Nano Banana (Gemini Image Preview) via Google Generative Language API for weapon image if key is present
        if (process.env.BANANA_API_KEY) {
            try {
                const bananaPrompt = `pixel art style, 32x32 sprite, side view, game weapon, ${weaponData.weapon_name}, ${weaponData.element !== "none" ? weaponData.element + " element" : ""}, ${weaponData.description}, solid white background, retro game style`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${process.env.BANANA_API_KEY}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: bananaPrompt }]
                        }]
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
                    if (inlineData) {
                        weaponData.image_url = `data:${inlineData.mimeType};base64,${inlineData.data}`;
                    }
                } else {
                    console.error("Banana API Weapon Image generation failed:", await response.text());
                }
            } catch (imgError) {
                console.error("Banana API Error for Weapon:", imgError);
            }
        }

        return NextResponse.json(weaponData);

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ error: "Failed to generate weapon" }, { status: 500 });
    }
}
