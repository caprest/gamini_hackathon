"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const MENU_PAGES = ["/", "/create"];

export function MenuBgmProvider() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startedRef = useRef(false);
    const pathname = usePathname();
    const shouldPlay = MENU_PAGES.includes(pathname);

    const getAudio = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/bgm_menu.mp3");
            audioRef.current.loop = true;
            audioRef.current.volume = 0.5;
        }
        return audioRef.current;
    }, []);

    const tryPlay = useCallback(() => {
        if (!shouldPlay) return;
        const audio = getAudio();
        if (audio.paused) {
            audio.play().then(() => {
                startedRef.current = true;
            }).catch(() => {
                // Autoplay blocked — will retry on next user interaction
            });
        }
    }, [shouldPlay, getAudio]);

    // Start/stop based on route
    useEffect(() => {
        const audio = getAudio();
        if (shouldPlay) {
            tryPlay();
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }, [shouldPlay, getAudio, tryPlay]);

    // Listen for first user interaction to unlock audio
    useEffect(() => {
        if (!shouldPlay) return;

        const onInteraction = () => {
            if (!startedRef.current) {
                tryPlay();
            }
        };

        document.addEventListener("click", onInteraction, { once: false });
        document.addEventListener("keydown", onInteraction, { once: false });
        document.addEventListener("touchstart", onInteraction, { once: false });

        return () => {
            document.removeEventListener("click", onInteraction);
            document.removeEventListener("keydown", onInteraction);
            document.removeEventListener("touchstart", onInteraction);
        };
    }, [shouldPlay, tryPlay]);

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
