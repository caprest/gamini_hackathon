import * as Phaser from "phaser";

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super("MainMenuScene");
    }

    create() {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x87ceeb).setOrigin(0, 0);
        this.add.text(width / 2, height / 3, "No Jump Dinosaur", {
            fontSize: "48px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        // Start Button
        const startButton = this.add.text(width / 2, height / 2 + 50, "PRESS SPACE TO START", {
            fontSize: "24px",
            color: "#000000",
            backgroundColor: "#ffffff",
            padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive();

        // Blinking effect for start button
        this.tweens.add({
            targets: startButton,
            alpha: 0.5,
            yoyo: true,
            repeat: -1,
            duration: 800,
        });

        startButton.on("pointerdown", () => {
            this.startGame();
        });

        this.input.keyboard!.once("keydown-SPACE", () => {
            this.startGame();
        });
    }

    private startGame() {
        this.scene.start("GameScene");
    }
}
