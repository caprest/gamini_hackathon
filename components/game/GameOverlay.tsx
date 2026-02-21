"use client";

import { useEffect, useState } from "react";
import { GameEventBus } from "@/game/EventBus";
import { HPBar, MPBar } from "@/components/ui/Bars";
import { DEFAULT_GAME_CONFIG } from "@/types/game";

export default function GameOverlay() {
    const [hp, setHp] = useState(DEFAULT_GAME_CONFIG.initialHP);
    const [mp, setMp] = useState(DEFAULT_GAME_CONFIG.initialMP);
    const [score, setScore] = useState(0);

    useEffect(() => {
        const handleHpUpdate = (newHp: number) => setHp(newHp);
        const handleMpUpdate = (newMp: number) => setMp(newMp);
        const handleScoreUpdate = (newScore: number) => setScore(newScore);

        GameEventBus.on("hp-update", handleHpUpdate);
        GameEventBus.on("mp-update", handleMpUpdate);
        GameEventBus.on("score-update", handleScoreUpdate);

        return () => {
            GameEventBus.off("hp-update", handleHpUpdate);
            GameEventBus.off("mp-update", handleMpUpdate);
            GameEventBus.off("score-update", handleScoreUpdate);
        };
    }, []);

    return (
        <div className="absolute top-0 left-0 w-full p-4 flex gap-8 items-start pointer-events-none drop-shadow-md">
            <div className="flex-1 max-w-[200px]">
                <HPBar hp={hp} maxHp={DEFAULT_GAME_CONFIG.initialHP} />
            </div>
            <div className="flex-1 max-w-[200px]">
                <MPBar mp={mp} maxMp={DEFAULT_GAME_CONFIG.initialMP} />
            </div>
            <div className="ml-auto text-right font-bold bg-white/80 px-4 py-2 rounded-lg border-2 border-slate-300">
                <div className="text-slate-500 text-xs">SCORE</div>
                <div className="text-2xl font-mono text-slate-800">{score.toString().padStart(6, '0')}</div>
            </div>
        </div>
    );
}
