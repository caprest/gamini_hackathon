"use client";

import { useState, useEffect } from "react";
import { DEFAULT_GAME_CONFIG } from "@/types/game";

const BOSS_SETTINGS_KEY = "bossSettings";

interface BossSettingsData {
    enabled: boolean;
    timeSec: number;
}

function loadSettings(): BossSettingsData {
    try {
        const raw = localStorage.getItem(BOSS_SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_GAME_CONFIG.bossEnabled,
                timeSec: typeof parsed.timeSec === "number" && parsed.timeSec > 0 ? parsed.timeSec : DEFAULT_GAME_CONFIG.bossSpawnTimeSec,
            };
        }
    } catch {
        // ignore
    }
    return { enabled: DEFAULT_GAME_CONFIG.bossEnabled, timeSec: DEFAULT_GAME_CONFIG.bossSpawnTimeSec };
}

export function BossSettings() {
    const [enabled, setEnabled] = useState(true);
    const [timeSec, setTimeSec] = useState(20);

    useEffect(() => {
        const s = loadSettings();
        setEnabled(s.enabled);
        setTimeSec(s.timeSec);
    }, []);

    const save = (newEnabled: boolean, newTime: number) => {
        const data: BossSettingsData = { enabled: newEnabled, timeSec: newTime };
        localStorage.setItem(BOSS_SETTINGS_KEY, JSON.stringify(data));
    };

    const handleToggle = () => {
        const next = !enabled;
        setEnabled(next);
        save(next, timeSec);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.max(1, Math.round(Number(e.target.value) || 1));
        setTimeSec(val);
        save(enabled, val);
    };

    return (
        <div className="flex items-center gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={handleToggle}
                    className="w-4 h-4 accent-red-500"
                />
                <span>👹 ボス戦</span>
            </label>
            {enabled && (
                <label className="flex items-center gap-1">
                    <input
                        type="number"
                        min={1}
                        max={999}
                        value={timeSec}
                        onChange={handleTimeChange}
                        className="w-16 px-2 py-1 rounded bg-slate-700 text-white text-center border border-slate-600 focus:border-red-500 focus:outline-none"
                    />
                    <span>秒後に出現</span>
                </label>
            )}
        </div>
    );
}
