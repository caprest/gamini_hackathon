"use client";

export function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
    const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    return (
        <div className="w-full">
            <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                <span>HP</span>
                <span>{Math.ceil(hp)} / {maxHp}</span>
            </div>
            <div className="w-full h-4 bg-slate-300 rounded-full overflow-hidden">
                <div
                    className="h-full bg-red-500 transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export function MPBar({ mp, maxMp }: { mp: number; maxMp: number }) {
    const percentage = Math.max(0, Math.min(100, (mp / maxMp) * 100));

    return (
        <div className="w-full">
            <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                <span>MP</span>
                <span>{Math.ceil(mp)} / {maxMp}</span>
            </div>
            <div className="w-full h-4 bg-slate-300 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
