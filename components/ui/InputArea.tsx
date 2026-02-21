"use client";

import { useState, useEffect } from "react";
import { GameEventBus } from "@/game/EventBus";
import { WeaponData } from "@/types/game";

function sanitizeWeaponData(input: unknown): WeaponData {
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

    const type = pick(data.type, ["melee", "ranged", "magic"] as const, "melee");
    const range = pick(data.range, ["short", "medium", "long"] as const, "short");
    const element = pick(data.element, ["fire", "ice", "thunder", "wind", "earth", "light", "dark", "none"] as const, "none");
    const attack_animation = pick(
        data.attack_animation,
        ["slash", "slash_wide", "thrust", "projectile", "explosion", "beam"] as const,
        "slash"
    );

    return {
        weapon_name: asText(data.weapon_name, "予備武器"),
        type,
        damage: asNum(data.damage, 20, 1, 999),
        mp_cost: asNum(data.mp_cost, 8, 0, 999),
        range,
        element,
        sprite_emoji: asText(data.sprite_emoji, "🗡️"),
        color: /^#[0-9A-Fa-f]{6}$/.test(asText(data.color, "")) ? asText(data.color, "#4B5563") : "#4B5563",
        attack_animation,
        description: asText(data.description, "生成武器"),
        uniqueness_score: asNum(data.uniqueness_score, 20, 0, 100),
    };
}

export function InputArea() {
    const [text, setText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isMagicMode, setIsMagicMode] = useState(false); // false = Weapon, true = Magic
    const [mp, setMp] = useState(100);

    useEffect(() => {
        const handleMp = (val: number) => setMp(val);
        GameEventBus.on("mp-update", handleMp);
        return () => {
            GameEventBus.off("mp-update", handleMp);
        };
    }, []);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const cost = isMagicMode ? 30 : 20;
        if (!text.trim() || isGenerating || mp < cost) return;

        // Note: Actual MP handling is ideally checked before this, but for simplicity
        // we'll let GameScene handle the MP deduction when it hears 'weapon-request'.
        setIsGenerating(true);
        GameEventBus.emit("weapon-request", isMagicMode ? 30 : 20);

        try {
            const res = await fetch("/api/generate-weapon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userInput: text, isMagic: isMagicMode }),
            });

            if (res.ok) {
                const weaponData = await res.json();
                const sanitized = sanitizeWeaponData(weaponData);
                console.warn("[weapon-debug] InputArea emit weapon-ready", sanitized);
                GameEventBus.emit("weapon-ready", sanitized);
            } else {
                const raw = await res.text().catch(() => "");
                const contentType = res.headers.get("content-type") || "unknown";
                const compactRaw = raw.replace(/\s+/g, " ").slice(0, 300);
                let details = compactRaw || "(empty body)";
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw) as Record<string, unknown>;
                        details = JSON.stringify(parsed);
                    } catch {
                        // Keep raw text snippet when body is not JSON.
                    }
                }
                console.error(
                    `Failed to generate weapon: status=${res.status} statusText=${res.statusText} contentType=${contentType} details=${details}`
                );
                GameEventBus.emit("weapon-ready", {
                    weapon_name: "失敗作の剣",
                    type: "melee",
                    damage: 1,
                    mp_cost: 0,
                    range: "short",
                    element: "none",
                    sprite_emoji: "💩",
                    color: "#888888",
                    attack_animation: "slash",
                    description: "生成に失敗した悲しい武器",
                    uniqueness_score: 0,
                    image_url: null
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGenerating(false);
            setText("");
        }
    };

    const startVoiceRecognition = () => {
        const win = window as Window & {
            SpeechRecognition?: new () => SpeechRecognition;
            webkitSpeechRecognition?: new () => SpeechRecognition;
        };
        const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("お使いのブラウザは音声認識に対応していません。");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ja-JP";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setText(transcript);
            // Auto submit after short delay
            setTimeout(() => {
                setText(transcript);
                document.getElementById("submit-btn")?.click();
            }, 500);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);

        recognition.start();
    };

    return (
        <div className="w-full max-w-[800px] mt-4 flex flex-col gap-2">
            <div className="flex bg-slate-200 p-1 rounded-lg self-start">
                <button
                    type="button"
                    onClick={() => setIsMagicMode(false)}
                    className={`px-4 py-2 text-sm rounded-md font-bold transition-colors ${!isMagicMode ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                    🗡️ 武器を作る (MP: 20)
                </button>
                <button
                    type="button"
                    onClick={() => setIsMagicMode(true)}
                    className={`px-4 py-2 text-sm rounded-md font-bold transition-colors ${isMagicMode ? "bg-white shadow text-purple-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                    ✨ 魔法を作る (MP: 30)
                </button>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 relative">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={!isMagicMode ? "どんな武器？（例：燃える大剣）" : "どんな魔法？（例：広範囲の爆発、回復魔法）"}
                    className="flex-1 px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:outline-none"
                    disabled={isGenerating || isListening}
                />

                <button
                    type="button"
                    onClick={startVoiceRecognition}
                    disabled={isGenerating || isListening}
                    className={`px-4 py-3 rounded-lg flex items-center justify-center transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                    title="音声入力"
                >
                    {isListening ? "🎤 録音中..." : "🎤"}
                </button>

                <button
                    id="submit-btn"
                    type="submit"
                    disabled={!text.trim() || isGenerating || isListening || mp < (isMagicMode ? 30 : 20)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                    {isGenerating ? "生成中..." : mp < (isMagicMode ? 30 : 20) ? "MP不足" : "生成 (Enter)"}
                </button>
            </form>
            <div className="text-xs text-slate-500 mt-2 ml-1">
                ※生成されたらスペースキーで攻撃！
            </div>
        </div>
    );
}
