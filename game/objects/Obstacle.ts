import * as Phaser from "phaser";
import { ObstacleConfig } from "../../types/game";

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
    public config: ObstacleConfig;

    constructor(scene: Phaser.Scene, x: number, y: number, config: ObstacleConfig) {
        super(scene, x, y, config.sprite);

        this.config = config;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Physics setup
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setVelocityX(-config.speed);

        // Adjust hitboxes based on type
        if (config.type === "cactus_small") {
            body.setSize(this.width * 0.6, this.height * 0.8);
            body.setOffset(this.width * 0.2, this.height * 0.2);
        } else if (config.type === "fire_wall") {
            body.setSize(this.width * 0.8, this.height);
        }
    }

    takeDamage(amount: number): boolean {
        this.config.hp -= amount;

        // Flash white when hit
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });

        return this.config.hp <= 0;
    }
}
