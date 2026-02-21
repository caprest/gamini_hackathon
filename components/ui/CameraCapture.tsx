"use client";

import { useState, useRef, useEffect } from "react";
import { GameEventBus } from "@/game/EventBus";
import { processWeaponImage } from "@/lib/imageProcessor";
import { incrementApiUsage } from "@/components/ui/ApiUsageIndicator";

type Phase = "idle" | "processing" | "preview" | "generating";

const CAMERA_WEAPONS_KEY = "savedCameraWeapons";
const MAX_SAVED = 3;

function saveCameraWeapon(weapon: Record<string, unknown>) {
    try {
        const raw = localStorage.getItem(CAMERA_WEAPONS_KEY);
        const list: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
        list.push(weapon);
        // Keep only the latest MAX_SAVED
        while (list.length > MAX_SAVED) list.shift();
        localStorage.setItem(CAMERA_WEAPONS_KEY, JSON.stringify(list));
    } catch {
        // localStorage full or unavailable — ignore
    }
}

export function CameraCapture() {
    const [phase, setPhase] = useState<Phase>("idle");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState("");
    const [hasStoredImages, setHasStoredImages] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const check = () => {
            const hasPlayer = !!localStorage.getItem("customPlayerImage");
            const hasWeapons = !!localStorage.getItem(CAMERA_WEAPONS_KEY);
            setHasStoredImages(hasPlayer || hasWeapons);
        };
        check();
        window.addEventListener("storage", check);
        return () => window.removeEventListener("storage", check);
    }, []);

    const clearStoredImages = () => {
        localStorage.removeItem("customPlayerImage");
        localStorage.removeItem(CAMERA_WEAPONS_KEY);
        setHasStoredImages(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPhase("processing");
        setProgress("背景を除去中...");

        try {
            const { apiImage, spriteImage } = await processWeaponImage(file);
            setPreviewUrl(apiImage);
            setSpriteUrl(spriteImage);
            setPhase("preview");
        } catch (err) {
            console.error("Image processing failed:", err);
            // Fallback: use original image resized without bg removal
            setProgress("背景除去に失敗。元画像を使用...");
            try {
                const { resizeToGameSprite } = await import("@/lib/imageProcessor");
                const [apiImage, spriteImage] = await Promise.all([
                    resizeToGameSprite(file, 512),
                    resizeToGameSprite(file, 48),
                ]);
                setPreviewUrl(apiImage);
                setSpriteUrl(spriteImage);
                setPhase("preview");
            } catch {
                setPhase("idle");
                alert("画像の処理に失敗しました。もう一度お試しください。");
            }
        }

        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleConfirm = async () => {
        if (!previewUrl) return;

        setPhase("generating");
        GameEventBus.emit("weapon-request", 20);

        try {
            incrementApiUsage();
            const res = await fetch("/api/generate-weapon-from-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageDataUrl: previewUrl }),
            });

            if (res.ok) {
                const weaponData = await res.json();
                weaponData.image_url = spriteUrl;
                saveCameraWeapon(weaponData);
                GameEventBus.emit("weapon-ready", weaponData);
            } else {
                console.error("Failed to generate weapon from image:", res.status);
                const fallback = {
                    weapon_name: "撮影物体の剣",
                    type: "melee" as const,
                    damage: 15,
                    mp_cost: 5,
                    range: "short" as const,
                    element: "none" as const,
                    sprite_emoji: "📷",
                    color: "#888888",
                    attack_animation: "slash" as const,
                    description: "撮影に失敗した武器",
                    uniqueness_score: 10,
                    image_url: spriteUrl,
                };
                saveCameraWeapon(fallback);
                GameEventBus.emit("weapon-ready", fallback);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setPhase("idle");
            setPreviewUrl(null);
            setSpriteUrl(null);
        }
    };

    const handleRetry = () => {
        setPhase("idle");
        setPreviewUrl(null);
        setSpriteUrl(null);
        fileInputRef.current?.click();
    };

    const handleCancel = () => {
        setPhase("idle");
        setPreviewUrl(null);
        setSpriteUrl(null);
    };

    if (phase === "processing") {
        return (
            <div className="bg-yellow-100 border-2 border-yellow-400 p-3 rounded-lg animate-pulse text-center">
                <span className="text-yellow-700 font-bold">{progress}</span>
            </div>
        );
    }

    if (phase === "preview" && previewUrl) {
        return (
            <div className="bg-white border-2 border-blue-400 p-3 rounded-lg flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center border">
                    <img
                        src={previewUrl}
                        alt="weapon preview"
                        className="w-12 h-12 object-contain"
                    />
                </div>
                <div className="flex-1 text-sm text-slate-600">
                    この画像を武器にしますか？
                </div>
                <button
                    onClick={handleConfirm}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-colors"
                >
                    この武器を使う
                </button>
                <button
                    onClick={handleRetry}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm transition-colors"
                >
                    やり直す
                </button>
                <button
                    onClick={handleCancel}
                    className="px-2 py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                >
                    x
                </button>
            </div>
        );
    }

    if (phase === "generating") {
        return (
            <div className="bg-blue-100 border-2 border-blue-400 p-3 rounded-lg animate-pulse text-center">
                <span className="text-blue-700 font-bold">AI武器生成中...</span>
            </div>
        );
    }

    // idle
    return (
        <div className="flex gap-2">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                title="カメラで武器を撮影"
            >
                <span>📸</span>
                <span className="hidden sm:inline">撮影して武器化</span>
            </button>
            {hasStoredImages && (
                <button
                    onClick={clearStoredImages}
                    className="px-3 py-3 bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm"
                    title="保存された画像を削除"
                >
                    🗑
                </button>
            )}
        </div>
    );
}
