"use client";

import { useEffect, useRef } from "react";
import { GAME_CONFIG } from "@/game/config";

export default function GameCanvas() {
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        const initGame = async () => {
            const Phaser = await import("phaser");
            if (!gameRef.current) {
                gameRef.current = new Phaser.Game(GAME_CONFIG);
            }
        };
        initGame();

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="flex justify-center items-center w-full max-w-[800px] h-[300px] bg-slate-100 rounded-lg overflow-hidden shadow-lg border-2 border-slate-300">
            <div id="game-container" className="w-full h-full" />
        </div>
    );
}
