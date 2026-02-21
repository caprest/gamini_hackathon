"use client";

import { useEffect, useState } from "react";
import { GameEventBus } from "@/game/EventBus";
import { WeaponData } from "@/types/game";

type ActiveMode = "weapon" | "magic";

interface InventoryState {
    weapons: WeaponData[];
    magics: WeaponData[];
    activeWeaponIndex: number;
    activeMagicIndex: number;
    activeMode: ActiveMode;
}

function ItemSlot({ item, isActive }: { item: WeaponData; isActive: boolean }) {
    const damageLabel = Number.isFinite(Number(item.damage)) ? String(item.damage) : "20";

    if (!isActive) {
        return (
            <div className="flex items-center gap-1 min-h-[40px]">
                {item.image_url ? (
                    <img
                        src={item.image_url}
                        alt={item.weapon_name}
                        className="w-8 h-8 object-contain pixelated bg-transparent mix-blend-multiply rounded"
                    />
                ) : (
                    <span className="text-xl">{item.sprite_emoji}</span>
                )}
                <div className="text-xs truncate">
                    <div className="font-semibold truncate" style={{ color: item.color }}>
                        {item.weapon_name}
                    </div>
                    <div className="text-slate-400">DMG:{damageLabel}</div>
                </div>
            </div>
        );
    }

    const elementLabel = item.element || "none";

    return (
        <div className="flex items-center gap-3">
            {item.image_url ? (
                <img
                    src={item.image_url}
                    alt={item.weapon_name}
                    className="w-12 h-12 object-contain pixelated bg-transparent mix-blend-multiply rounded"
                />
            ) : (
                <div className="text-3xl">{item.sprite_emoji}</div>
            )}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: item.color }}>
                    {item.weapon_name}
                </div>
                <div className="text-xs text-slate-600 truncate">{item.description}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                    {elementLabel} | DMG:{damageLabel}
                </div>
            </div>
        </div>
    );
}

function SlotRow({
    label,
    items,
    activeIndex,
    isActiveMode,
    slotCount,
}: {
    label: string;
    items: WeaponData[];
    activeIndex: number;
    isActiveMode: boolean;
    slotCount: number;
}) {
    return (
        <div>
            <div className={`text-xs font-bold mb-1 ${isActiveMode ? "text-slate-700" : "text-slate-400"}`}>
                {label} {isActiveMode && "(選択中)"}
            </div>
            <div className="flex gap-2">
                {Array.from({ length: slotCount }, (_, i) => (
                    <div
                        key={i}
                        className={`border-2 rounded-lg p-2 flex-1 min-w-0 transition-colors ${
                            items[i]
                                ? isActiveMode && i === activeIndex
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-slate-200 bg-white"
                                : "border-dashed border-slate-200 bg-slate-50"
                        }`}
                    >
                        <div className="text-xs text-slate-400 font-mono mb-1">#{label.includes("魔法") ? i + 4 : i + 1}</div>
                        {items[i] ? (
                            <ItemSlot item={items[i]} isActive={isActiveMode && i === activeIndex} />
                        ) : (
                            <div className="text-xs text-slate-300 text-center py-2">空</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WeaponDisplay() {
    const [state, setState] = useState<InventoryState>({
        weapons: [],
        magics: [],
        activeWeaponIndex: 0,
        activeMagicIndex: 0,
        activeMode: "weapon",
    });
    const [isCharging, setIsCharging] = useState(false);

    useEffect(() => {
        const handleCharging = () => setIsCharging(true);
        const handleUpdate = (data: InventoryState) => {
            setIsCharging(false);
            setState(data);
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

    if (state.weapons.length === 0 && state.magics.length === 0) {
        return (
            <div className="bg-slate-100 border-2 border-slate-300 p-4 rounded-lg text-center text-slate-500">
                テキストか音声を入力して武器・魔法を生成してください
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <SlotRow
                label="🗡️ 武器"
                items={state.weapons}
                activeIndex={state.activeWeaponIndex}
                isActiveMode={state.activeMode === "weapon"}
                slotCount={3}
            />
            <SlotRow
                label="✨ 魔法"
                items={state.magics}
                activeIndex={state.activeMagicIndex}
                isActiveMode={state.activeMode === "magic"}
                slotCount={3}
            />
            <div className="text-xs text-slate-400 text-center">
                1,2,3で武器選択 | 4,5,6で魔法選択
            </div>
        </div>
    );
}
