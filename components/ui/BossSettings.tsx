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

    const handleToggle = (value: boolean) => {
        setEnabled(value);
        save(value, timeSec);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.max(1, Math.round(Number(e.target.value) || 1));
        setTimeSec(val);
        save(enabled, val);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-6">
            <span className="text-lg">👹</span>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="radio"
                        name="bossMode"
                        checked={enabled}
                        onChange={() => handleToggle(true)}
                        className="w-4 h-4 accent-red-500"
                    />
                    <span className={`text-sm font-bold ${enabled ? "text-red-400" : "text-slate-500"}`}>
                        ボス戦ON
                    </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="radio"
                        name="bossMode"
                        checked={!enabled}
                        onChange={() => handleToggle(false)}
                        className="w-4 h-4 accent-slate-400"
                    />
                    <span className={`text-sm font-bold ${!enabled ? "text-slate-300" : "text-slate-500"}`}>
                        OFF
                    </span>
                </label>
            </div>
            {enabled && (
                <label className="flex items-center gap-1 text-sm text-slate-400 ml-auto">
                    <input
                        type="number"
                        min={1}
                        max={999}
                        value={timeSec}
                        onChange={handleTimeChange}
                        className="w-14 px-2 py-1 rounded bg-slate-700 text-white text-center border border-slate-600 focus:border-red-500 focus:outline-none text-sm"
                    />
                    <span>秒後に出現</span>
                </label>
            )}
        </div>
    );
}
