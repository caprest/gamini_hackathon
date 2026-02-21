"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MENU_PAGES = ["/", "/create"];

export function MenuBgmProvider() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pathname = usePathname();
    const shouldPlay = MENU_PAGES.includes(pathname);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/bgm_menu.mp3");
            audioRef.current.loop = true;
            audioRef.current.volume = 0.5;
        }

        if (shouldPlay) {
            if (audioRef.current.paused) {
                audioRef.current.play().catch((e) =>
                    console.warn("Menu BGM autoplay prevented:", e)
                );
            }
        } else {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [shouldPlay]);

    // Cleanup on full unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return null;
}
