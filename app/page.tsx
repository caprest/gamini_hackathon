import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
      <div className="text-center">
        <div className="text-9xl mb-8 animate-bounce">🦕</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tighter">
          NO JUMP DINOSAUR
        </h1>
        <p className="text-xl text-slate-300 mb-12">
          言葉が武器になる、新しいDino Game
        </p>

        <div className="flex flex-col gap-4 items-center">
          <Link
            href="/game"
            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xl rounded-full transition-transform hover:scale-105 inline-block"
          >
            START GAME
          </Link>

          <Link
            href="/create"
            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-full transition-colors inline-block mt-4"
          >
            キャラクター作成 (Banana API)
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 text-slate-500 text-sm">
        Powered by Next.js, Phaser.js & Gemini 2.0 Flash
      </div>
    </main>
  );
}
