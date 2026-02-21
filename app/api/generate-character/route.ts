import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { description } = await req.json();

        if (!description) {
            return NextResponse.json({ error: "No description provided" }, { status: 400 });
        }

        if (!process.env.BANANA_API_KEY) {
            // API Keyがない場合のフォールバック（絵文字）
            return NextResponse.json({
                imageUrl: null,
                emojiFallback: "🦖",
                message: "BANANA API KEY is missing. Using fallback."
            });
        }

        // Call Nano Banana (Gemini Image Preview) via Google Generative Language API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${process.env.BANANA_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `pixel art style, 32x32 sprite, side view, game character, ${description}, dinosaur character, solid white background, retro game style` }]
                }]
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Nano Banana API Error:", errText);
            throw new Error("Nano Banana API request failed");
        }

        const data = await response.json();
        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

        if (inlineData) {
            const imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
            return NextResponse.json({ imageUrl });
        } else {
            throw new Error("No image data returned from Nano Banana");
        }

    } catch (error: any) {
        console.error("Banana API Error:", error);
        return NextResponse.json({
            error: "Failed to generate character",
            emojiFallback: "🐲",
        }, { status: 500 });
    }
}
