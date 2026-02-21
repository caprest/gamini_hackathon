"use client";

import { useState, useEffect, useCallback } from "react";

const USAGE_KEY = "geminiApiUsage";
const DAILY_LIMIT = 20;

interface UsageData {
    date: string;
    count: number;
}

function getToday(): string {
    return new Date().toISOString().slice(0, 10);
}

function loadUsage(): UsageData {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.date === getToday()) {
                return { date: parsed.date, count: parsed.count || 0 };
            }
        }
    } catch {
        // ignore
    }
    return { date: getToday(), count: 0 };
}

export function incrementApiUsage() {
    const usage = loadUsage();
    usage.count += 1;
    usage.date = getToday();
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    window.dispatchEvent(new Event("api-usage-update"));
}

export function ApiUsageIndicator() {
    const [count, setCount] = useState(0);

    const refresh = useCallback(() => {
        setCount(loadUsage().count);
    }, []);

    useEffect(() => {
        refresh();
        window.addEventListener("api-usage-update", refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener("api-usage-update", refresh);
            window.removeEventListener("storage", refresh);
        };
    }, [refresh]);

    const ratio = Math.min(count / DAILY_LIMIT, 1);
    const remaining = Math.max(DAILY_LIMIT - count, 0);

    let barColor = "bg-green-500";
    let textColor = "text-green-400";
    if (ratio > 0.7) {
        barColor = "bg-yellow-500";
        textColor = "text-yellow-400";
    }
    if (ratio > 0.9) {
        barColor = "bg-red-500";
        textColor = "text-red-400";
    }

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">API</span>
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${barColor} rounded-full transition-all duration-300`}
                    style={{ width: `${ratio * 100}%` }}
                />
            </div>
            <span className={`font-mono ${textColor}`}>
                {remaining}/{DAILY_LIMIT}
            </span>
        </div>
    );
}
