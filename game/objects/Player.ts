import * as Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player");

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Physics setup
        this.setCollideWorldBounds(true);
        this.setGravityY(1000);

        // Adjust hitbox
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(this.width * 0.6, this.height * 0.8);
        body.setOffset(this.width * 0.2, this.height * 0.2);
    }

    jump() {
        // In "No Jump Dinosaur", the player doesn't jump!
        // But we might add a small hop effect or dodge later.
        // For now, do nothing.
    }
}
