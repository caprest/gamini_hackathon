"use client";

import { useState } from "react";
import { GameEventBus } from "@/game/EventBus";

export function InputArea() {
    const [text, setText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!text.trim() || isGenerating) return;

        // Note: Actual MP handling is ideally checked before this, but for simplicity
        // we'll let GameScene handle the MP deduction when it hears 'weapon-request'.
        setIsGenerating(true);
        GameEventBus.emit("weapon-request");

        try {
            const res = await fetch("/api/generate-weapon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userInput: text }),
            });

            if (res.ok) {
                const weaponData = await res.json();
                GameEventBus.emit("weapon-ready", weaponData);
            } else {
                console.error("Failed to generate weapon");
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
        const win = window as any;
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
        <div className="w-full max-w-[800px] mt-4">
            <form onSubmit={handleSubmit} className="flex gap-2 relative">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="どんな武器を作る？（例：燃える大きな剣、バナナ）"
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
                    disabled={!text.trim() || isGenerating || isListening}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                    {isGenerating ? "生成中..." : "生成 (Enter)"}
                </button>
            </form>
            <div className="text-xs text-slate-500 mt-2 ml-1">
                ※生成されたらスペースキーで攻撃！
            </div>
        </div>
    );
}
