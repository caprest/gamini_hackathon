"use client";

import { useEffect, useState } from "react";
import { GameEventBus } from "@/game/EventBus";
import { WeaponData } from "@/types/game";

export function WeaponDisplay() {
    const [weapon, setWeapon] = useState<WeaponData | null>(null);
    const [isCharging, setIsCharging] = useState(false);

    useEffect(() => {
        const handleCharging = () => {
            setIsCharging(true);
            setWeapon(null);
        };

        const handleReady = (newWeapon: WeaponData) => {
            console.warn("[weapon-debug] WeaponDisplay handleReady", newWeapon);
            setIsCharging(false);
            setWeapon(newWeapon);
        };

        const handleExecuted = () => {
            setWeapon(null);
        };

        GameEventBus.on("weapon-charging", handleCharging);
        GameEventBus.on("weapon-ready", handleReady);
        GameEventBus.on("attack-executed", handleExecuted);

        return () => {
            GameEventBus.off("weapon-charging", handleCharging);
            GameEventBus.off("weapon-ready", handleReady);
            GameEventBus.off("attack-executed", handleExecuted);
        };
    }, []);

    if (isCharging) {
        return (
            <div className="bg-yellow-100 border-2 border-yellow-400 p-4 rounded-lg animate-pulse text-center">
                <span className="text-yellow-700 font-bold ml-2">チャージ中... (AI生成中)</span>
            </div>
        );
    }

    if (!weapon) {
        return (
            <div className="bg-slate-100 border-2 border-slate-300 p-4 rounded-lg text-center text-slate-500">
                テキストか音声を入力して武器を生成してください
            </div>
        );
    }

    const elementLabel = weapon.element || "none";
    const damageLabel = Number.isFinite(Number(weapon.damage)) ? String(weapon.damage) : "20";
    const mpLabel = Number.isFinite(Number(weapon.mp_cost)) ? String(weapon.mp_cost) : "8";
    console.warn("[weapon-debug] WeaponDisplay render labels", {
        elementLabel,
        damageLabel,
        mpLabel,
        weapon,
    });

    return (
        <div
            className="bg-white border-2 p-4 rounded-lg flex items-center justify-between"
            style={{ borderColor: weapon.color }}
        >
            <div className="flex items-center gap-4">
                {weapon.image_url ? (
                    <img
                        src={weapon.image_url}
                        alt={weapon.weapon_name}
                        className="w-16 h-16 object-contain pixelated bg-transparent mix-blend-multiply rounded"
                    />
                ) : (
                    <div className="text-4xl">{weapon.sprite_emoji}</div>
                )}
                <div>
                    <div className="font-bold text-lg" style={{ color: weapon.color }}>
                        {weapon.weapon_name}
                    </div>
                    <div className="text-sm text-slate-600">
                        {weapon.description}
                    </div>
                </div>
            </div>

            <div className="text-right text-sm text-slate-900">
                <div className="grid grid-cols-2 gap-x-4">
                    <span className="text-slate-500">属性:</span>
                    <span className="font-semibold capitalize">{elementLabel}</span>

                    <span className="text-slate-500">ダメージ:</span>
                    <span className="font-semibold">{damageLabel}</span>

                    <span className="text-slate-500">消費MP:</span>
                    <span className="font-semibold text-blue-600">{mpLabel}</span>
                </div>
            </div>
        </div>
    );
}
