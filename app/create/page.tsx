"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function CreateCharacterPage() {
    const [description, setDescription] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || isGenerating) return;

        setIsGenerating(true);
        setError(null);
        setResultImage(null);

        try {
            const res = await fetch("/api/generate-character", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.imageUrl) {
                    setResultImage(data.imageUrl);
                } else if (data.emojiFallback) {
                    setError(`APIキーが設定されていないため、フォールバック絵文字(${data.emojiFallback})が選択されました。`);
                }
            } else {
                setError(data.error || "生成に失敗しました");
            }
        } catch (err: any) {
            setError(err.message || "通信エラーが発生しました");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-900 p-8 flex flex-col items-center justify-center font-sans text-white">
            <div className="w-full max-w-[600px] mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-wider text-green-400">CHARACTER MAKER</h1>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                    ← 戻る
                </Link>
            </div>

            <div className="w-full max-w-[600px] bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
                <p className="text-slate-300 mb-6">
                    あなたが作りたい恐竜キャラクターの特徴を入力してください。Banana APIがドット絵スプライトを生成します。
                </p>

                <form onSubmit={handleGenerate} className="flex flex-col gap-4 mb-8">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="例: 青い鎧を着た勇者、炎のドラゴン騎士"
                        className="w-full h-24 px-4 py-3 bg-slate-700 rounded-lg border-2 border-slate-600 focus:border-green-500 focus:outline-none resize-none"
                        disabled={isGenerating}
                    />
                    <button
                        type="submit"
                        disabled={!description.trim() || isGenerating}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 font-bold text-xl rounded-lg disabled:opacity-50 transition-colors"
                    >
                        {isGenerating ? "🦖 生成中 (約10~20秒)..." : "生成する"}
                    </button>
                </form>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {resultImage && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        <h2 className="text-xl font-bold mb-4 text-green-300">🎉 生成成功！</h2>
                        <div className="bg-slate-700 p-4 rounded-lg mb-6">
                            <Image
                                src={resultImage}
                                alt="Generated Character"
                                width={256}
                                height={256}
                                className="pixelated"
                                unoptimized
                            />
                        </div>

                        <Link
                            href="/game"
                            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-full transition-transform hover:scale-105"
                        >
                            このキャラでゲームを始める
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
