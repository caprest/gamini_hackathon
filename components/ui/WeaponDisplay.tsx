"use client";

import { useEffect, useState } from "react";
import { GameEventBus } from "@/game/EventBus";
import { WeaponData } from "@/types/game";

function WeaponSlot({ weapon, isActive }: { weapon: WeaponData; isActive: boolean }) {
    const elementLabel = weapon.element || "none";
    const damageLabel = Number.isFinite(Number(weapon.damage)) ? String(weapon.damage) : "20";

    if (!isActive) {
        return (
            <div className="flex items-center gap-1 min-h-[40px]">
                {weapon.image_url ? (
                    <img
                        src={weapon.image_url}
                        alt={weapon.weapon_name}
                        className="w-8 h-8 object-contain pixelated bg-transparent mix-blend-multiply rounded"
                    />
                ) : (
                    <span className="text-xl">{weapon.sprite_emoji}</span>
                )}
                <div className="text-xs truncate">
                    <div className="font-semibold truncate" style={{ color: weapon.color }}>
                        {weapon.weapon_name}
                    </div>
                    <div className="text-slate-400">DMG:{damageLabel}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {weapon.image_url ? (
                <img
                    src={weapon.image_url}
                    alt={weapon.weapon_name}
                    className="w-12 h-12 object-contain pixelated bg-transparent mix-blend-multiply rounded"
                />
            ) : (
                <div className="text-3xl">{weapon.sprite_emoji}</div>
            )}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: weapon.color }}>
                    {weapon.weapon_name}
                </div>
                <div className="text-xs text-slate-600 truncate">{weapon.description}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                    {elementLabel} | DMG:{damageLabel}
                </div>
            </div>
        </div>
    );
}

export function WeaponDisplay() {
    const [weapons, setWeapons] = useState<WeaponData[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isCharging, setIsCharging] = useState(false);

    useEffect(() => {
        const handleCharging = () => {
            setIsCharging(true);
        };

        const handleUpdate = (data: { weapons: WeaponData[]; activeIndex: number }) => {
            setIsCharging(false);
            setWeapons(data.weapons);
            setActiveIndex(data.activeIndex);
        };

        GameEventBus.on("weapon-charging", handleCharging);
        GameEventBus.on("weapons-update", handleUpdate);

        return () => {
            GameEventBus.off("weapon-charging", handleCharging);
            GameEventBus.off("weapons-update", handleUpdate);
        };
    }, []);

    if (isCharging) {
        return (
            <div className="bg-yellow-100 border-2 border-yellow-400 p-4 rounded-lg animate-pulse text-center">
                <span className="text-yellow-700 font-bold ml-2">チャージ中... (AI生成中)</span>
            </div>
        );
    }

    if (weapons.length === 0) {
        return (
            <div className="bg-slate-100 border-2 border-slate-300 p-4 rounded-lg text-center text-slate-500">
                テキストか音声を入力して武器を生成してください
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    className={`border-2 rounded-lg p-2 flex-1 min-w-0 transition-colors ${
                        weapons[i]
                            ? i === activeIndex
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-200 bg-white"
                            : "border-dashed border-slate-200 bg-slate-50"
                    }`}
                >
                    <div className="text-xs text-slate-400 font-mono mb-1">#{i + 1}</div>
                    {weapons[i] ? (
                        <WeaponSlot weapon={weapons[i]} isActive={i === activeIndex} />
                    ) : (
                        <div className="text-xs text-slate-300 text-center py-2">空</div>
                    )}
                </div>
            ))}
        </div>
    );
}
