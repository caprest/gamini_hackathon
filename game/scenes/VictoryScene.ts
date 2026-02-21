import * as Phaser from "phaser";
import { GameEventBus } from "../EventBus";

export class VictoryScene extends Phaser.Scene {
    private finalScore: number = 0;
    private stage: number = 1;
    private audioCtx: AudioContext | null = null;

    constructor() {
        super("VictoryScene");
    }

    init(data: { score: number; stage: number }) {
        this.finalScore = data.score || 0;
        this.stage = data.stage || 1;
    }

    create() {
        const { width, height } = this.scale;

        // Golden background
        this.add.rectangle(0, 0, width, height, 0x1a0a00).setOrigin(0, 0);

        // Animated star particles
        const starEmitter = this.add.particles(width / 2, 0, "particle", {
            x: { min: -width / 2, max: width / 2 },
            y: { min: 0, max: height },
            speed: { min: 10, max: 40 },
            angle: { min: 250, max: 290 },
            scale: { start: 1.5, end: 0 },
            lifespan: 3000,
            frequency: 80,
            tint: [0xffd700, 0xffec8b, 0xffa500],
            blendMode: "ADD",
        });
        this.time.delayedCall(8000, () => starEmitter.stop());

        // Flash
        const flash = this.add.rectangle(0, 0, width, height, 0xffd700, 0.6).setOrigin(0, 0);
        this.tweens.add({ targets: flash, alpha: 0, duration: 800, onComplete: () => flash.destroy() });

        // --- STAGE CLEAR text ---
        const clearLabel = this.add.text(width / 2, height * 0.18, `STAGE ${this.stage}`, {
            fontSize: "20px",
            color: "#ffd700",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3,
        }).setOrigin(0.5).setAlpha(0);

        const clearText = this.add.text(width / 2, height * 0.40, "STAGE CLEAR!", {
            fontSize: "48px",
            color: "#ffd700",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 6,
        }).setOrigin(0.5).setScale(0.1);

        // Pop-in animation
        this.tweens.add({
            targets: clearText,
            scale: 1,
            duration: 500,
            ease: "Back.easeOut",
        });
        this.tweens.add({
            targets: clearLabel,
            alpha: 1,
            duration: 400,
            delay: 300,
        });

        // --- Score display ---
        const scoreLabel = this.add.text(width / 2, height * 0.62, "SCORE", {
            fontSize: "16px",
            color: "#ccaa44",
            letterSpacing: 4,
        }).setOrigin(0.5).setAlpha(0);

        const scoreText = this.add.text(width / 2, height * 0.76, `${this.finalScore}`, {
            fontSize: "36px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: [scoreLabel, scoreText],
            alpha: 1,
            duration: 600,
            delay: 700,
        });

        // --- Next button (appears after delay) ---
        const nextBtn = this.add.text(width / 2, height * 0.92, "▶ 次のステージへ (SPACE)", {
            fontSize: "18px",
            color: "#1a0a00",
            backgroundColor: "#ffd700",
            padding: { x: 24, y: 8 },
            fontStyle: "bold",
        }).setOrigin(0.5).setInteractive().setAlpha(0);

        this.tweens.add({
            targets: nextBtn,
            alpha: 1,
            duration: 400,
            delay: 1800,
            onComplete: () => {
                // Blink
                this.tweens.add({
                    targets: nextBtn,
                    alpha: 0.6,
                    yoyo: true,
                    repeat: -1,
                    duration: 700,
                });
            },
        });

        nextBtn.on("pointerdown", () => this.goNextStage());
        // Delay keyboard to prevent accidental skip
        this.time.delayedCall(2000, () => {
            this.input.keyboard!.once("keydown-SPACE", () => this.goNextStage());
        });

        // Play victory fanfare
        this.playVictoryFanfare();

        // Notify React layer
        GameEventBus.emit("stage-clear", { score: this.finalScore, stage: this.stage });
    }

    private goNextStage() {
        this.stopAudio();
        this.scene.start("GameScene", { stage: this.stage + 1 });
    }

    private playVictoryFanfare() {
        try {
            const ctx = new AudioContext();
            this.audioCtx = ctx;

            // Victory fanfare: C-E-G-C(high) arpeggio + sustained chord
            const notes = [
                { freq: 523.25, start: 0, dur: 0.2 },      // C5
                { freq: 659.25, start: 0.15, dur: 0.2 },    // E5
                { freq: 783.99, start: 0.30, dur: 0.2 },    // G5
                { freq: 1046.50, start: 0.45, dur: 0.6 },   // C6 (held)
                // Sustained chord
                { freq: 523.25, start: 0.55, dur: 1.2 },    // C5
                { freq: 659.25, start: 0.55, dur: 1.2 },    // E5
                { freq: 783.99, start: 0.55, dur: 1.2 },    // G5
                { freq: 1046.50, start: 0.55, dur: 1.2 },   // C6
            ];

            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.15;
            masterGain.connect(ctx.destination);

            for (const note of notes) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.value = note.freq;

                gain.gain.setValueAtTime(0, ctx.currentTime + note.start);
                gain.gain.linearRampToValueAtTime(1, ctx.currentTime + note.start + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.start + note.dur);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(ctx.currentTime + note.start);
                osc.stop(ctx.currentTime + note.start + note.dur + 0.05);
            }

            // Second phrase (triumphant resolution) after short pause
            const phrase2 = [
                { freq: 783.99, start: 2.0, dur: 0.15 },    // G5
                { freq: 880.00, start: 2.12, dur: 0.15 },   // A5
                { freq: 987.77, start: 2.24, dur: 0.15 },   // B5
                { freq: 1046.50, start: 2.36, dur: 0.8 },   // C6 (held)
                // Final chord
                { freq: 523.25, start: 2.50, dur: 1.5 },    // C5
                { freq: 659.25, start: 2.50, dur: 1.5 },    // E5
                { freq: 783.99, start: 2.50, dur: 1.5 },    // G5
                { freq: 1046.50, start: 2.50, dur: 1.5 },   // C6
                { freq: 1318.51, start: 2.50, dur: 1.5 },   // E6
            ];

            for (const note of phrase2) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.value = note.freq;

                gain.gain.setValueAtTime(0, ctx.currentTime + note.start);
                gain.gain.linearRampToValueAtTime(1, ctx.currentTime + note.start + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.start + note.dur);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(ctx.currentTime + note.start);
                osc.stop(ctx.currentTime + note.start + note.dur + 0.05);
            }
        } catch {
            // Audio not available — silently skip
        }
    }

    private stopAudio() {
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
    }

    shutdown() {
        this.stopAudio();
    }
}
