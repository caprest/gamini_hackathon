import * as Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
    static readonly DISPLAY_SIZE = 64;
    static readonly HITBOX_WIDTH = 38;
    static readonly HITBOX_HEIGHT = 52;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player");

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Force strictly 64x64 so AI generated images don't cover the screen/hitbox
        this.setDisplaySize(Player.DISPLAY_SIZE, Player.DISPLAY_SIZE);

        // Physics setup
        this.setCollideWorldBounds(true);
        this.setGravityY(1000);

        // Adjust hitbox
        this.applyFixedHitbox();

        // Make background transparent over game elements
        this.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    jump() {
        // In "No Jump Dinosaur", the player doesn't jump!
        // But we might add a small hop effect or dodge later.
        // For now, do nothing.
    }

    private applyFixedHitbox() {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const safeScaleX = this.scaleX || 1;
        const safeScaleY = this.scaleY || 1;

        // Arcade body size/offset are in unscaled texture units.
        // Convert from desired display-space hitbox to texture-space values.
        body.setSize(Player.HITBOX_WIDTH / safeScaleX, Player.HITBOX_HEIGHT / safeScaleY);
        body.setOffset(
            ((Player.DISPLAY_SIZE - Player.HITBOX_WIDTH) / 2) / safeScaleX,
            ((Player.DISPLAY_SIZE - Player.HITBOX_HEIGHT) / 2) / safeScaleY
        );
    }
}
