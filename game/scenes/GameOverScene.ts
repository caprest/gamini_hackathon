import * as Phaser from "phaser";
import { GameEventBus } from "../EventBus";

export class GameOverScene extends Phaser.Scene {
    private finalScore: number = 0;
    private cleared: boolean = false;

    constructor() {
        super("GameOverScene");
    }

    init(data: { score: number; cleared?: boolean }) {
        this.finalScore = data.score || 0;
        this.cleared = Boolean(data.cleared);
    }

    create() {
        const { width, height } = this.scale;

        // Dark overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0, 0);

        const title = this.cleared ? "GAME CLEAR" : "GAME OVER";
        const titleColor = this.cleared ? "#22c55e" : "#ff0000";
        this.add.text(width / 2, height / 3, title, {
            fontSize: "64px",
            color: titleColor,
            fontStyle: "bold",
        }).setOrigin(0.5);

        // Score
        this.add.text(width / 2, height / 2, `Score: ${this.finalScore}`, {
            fontSize: "32px",
            color: "#ffffff",
        }).setOrigin(0.5);

        // Restart Button
        const restartButton = this.add.text(width / 2, height / 2 + 80, "PRESS SPACE TO RETRY", {
            fontSize: "24px",
            color: "#000000",
            backgroundColor: "#ffffff",
            padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive();

        this.tweens.add({
            targets: restartButton,
            alpha: 0.5,
            yoyo: true,
            repeat: -1,
            duration: 800,
        });

        restartButton.on("pointerdown", () => {
            this.restartGame();
        });

        this.input.keyboard!.once("keydown-SPACE", () => {
            this.restartGame();
        });

        // Notify React layer
        GameEventBus.emit("game-over", this.finalScore);
    }

    private restartGame() {
        this.scene.start("GameScene");
    }
}
