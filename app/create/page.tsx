"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const CAMERA_WEAPONS_KEY = "savedCameraWeapons";

type StarterWeapon = {
    weapon_name: string;
    type: "melee" | "ranged" | "magic" | "heal";
    damage: number;
    mp_cost: number;
    range: "short" | "medium" | "long";
    element: "fire" | "ice" | "thunder" | "wind" | "earth" | "light" | "dark" | "none";
    sprite_emoji: string;
    color: string;
    attack_animation: "slash" | "slash_wide" | "thrust" | "projectile" | "explosion" | "beam";
    description: string;
    uniqueness_score: number;
    image_url?: string | null;
};

function sanitizeStarterWeapon(input: unknown, fallbackType: "melee" | "magic"): StarterWeapon {
    const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const asText = (value: unknown, fallback: string) => {
        const text = String(value ?? "").trim();
        return text || fallback;
    };
    const asNum = (value: unknown, fallback: number, min?: number, max?: number) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        const rounded = Math.round(n);
        if (min !== undefined && rounded < min) return min;
        if (max !== undefined && rounded > max) return max;
        return rounded;
    };
    const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
        const v = asText(value, fallback);
        return allowed.includes(v as T) ? (v as T) : fallback;
    };

    const requestedType = fallbackType === "magic" ? "magic" : "melee";
    const type = pick(
        data.type,
        requestedType === "magic" ? (["magic", "heal"] as const) : (["melee", "ranged"] as const),
        requestedType
    );

    return {
        weapon_name: asText(data.weapon_name, requestedType === "magic" ? "始まりの魔法" : "始まりの武器"),
        type,
        damage: asNum(data.damage, requestedType === "magic" ? 30 : 20, 0, 999),
        mp_cost: asNum(data.mp_cost, requestedType === "magic" ? 30 : 20, 0, 999),
        range: pick(data.range, ["short", "medium", "long"] as const, requestedType === "magic" ? "medium" : "short"),
        element: pick(data.element, ["fire", "ice", "thunder", "wind", "earth", "light", "dark", "none"] as const, "none"),
        sprite_emoji: asText(data.sprite_emoji, requestedType === "magic" ? "✨" : "🗡️"),
        color: /^#[0-9A-Fa-f]{6}$/.test(asText(data.color, "")) ? asText(data.color, "#4B5563") : "#4B5563",
        attack_animation: pick(
            data.attack_animation,
            ["slash", "slash_wide", "thrust", "projectile", "explosion", "beam"] as const,
            requestedType === "magic" ? "beam" : "slash"
        ),
        description: asText(data.description, requestedType === "magic" ? "初期魔法" : "初期武器"),
        uniqueness_score: asNum(data.uniqueness_score, 20, 0, 100),
        image_url: null,
    };
}

function fallbackStarterWeapon(kind: "weapon" | "magic"): StarterWeapon {
    if (kind === "magic") {
        return {
            weapon_name: "始まりの光弾",
            type: "magic",
            damage: 30,
            mp_cost: 30,
            range: "medium",
            element: "light",
            sprite_emoji: "✨",
            color: "#F59E0B",
            attack_animation: "beam",
            description: "自動生成の初期魔法",
            uniqueness_score: 25,
            image_url: null,
        };
    }
    return {
        weapon_name: "始まりのブレード",
        type: "melee",
        damage: 22,
        mp_cost: 20,
        range: "short",
        element: "none",
        sprite_emoji: "🗡️",
        color: "#4B5563",
        attack_animation: "slash",
        description: "自動生成の初期武器",
        uniqueness_score: 20,
        image_url: null,
    };
}

export default function CreateCharacterPage() {
    const [description, setDescription] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || isGenerating) return;

        setIsGenerating(true);
        setError(null);
        setResultImage(null);

        try {
            const res = await fetch("/api/generate-character", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.imageUrl) {
                    setResultImage(data.imageUrl);
                    localStorage.setItem("customPlayerImage", data.imageUrl);

                    const [weaponRes, magicRes] = await Promise.all([
                        fetch("/api/generate-weapon", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userInput: `${description}に合う初期武器`, isMagic: false }),
                        }),
                        fetch("/api/generate-weapon", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userInput: `${description}に合う初期魔法`, isMagic: true }),
                        }),
                    ]);

                    const weaponJson = weaponRes.ok ? await weaponRes.json() : null;
                    const magicJson = magicRes.ok ? await magicRes.json() : null;

                    const starterWeapon = weaponJson
                        ? sanitizeStarterWeapon(weaponJson, "melee")
                        : fallbackStarterWeapon("weapon");
                    const starterMagic = magicJson
                        ? sanitizeStarterWeapon(magicJson, "magic")
                        : fallbackStarterWeapon("magic");

                    localStorage.setItem(CAMERA_WEAPONS_KEY, JSON.stringify([starterWeapon, starterMagic]));
                } else if (data.emojiFallback) {
                    setError(`APIキーが設定されていないため、フォールバック絵文字(${data.emojiFallback})が選択されました。`);
                }
            } else {
                setError(data.error || "生成に失敗しました");
            }
        } catch (err: any) {
            setError(err.message || "通信エラーが発生しました");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-900 p-8 flex flex-col items-center justify-center font-sans text-white">
            <div className="w-full max-w-[600px] mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-wider text-green-400">CHARACTER MAKER</h1>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                    ← 戻る
                </Link>
            </div>

            <div className="w-full max-w-[600px] bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
                <p className="text-slate-300 mb-6">
                    あなたが作りたい恐竜キャラクターの特徴を入力してください。Banana APIがドット絵スプライトを生成します。
                </p>

                <form onSubmit={handleGenerate} className="flex flex-col gap-4 mb-8">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="例: 青い鎧を着た勇者、炎のドラゴン騎士"
                        className="w-full h-24 px-4 py-3 bg-slate-700 rounded-lg border-2 border-slate-600 focus:border-green-500 focus:outline-none resize-none"
                        disabled={isGenerating}
                    />
                    <button
                        type="submit"
                        disabled={!description.trim() || isGenerating}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 font-bold text-xl rounded-lg disabled:opacity-50 transition-colors"
                    >
                        {isGenerating ? "🦖 生成中 (キャラ + 初期武器/魔法)..." : "生成する"}
                    </button>
                </form>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {resultImage && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        <h2 className="text-xl font-bold mb-4 text-green-300">🎉 生成成功！</h2>
                        <div className="bg-slate-700 p-4 rounded-lg mb-6">
                            <Image
                                src={resultImage}
                                alt="Generated Character"
                                width={256}
                                height={256}
                                className="pixelated bg-transparent mix-blend-multiply"
                                unoptimized
                            />
                        </div>

                        <Link
                            href="/game"
                            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-full transition-transform hover:scale-105"
                        >
                            このキャラでゲームを始める
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
