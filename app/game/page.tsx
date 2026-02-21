"use client";

import dynamic from "next/dynamic";
import GameOverlay from "@/components/game/GameOverlay";
import { WeaponDisplay } from "@/components/ui/WeaponDisplay";
import { InputArea } from "@/components/ui/InputArea";
import { CameraCapture } from "@/components/ui/CameraCapture";
import { BossSettings } from "@/components/ui/BossSettings";
import Link from "next/link";
import { Suspense } from "react";

// Phaser instance must be dynamically imported with ssr: false
const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
    ssr: false,
});

export default function GamePage() {
    return (
        <main className="min-h-screen bg-slate-900 p-8 flex flex-col items-center justify-center font-sans">
            <div className="w-full max-w-[800px] mb-4 flex justify-between items-center text-white">
                <h1 className="text-2xl font-bold tracking-wider">NO JUMP DINOSAUR</h1>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                    ← タイトルに戻る
                </Link>
            </div>

            <div className="w-full max-w-[800px] mb-3">
                <BossSettings />
            </div>

            <div className="relative w-full max-w-[800px]">
                {/* React Error Boundary / Suspense for Phaser loading */}
                <Suspense fallback={<div className="w-[800px] h-[300px] bg-slate-800 animate-pulse rounded-lg" />}>
                    <GameCanvas />
                </Suspense>
                <GameOverlay />
            </div>

            <div className="w-full max-w-[800px] mt-6">
                <WeaponDisplay />
            </div>

            <div className="w-full max-w-[800px] mt-4 flex gap-2 items-start">
                <div className="flex-1">
                    <InputArea />
                </div>
                <div className="pt-0">
                    <CameraCapture />
                </div>
            </div>
        </main>
    );
}
