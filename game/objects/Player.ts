import * as Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player");

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Force strictly 64x64 so AI generated images don't cover the screen/hitbox
        this.setDisplaySize(64, 64);

        // Physics setup
        this.setCollideWorldBounds(true);
        this.setGravityY(1000);

        // Adjust hitbox
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(this.width * 0.6, this.height * 0.8);
        body.setOffset(this.width * 0.2, this.height * 0.2);

        // Make background transparent over game elements
        this.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    jump() {
        // In "No Jump Dinosaur", the player doesn't jump!
        // But we might add a small hop effect or dodge later.
        // For now, do nothing.
    }
}
