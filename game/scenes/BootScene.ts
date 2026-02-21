import * as Phaser from "phaser";

export class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    preload() {
        // Load BGM
        this.load.audio("bgm", "sounds/bgm.mp3");

        // Generate simple particle texture
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 4, 4);
        graphics.generateTexture("particle", 4, 4);

        // Check for custom player image
        const customPlayerImage = localStorage.getItem("customPlayerImage");
        if (customPlayerImage) {
            this.load.image("player", customPlayerImage);
        } else {
            this.createEmojiTexture("player", "🦕", 48);
        }
        this.createEmojiTexture("cactus_small", "🌵", 32);
        this.createEmojiTexture("cactus_large", "🌵", 48);
        this.createEmojiTexture("fire_wall", "🔥", 48);
        this.createEmojiTexture("spike", "⚡", 32);
        this.createEmojiTexture("pteranodon", "🦅", 40);
        this.createEmojiTexture("boss", "👹", 64);
        this.createEmojiTexture("dino_updown", "🐍", 48);
        this.createEmojiTexture("dino_leftright", "🐊", 48);
        this.createEmojiTexture("heart", "❤️", 24);
        this.createEmojiTexture("magic", "✨", 24);

        // Create simple ground texture
        const groundGraphics = this.make.graphics({ x: 0, y: 0 });
        groundGraphics.fillStyle(0xC4A265, 1);
        groundGraphics.fillRect(0, 0, 32, 32);
        groundGraphics.fillStyle(0x8B7242, 1);
        groundGraphics.fillRect(0, 0, 16, 16);
        groundGraphics.fillRect(16, 16, 16, 16);
        groundGraphics.generateTexture("ground", 32, 32);
    }

    create() {
        this.scene.start("MainMenuScene");
    }

    private createEmojiTexture(key: string, emoji: string, size: number = 48) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.font = `${size * 0.8}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, size / 2, size / 2);
        this.textures.addCanvas(key, canvas);
    }
}
