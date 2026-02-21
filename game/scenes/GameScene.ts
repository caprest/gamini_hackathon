import * as Phaser from "phaser";
import { Player } from "../objects/Player";
import { Obstacle } from "../objects/Obstacle";
import { GameEventBus } from "../EventBus";
import { WeaponData, ObstacleConfig, DEFAULT_GAME_CONFIG } from "../../types/game";

const MAX_WEAPONS = 3;

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private obstacles!: Phaser.GameObjects.Group;
    private ground!: Phaser.GameObjects.TileSprite;

    private scrollSpeed: number = DEFAULT_GAME_CONFIG.baseScrollSpeed;
    private score: number = 0;
    private hp: number = DEFAULT_GAME_CONFIG.initialHP;
    private mp: number = DEFAULT_GAME_CONFIG.initialMP;

    private weapons: WeaponData[] = [];
    private weaponSprites: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
    private activeWeaponIndex: number = 0;
    private isCharging: boolean = false;
    private chargeEffect: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private spawnEvent!: Phaser.Time.TimerEvent;
    private mpRegenEvent!: Phaser.Time.TimerEvent;

    constructor() {
        super("GameScene");
    }

    create() {
        const { width, height } = this.scale;

        // Clean up previous weapon sprites
        this.weaponSprites.forEach(s => s.destroy());
        this.weaponSprites = [];
        this.weapons = [];
        this.activeWeaponIndex = 0;

        // Reset stats
        this.score = 0;
        this.hp = DEFAULT_GAME_CONFIG.initialHP;
        this.mp = DEFAULT_GAME_CONFIG.initialMP;
        this.scrollSpeed = DEFAULT_GAME_CONFIG.baseScrollSpeed;

        // Background sky
        this.add.rectangle(0, 0, width, height, 0x87ceeb).setOrigin(0, 0);

        // Ground
        this.ground = this.add.tileSprite(width / 2, height - 20, width, 40, "ground");
        this.physics.add.existing(this.ground, true); // static body

        // Player
        this.player = new Player(this, 100, height - 80);
        this.physics.add.collider(this.player, this.ground);

        // Obstacles (normal group to avoid overriding body properties set in Obstacle.ts)
        this.obstacles = this.add.group();

        // Hit detection
        this.physics.add.overlap(
            this.player,
            this.obstacles,
            this.onHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        // Input
        this.input.keyboard!.on("keydown-SPACE", () => this.attack());
        this.input.keyboard!.on("keydown-ONE", () => this.selectWeapon(0));
        this.input.keyboard!.on("keydown-TWO", () => this.selectWeapon(1));
        this.input.keyboard!.on("keydown-THREE", () => this.selectWeapon(2));

        // Spawner
        this.startSpawning();

        // MP Regen
        this.mpRegenEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.hp > 0 && this.mp < DEFAULT_GAME_CONFIG.initialMP) {
                    this.mp = Math.min(DEFAULT_GAME_CONFIG.initialMP, this.mp + DEFAULT_GAME_CONFIG.mpRegenRate);
                    GameEventBus.emit("mp-update", this.mp);
                }
            },
            callbackScope: this,
            loop: true,
        });

        // Listen to React EventBus
        this.setupEventBusListeners();

        // Initial emit
        GameEventBus.emit("hp-update", this.hp);
        GameEventBus.emit("mp-update", this.mp);
        GameEventBus.emit("score-update", 0);
        this.emitWeaponsUpdate();
    }

    private setupEventBusListeners() {
        // Clean up previous listeners to prevent memory leaks
        GameEventBus.removeAllListeners("weapon-request");
        GameEventBus.removeAllListeners("weapon-ready");

        GameEventBus.on("weapon-request", (cost: number) => {
            this.startCharging(cost);
        }, this);

        GameEventBus.on("weapon-ready", (weaponData: WeaponData) => {
            this.setWeapon(weaponData);
        }, this);
    }

    private emitWeaponsUpdate() {
        GameEventBus.emit("weapons-update", {
            weapons: [...this.weapons],
            activeIndex: this.activeWeaponIndex,
        });
    }

    private selectWeapon(index: number) {
        if (index < 0 || index >= this.weapons.length) return;
        this.activeWeaponIndex = index;
        this.updateWeaponSpriteVisuals();
        this.emitWeaponsUpdate();
    }

    private updateWeaponSpriteVisuals() {
        this.weaponSprites.forEach((sprite, i) => {
            const isActive = i === this.activeWeaponIndex;
            sprite.setScale(isActive ? 1.2 : 0.7);
            sprite.setAlpha(isActive ? 1.0 : 0.5);
        });
    }

    private startSpawning() {
        if (this.spawnEvent) this.spawnEvent.remove();
        this.spawnEvent = this.time.addEvent({
            delay: DEFAULT_GAME_CONFIG.spawnInterval,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true,
        });
    }

    private spawnObstacle() {
        const { width, height } = this.scale;
        const yPos = height - 56;

        // Choose randomly, simpler weight distribution for MVP
        const rand = Math.random();
        let config: ObstacleConfig;

        if (rand < 0.6) {
            config = { type: "cactus_small", hp: 10, damage: 20, speed: this.scrollSpeed, sprite: "cactus_small" };
        } else if (rand < 0.9) {
            config = { type: "cactus_large", hp: 30, damage: 30, speed: this.scrollSpeed, sprite: "cactus_large" };
        } else {
            config = { type: "pteranodon", hp: 20, damage: 25, speed: this.scrollSpeed * 1.5, sprite: "pteranodon" };
        }

        const obsY = config.type === "pteranodon" ? height - 120 : yPos;
        const obstacle = new Obstacle(this, width + 50, obsY, config);
        this.obstacles.add(obstacle);

        // Re-apply velocity after adding to the group just in case
        const body = obstacle.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setVelocityX(-config.speed);
        }
    }

    setWeapon(weaponData: WeaponData) {
        if (weaponData.image_url) {
            const key = "weapon_" + weaponData.weapon_name;
            if (!this.textures.exists(key)) {
                const img = new Image();
                img.onload = () => {
                    this.textures.addImage(key, img);
                    this.finalizeSetWeapon(weaponData);
                };
                img.src = weaponData.image_url;
                return;
            }
        }
        this.finalizeSetWeapon(weaponData);
    }

    private finalizeSetWeapon(weaponData: WeaponData) {
        this.isCharging = false;
        if (this.chargeEffect) {
            this.chargeEffect.stop();
            this.chargeEffect.destroy();
            this.chargeEffect = null;
        }

        // If inventory is full, remove the oldest weapon
        if (this.weapons.length >= MAX_WEAPONS) {
            this.weapons.shift();
            const oldSprite = this.weaponSprites.shift();
            if (oldSprite) oldSprite.destroy();
            // Adjust activeWeaponIndex
            if (this.activeWeaponIndex > 0) {
                this.activeWeaponIndex--;
            }
        }

        // Add new weapon
        this.weapons.push(weaponData);

        // Create sprite for the new weapon
        const sprite = this.createWeaponSprite(weaponData);
        this.weaponSprites.push(sprite);

        // Set active to the newly added weapon
        this.activeWeaponIndex = this.weapons.length - 1;
        this.updateWeaponSpriteVisuals();

        // Create "READY!" text
        const text = this.add.text(this.player.x, this.player.y - 40, "READY!", {
            fontSize: "16px",
            color: "#ffff00",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 20,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });

        this.emitWeaponsUpdate();
    }

    private createWeaponSprite(weaponData: WeaponData): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
        const textureKey = weaponData.image_url ? "weapon_" + weaponData.weapon_name : null;
        if (textureKey && this.textures.exists(textureKey)) {
            return this.add.image(
                this.player.x + 20,
                this.player.y - 15,
                textureKey
            ).setOrigin(0.5).setDisplaySize(32, 32);
        } else {
            return this.add.text(
                this.player.x + 20,
                this.player.y - 15,
                weaponData.sprite_emoji,
                { fontSize: "24px" }
            ).setOrigin(0.5);
        }
    }

    startCharging(cost: number) {
        if (this.isCharging) return;

        // Check MP for weapon/magic generation
        if (this.mp < cost) {
            GameEventBus.emit("mp-insufficient");
            return;
        }

        // Deduct MP at generation
        this.mp -= cost;
        GameEventBus.emit("mp-update", this.mp);

        this.isCharging = true;

        // Create particle effect
        if (!this.chargeEffect) {
            this.chargeEffect = this.add.particles(0, 0, "particle", {
                x: this.player.x,
                y: this.player.y,
                speed: { min: -100, max: 100 },
                angle: { min: 0, max: 360 },
                scale: { start: 1, end: 0 },
                lifespan: 600,
                frequency: 30,
                tint: 0xffff00,
                blendMode: "ADD"
            });
        } else {
            this.chargeEffect.start();
        }

        GameEventBus.emit("weapon-charging");
    }

    attack() {
        if (this.hp <= 0) return;

        const currentWeapon = this.weapons[this.activeWeaponIndex] ?? null;

        if (!currentWeapon) {
            // Barehand attack
            this.performAttack(DEFAULT_GAME_CONFIG.bareHandDamage, "short", "slash", 0xffffff, "⚡");
            return;
        }

        if (currentWeapon.type === "heal") {
            const healAmount = 50;
            this.hp = Math.min(DEFAULT_GAME_CONFIG.initialHP, this.hp + healAmount);
            GameEventBus.emit("hp-update", this.hp);

            // Visual feedback
            this.player.setTint(0x00ff00);
            this.time.delayedCall(300, () => {
                if (this.hp > 0) this.player.clearTint();
            });

            const healText = this.add.text(this.player.x, this.player.y - 50, `+${healAmount} HP`, {
                fontSize: "20px",
                color: "#00ff00",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 3
            }).setOrigin(0.5);

            this.tweens.add({
                targets: healText,
                y: healText.y - 50,
                alpha: 0,
                duration: 1000,
                onComplete: () => healText.destroy()
            });

            GameEventBus.emit("attack-executed", currentWeapon);
            this.removeWeaponAt(this.activeWeaponIndex);
            return;
        }

        // Use weapon/magic
        this.performAttack(
            currentWeapon.damage,
            currentWeapon.range,
            currentWeapon.attack_animation,
            parseInt(currentWeapon.color.replace("#", "0x")) || 0xff0000,
            currentWeapon.sprite_emoji,
            currentWeapon.image_url ? "weapon_" + currentWeapon.weapon_name : undefined
        );

        GameEventBus.emit("attack-executed", currentWeapon);

        if (currentWeapon.type === "magic") {
            this.removeWeaponAt(this.activeWeaponIndex);
        }
    }

    private removeWeaponAt(index: number) {
        this.weapons.splice(index, 1);
        const sprite = this.weaponSprites.splice(index, 1)[0];
        if (sprite) sprite.destroy();

        // Adjust active index
        if (this.weapons.length === 0) {
            this.activeWeaponIndex = 0;
        } else if (this.activeWeaponIndex >= this.weapons.length) {
            this.activeWeaponIndex = this.weapons.length - 1;
        }
        this.updateWeaponSpriteVisuals();
        this.emitWeaponsUpdate();
    }

    private performAttack(damage: number, range: string, animation: string, tint: number, emoji: string, textureKey?: string) {
        // Visual representation of attack
        let rangePx = 100;
        if (range === "medium") rangePx = 300;
        if (range === "long") rangePx = 800; // Whole screen

        const hitbox = this.add.rectangle(
            this.player.x + (rangePx / 2),
            this.player.y,
            rangePx,
            100,
            tint,
            0
        );
        hitbox.setVisible(false);
        this.physics.add.existing(hitbox);

        const body = hitbox.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        this.time.delayedCall(300, () => hitbox.destroy());

        // Add default emoji or generated image weapon visual
        let visual: Phaser.GameObjects.GameObject;
        if (textureKey && this.textures.exists(textureKey)) {
            visual = this.add.image(this.player.x + 50, this.player.y, textureKey).setOrigin(0.5);
            (visual as Phaser.GameObjects.Image).setDisplaySize(64, 64);
            (visual as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.MULTIPLY);
        } else {
            visual = this.add.text(this.player.x + 50, this.player.y, emoji, { fontSize: "32px" }).setOrigin(0.5);
        }

        if (animation === "projectile" || animation === "beam") {
            this.tweens.add({
                targets: visual,
                x: this.player.x + rangePx,
                duration: 500,
                onComplete: () => visual.destroy()
            });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const targetScale = (visual as any).scaleX ? (visual as any).scaleX * 1.5 : 1.5;
            this.tweens.add({
                targets: visual,
                angle: 180,
                scale: targetScale,
                alpha: 0,
                duration: 300,
                onComplete: () => visual.destroy()
            });
        }

        // Damage detection
        this.physics.overlap(hitbox, this.obstacles, (hit, obs) => {
            const obstacle = obs as Obstacle;
            const killed = obstacle.takeDamage(damage);
            if (killed) {
                const pts = obstacle.config.hp * 10;
                this.score += pts;
                this.createScoreText(obstacle.x, obstacle.y, pts);
                obstacle.destroy();
                GameEventBus.emit("obstacle-destroyed", obstacle.config);
                GameEventBus.emit("score-update", Math.floor(this.score));
            }
        });
    }

    private createScoreText(x: number, y: number, score: number) {
        const text = this.add.text(x, y, `+${score}`, {
            fontSize: "20px",
            color: "#00ff00",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    private onHit(player: Phaser.GameObjects.GameObject, obj: Phaser.GameObjects.GameObject) {
        if (this.hp <= 0) return;

        const obstacle = obj as Obstacle;
        this.hp -= obstacle.config.damage;

        // Invicibility frames & visual feedback
        this.player.setTint(0xff0000);
        this.cameras.main.shake(200, 0.01);

        this.time.delayedCall(200, () => {
            if (this.hp > 0) this.player.clearTint();
        });

        GameEventBus.emit("hp-update", Math.max(0, this.hp));

        obstacle.destroy();

        if (this.hp <= 0) {
            this.gameOver();
        }
    }

    private gameOver() {
        this.physics.pause();
        this.spawnEvent.remove();
        this.mpRegenEvent.remove();
        this.player.setTint(0x555555);

        this.time.delayedCall(1000, () => {
            this.scene.start("GameOverScene", { score: Math.floor(this.score) });
        });
    }

    update(time: number, delta: number) {
        if (this.hp <= 0) return;

        // Scroll ground and objects
        this.ground.tilePositionX += this.scrollSpeed * (delta / 1000);

        this.score += delta / 100;

        // Update score UI every ~100ms
        if (Math.floor(time) % 10 === 0) {
            GameEventBus.emit("score-update", Math.floor(this.score));
        }

        // Increase difficulty
        this.scrollSpeed = DEFAULT_GAME_CONFIG.baseScrollSpeed + Math.floor(this.score / 500) * DEFAULT_GAME_CONFIG.speedIncreaseRate;

        // Update spawner delay based on speed
        if (this.spawnEvent) {
            const newDelay = Math.max(500, DEFAULT_GAME_CONFIG.spawnInterval - Math.floor(this.score / 500) * 100);
            if (this.spawnEvent.delay !== newDelay) {
                this.spawnEvent.reset({
                    delay: newDelay,
                    callback: this.spawnObstacle,
                    callbackScope: this,
                    loop: true,
                });
            }
        }

        // Follow player with weapon sprites
        this.weaponSprites.forEach((sprite, i) => {
            sprite.setPosition(this.player.x + 20, this.player.y - 15 - (i * 22));
        });

        // Cleanup offscreen objects
        this.obstacles.getChildren().forEach(child => {
            const obs = child as Obstacle;
            if (obs.x < -100) {
                obs.destroy();
            }
        });
    }
}
