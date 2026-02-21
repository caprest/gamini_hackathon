"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MENU_PAGES = ["/", "/create"];

export function MenuBgmProvider() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pathname = usePathname();
    const shouldPlay = MENU_PAGES.includes(pathname);

    // Try to play audio, safe to call multiple times
    const tryResume = () => {
        const el = audioRef.current;
        if (!el || !shouldPlay) return;
        if (el.paused) {
            el.play().catch(() => { /* will retry on next interaction */ });
        }
    };

    // Attach global interaction listeners to unlock audio on first user gesture
    useEffect(() => {
        if (!shouldPlay) return;

        const handler = () => tryResume();

        // Use capture phase to fire before click handlers that cause navigation
        document.addEventListener("pointerdown", handler, true);
        document.addEventListener("keydown", handler, true);

        // Also try immediately in case audio context is already unlocked
        tryResume();

        return () => {
            document.removeEventListener("pointerdown", handler, true);
            document.removeEventListener("keydown", handler, true);
        };
    });

    // Stop BGM when navigating away from menu pages
    useEffect(() => {
        if (!shouldPlay && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [shouldPlay]);

    if (!shouldPlay) return null;

    return (
        <audio
            ref={audioRef}
            src="/sounds/bgm_menu.mp3"
            loop
            autoPlay
            // @ts-expect-error webkit vendor attribute for iOS
            playsInline="true"
            style={{ display: "none" }}
        />
    );
}
