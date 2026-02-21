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

        // Banana API (Nano Banana)
        const response = await fetch("https://api.banana.dev/v1/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.BANANA_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: `pixel art style, 32x32 sprite, side view, game character, ${description}, dinosaur character, transparent background, retro game style`,
                negative_prompt: "realistic, photo, 3d render, blurry",
                width: 256,
                height: 256,
            }),
        });

        if (!response.ok) {
            throw new Error("Banana API request failed");
        }

        const data = await response.json();
        return NextResponse.json({ imageUrl: data.image_url });

    } catch (error: any) {
        console.error("Banana API Error:", error);
        return NextResponse.json({
            error: "Failed to generate character",
            emojiFallback: "🐲",
        }, { status: 500 });
    }
}
