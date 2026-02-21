import * as Phaser from "phaser";
import { Player } from "../objects/Player";
import { Obstacle } from "../objects/Obstacle";
import { GameEventBus } from "../EventBus";
import { WeaponData, ObstacleConfig, DEFAULT_GAME_CONFIG } from "../../types/game";

const MAX_SLOTS = 3;
const CAMERA_WEAPONS_KEY = "savedCameraWeapons";
type ActiveMode = "weapon" | "magic";

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private obstacles!: Phaser.GameObjects.Group;
    private ground!: Phaser.GameObjects.TileSprite;

    private scrollSpeed: number = DEFAULT_GAME_CONFIG.baseScrollSpeed;
    private score: number = 0;
    private hp: number = DEFAULT_GAME_CONFIG.initialHP;
    private mp: number = DEFAULT_GAME_CONFIG.initialMP;

    // Weapon inventory (melee / ranged)
    private weapons: WeaponData[] = [];
    private weaponSprites: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
    private activeWeaponIndex: number = 0;

    // Magic inventory (magic / heal)
    private magics: WeaponData[] = [];
    private magicSprites: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
    private activeMagicIndex: number = 0;

    // Which inventory is currently active
    private activeMode: ActiveMode = "weapon";

    private isCharging: boolean = false;
    private chargeEffect: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private spawnEvent!: Phaser.Time.TimerEvent;
    private mpRegenEvent!: Phaser.Time.TimerEvent;
    private lastMeleeAttackAt: number = 0;
    private fallbackAudioContext: AudioContext | null = null;

    // Boss battle
    private bossEnabled: boolean = true;
    private bossSpawnTimeSec: number = 20;
    private bossSpawned: boolean = false;
    private bossActive: boolean = false;
    private currentBoss: Obstacle | null = null;
    private bossHpBar: Phaser.GameObjects.Rectangle | null = null;
    private bossHpBarBg: Phaser.GameObjects.Rectangle | null = null;
    private bossMaxHp: number = 150;
    private gameElapsedSec: number = 0;
    private bossDefeated: boolean = false;
    private bossBgOverlay: Phaser.GameObjects.Rectangle | null = null;
    private bossBorderTop: Phaser.GameObjects.Rectangle | null = null;
    private bossBorderBottom: Phaser.GameObjects.Rectangle | null = null;
    private stage: number = 1;
    private bossAttackEvent: Phaser.Time.TimerEvent | null = null;
    private bossBeamHitCount: number = 0;
    private bossStopped: boolean = false;

    constructor() {
        super("GameScene");
    }

    init(data?: { stage?: number }) {
        this.stage = data?.stage ?? 1;
    }

    create() {
        const { width, height } = this.scale;

        // Play BGM
        this.sound.stopAll();
        this.sound.play("bgm", { loop: true, volume: 0.5 });

        // Clean up previous sprites
        this.weaponSprites.forEach(s => s.destroy());
        this.magicSprites.forEach(s => s.destroy());
        this.weaponSprites = [];
        this.magicSprites = [];
        this.weapons = [];
        this.magics = [];
        this.activeWeaponIndex = 0;
        this.activeMagicIndex = 0;
        this.activeMode = "weapon";

        // Reset stats
        this.score = 0;
        this.hp = DEFAULT_GAME_CONFIG.initialHP;
        this.mp = DEFAULT_GAME_CONFIG.initialMP;
        this.scrollSpeed = DEFAULT_GAME_CONFIG.baseScrollSpeed;

        // Boss settings from localStorage
        try {
            const bossSettings = JSON.parse(localStorage.getItem("bossSettings") || "{}");
            this.bossEnabled = typeof bossSettings.enabled === "boolean" ? bossSettings.enabled : DEFAULT_GAME_CONFIG.bossEnabled;
            this.bossSpawnTimeSec = typeof bossSettings.timeSec === "number" && bossSettings.timeSec > 0 ? bossSettings.timeSec : DEFAULT_GAME_CONFIG.bossSpawnTimeSec;
        } catch {
            this.bossEnabled = DEFAULT_GAME_CONFIG.bossEnabled;
            this.bossSpawnTimeSec = DEFAULT_GAME_CONFIG.bossSpawnTimeSec;
        }
        this.bossSpawned = false;
        this.bossActive = false;
        this.currentBoss = null;
        this.bossHpBar = null;
        this.bossHpBarBg = null;
        this.gameElapsedSec = 0;
        this.bossDefeated = false;
        this.bossAttackEvent = null;
        this.bossBeamHitCount = 0;
        this.bossStopped = false;

        // Background sky
        this.add.rectangle(0, 0, width, height, 0x87ceeb).setOrigin(0, 0);

        // Ground
        this.ground = this.add.tileSprite(width / 2, height - 20, width, 40, "ground");
        this.physics.add.existing(this.ground, true);

        // Player
        this.player = new Player(this, 100, height - 80);
        this.physics.add.collider(this.player, this.ground);

        // Obstacles
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
        this.input.keyboard!.once("keydown", () => this.unlockAudioContext());
        this.input.once("pointerdown", () => this.unlockAudioContext());
        this.input.keyboard!.on("keydown-SPACE", (e: KeyboardEvent) => {
            e.preventDefault();
            this.attack();
        });
        this.input.keyboard!.on("keydown-ONE", () => this.selectWeaponSlot(0));
        this.input.keyboard!.on("keydown-TWO", () => this.selectWeaponSlot(1));
        this.input.keyboard!.on("keydown-THREE", () => this.selectWeaponSlot(2));
        this.input.keyboard!.on("keydown-FOUR", () => this.selectMagicSlot(0));
        this.input.keyboard!.on("keydown-FIVE", () => this.selectMagicSlot(1));
        this.input.keyboard!.on("keydown-SIX", () => this.selectMagicSlot(2));

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

        // Restore saved camera weapons
        this.loadSavedCameraWeapons();

        this.emitInventoryUpdate();
    }

    private loadSavedCameraWeapons() {
        try {
            const raw = localStorage.getItem(CAMERA_WEAPONS_KEY);
            if (!raw) return;
            const list: WeaponData[] = JSON.parse(raw);
            if (!Array.isArray(list)) return;
            for (const w of list) {
                if (w && w.weapon_name) {
                    this.setWeapon(w);
                }
            }
        } catch {
            // corrupted data — ignore
        }
    }

    private setupEventBusListeners() {
        GameEventBus.removeAllListeners("weapon-request");
        GameEventBus.removeAllListeners("weapon-ready");

        GameEventBus.on("weapon-request", (cost: number) => {
            this.startCharging(cost);
        }, this);

        GameEventBus.on("weapon-ready", (weaponData: WeaponData) => {
            this.setWeapon(weaponData);
        }, this);
    }

    private isMagicType(type: string): boolean {
        return type === "magic" || type === "heal";
    }

    private emitInventoryUpdate() {
        GameEventBus.emit("weapons-update", {
            weapons: [...this.weapons],
            magics: [...this.magics],
            activeWeaponIndex: this.activeWeaponIndex,
            activeMagicIndex: this.activeMagicIndex,
            activeMode: this.activeMode,
        });
    }

    private selectWeaponSlot(index: number) {
        if (index < 0 || index >= this.weapons.length) return;
        this.activeWeaponIndex = index;
        this.activeMode = "weapon";
        this.updateAllSpriteVisuals();
        this.emitInventoryUpdate();
    }

    private selectMagicSlot(index: number) {
        if (index < 0 || index >= this.magics.length) return;
        this.activeMagicIndex = index;
        this.activeMode = "magic";
        this.updateAllSpriteVisuals();
        this.emitInventoryUpdate();
    }

    private updateAllSpriteVisuals() {
        this.weaponSprites.forEach((sprite, i) => {
            const isActive = this.activeMode === "weapon" && i === this.activeWeaponIndex;
            sprite.setScale(isActive ? 1.2 : 0.7);
            sprite.setAlpha(isActive ? 1.0 : 0.4);
        });
        this.magicSprites.forEach((sprite, i) => {
            const isActive = this.activeMode === "magic" && i === this.activeMagicIndex;
            sprite.setScale(isActive ? 1.2 : 0.7);
            sprite.setAlpha(isActive ? 1.0 : 0.4);
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

        const rand = Math.random();
        let config: ObstacleConfig;

        if (rand < 0.4) {
            config = { type: "cactus_small", hp: DEFAULT_GAME_CONFIG.obstacles["cactus_small"].hp, damage: DEFAULT_GAME_CONFIG.obstacles["cactus_small"].damage, speed: this.scrollSpeed, sprite: "cactus_small" };
        } else if (rand < 0.6) {
            config = { type: "cactus_large", hp: DEFAULT_GAME_CONFIG.obstacles["cactus_large"].hp, damage: DEFAULT_GAME_CONFIG.obstacles["cactus_large"].damage, speed: this.scrollSpeed, sprite: "cactus_large" };
        } else if (rand < 0.75) {
            config = { type: "pteranodon", hp: DEFAULT_GAME_CONFIG.obstacles["pteranodon"].hp, damage: DEFAULT_GAME_CONFIG.obstacles["pteranodon"].damage, speed: this.scrollSpeed * 1.5, sprite: "pteranodon" };
        } else if (rand < 0.88) {
            config = { type: "dino_updown", hp: DEFAULT_GAME_CONFIG.obstacles["dino_updown"].hp, damage: DEFAULT_GAME_CONFIG.obstacles["dino_updown"].damage, speed: this.scrollSpeed * 1.2, sprite: "dino_updown" };
        } else {
            config = { type: "dino_leftright", hp: DEFAULT_GAME_CONFIG.obstacles["dino_leftright"].hp, damage: DEFAULT_GAME_CONFIG.obstacles["dino_leftright"].damage, speed: this.scrollSpeed, sprite: "dino_leftright" };
        }

        let obsY = yPos;
        if (config.type === "pteranodon") {
            obsY = height - 120;
        } else if (config.type === "dino_updown") {
            // Spawn higher so the wave doesn't dip into the ground
            obsY = height - 150;
        }

        const obstacle = new Obstacle(this, width + 50, obsY, config);
        this.obstacles.add(obstacle);

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

        const isMagic = this.isMagicType(weaponData.type);

        if (isMagic) {
            // Add to magic inventory
            if (this.magics.length >= MAX_SLOTS) {
                this.magics.shift();
                const oldSprite = this.magicSprites.shift();
                if (oldSprite) oldSprite.destroy();
                if (this.activeMagicIndex > 0) this.activeMagicIndex--;
            }
            this.magics.push(weaponData);
            this.magicSprites.push(this.createItemSprite(weaponData));
            this.activeMagicIndex = this.magics.length - 1;
            this.activeMode = "magic";
        } else {
            // Add to weapon inventory
            if (this.weapons.length >= MAX_SLOTS) {
                this.weapons.shift();
                const oldSprite = this.weaponSprites.shift();
                if (oldSprite) oldSprite.destroy();
                if (this.activeWeaponIndex > 0) this.activeWeaponIndex--;
            }
            this.weapons.push(weaponData);
            this.weaponSprites.push(this.createItemSprite(weaponData));
            this.activeWeaponIndex = this.weapons.length - 1;
            this.activeMode = "weapon";
        }

        this.updateAllSpriteVisuals();

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

        this.emitInventoryUpdate();
    }

    private createItemSprite(weaponData: WeaponData): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
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

        if (this.mp < cost) {
            GameEventBus.emit("mp-insufficient");
            return;
        }

        this.mp -= cost;
        GameEventBus.emit("mp-update", this.mp);
        this.isCharging = true;

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

        // Pick the active item based on current mode
        const currentItem = this.activeMode === "weapon"
            ? (this.weapons[this.activeWeaponIndex] ?? null)
            : (this.magics[this.activeMagicIndex] ?? null);

        // Melee cooldown
        const now = this.time.now;
        const isMeleeAttack = !currentItem || currentItem.type === "melee";
        if (isMeleeAttack && now - this.lastMeleeAttackAt < DEFAULT_GAME_CONFIG.meleeRecoveryMs) {
            return;
        }

        if (!currentItem) {
            // Barehand attack
            this.playAttackSfx("melee", "slash");
            this.performAttack(DEFAULT_GAME_CONFIG.bareHandDamage, "short", "slash", 0xffffff, "⚡");
            this.lastMeleeAttackAt = now;
            return;
        }

        if (currentItem.type === "heal") {
            this.playAttackSfx("heal", currentItem.attack_animation);
            const healAmount = 50;
            this.hp = Math.min(DEFAULT_GAME_CONFIG.initialHP, this.hp + healAmount);
            GameEventBus.emit("hp-update", this.hp);

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

            GameEventBus.emit("attack-executed", currentItem);
            this.removeItemAt(this.activeMagicIndex, "magic");
            return;
        }

        // Use weapon/magic attack
        this.playAttackSfx(currentItem.type, currentItem.attack_animation);
        this.performAttack(
            currentItem.damage,
            currentItem.range,
            currentItem.attack_animation,
            parseInt(currentItem.color.replace("#", "0x")) || 0xff0000,
            currentItem.sprite_emoji,
            currentItem.image_url ? "weapon_" + currentItem.weapon_name : undefined
        );
        if (currentItem.type === "melee") {
            this.lastMeleeAttackAt = now;
        }

        GameEventBus.emit("attack-executed", currentItem);

        // Magic is consumed after use
        if (currentItem.type === "magic") {
            this.removeItemAt(this.activeMagicIndex, "magic");
        }
    }

    private removeItemAt(index: number, mode: ActiveMode) {
        if (mode === "weapon") {
            this.weapons.splice(index, 1);
            const sprite = this.weaponSprites.splice(index, 1)[0];
            if (sprite) sprite.destroy();
            if (this.weapons.length === 0) {
                this.activeWeaponIndex = 0;
            } else if (this.activeWeaponIndex >= this.weapons.length) {
                this.activeWeaponIndex = this.weapons.length - 1;
            }
        } else {
            this.magics.splice(index, 1);
            const sprite = this.magicSprites.splice(index, 1)[0];
            if (sprite) sprite.destroy();
            if (this.magics.length === 0) {
                this.activeMagicIndex = 0;
            } else if (this.activeMagicIndex >= this.magics.length) {
                this.activeMagicIndex = this.magics.length - 1;
            }
        }
        this.updateAllSpriteVisuals();
        this.emitInventoryUpdate();
    }

    private performAttack(damage: number, range: string, animation: string, tint: number, emoji: string, textureKey?: string) {
        let rangePx = 100;
        if (range === "medium") rangePx = 300;
        if (range === "long") rangePx = 800;

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
                duration: 1000,
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
                duration: textureKey && textureKey.startsWith("weapon_") ? 1000 : 300,
                onComplete: () => visual.destroy()
            });
        }

        this.physics.overlap(hitbox, this.obstacles, (hit, obs) => {
            const obstacle = obs as Obstacle;
            if (!obstacle.active) return;

            const hpBeforeHit = obstacle.config.hp;
            const killed = obstacle.takeDamage(damage);
            if (killed) {
                const isBoss = obstacle.config.type === "boss";
                if (!isBoss) {
                    const pts = Math.max(0, hpBeforeHit) * 10;
                    this.score += pts;
                    this.createScoreText(obstacle.x, obstacle.y, pts);
                }
                obstacle.destroy();
                GameEventBus.emit("obstacle-destroyed", obstacle.config);
                if (isBoss) {
                    this.onBossDefeated();
                } else {
                    GameEventBus.emit("score-update", Math.floor(this.score));
                }
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

    private spawnBoss() {
        this.bossSpawned = true;
        const { width, height } = this.scale;

        // Pause normal spawning
        if (this.spawnEvent) this.spawnEvent.paused = true;

        // --- Phase 1: Screen flash + dark overlay ---
        const flash = this.add.rectangle(0, 0, width, height, 0xffffff, 1).setOrigin(0, 0).setDepth(200);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        // Dark cinematic overlay
        const darkOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0, 0).setDepth(150);

        // Cinematic bars (top & bottom)
        const barHeight = 30;
        const barTop = this.add.rectangle(0, -barHeight, width, barHeight, 0x000000).setOrigin(0, 0).setDepth(151);
        const barBottom = this.add.rectangle(0, height, width, barHeight, 0x000000).setOrigin(0, 0).setDepth(151);
        this.tweens.add({ targets: barTop, y: 0, duration: 400, ease: "Quad.easeOut" });
        this.tweens.add({ targets: barBottom, y: height - barHeight, duration: 400, ease: "Quad.easeOut" });

        // --- Phase 2: WARNING banner with flash ---
        this.time.delayedCall(400, () => {
            // Warning stripe background
            const stripeBg = this.add.rectangle(width / 2, height / 2, width, 60, 0xff0000, 0.9).setDepth(160);

            // Warning text
            const warningText = this.add.text(width / 2, height / 2, "⚠ WARNING  ─  BOSS INCOMING ─  WARNING ⚠", {
                fontSize: "22px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 3,
                letterSpacing: 2,
            }).setOrigin(0.5).setDepth(161);

            // Flash the warning stripe
            this.tweens.add({
                targets: [stripeBg, warningText],
                alpha: 0.3,
                yoyo: true,
                repeat: 3,
                duration: 200,
            });

            // Screen shake during warning
            this.cameras.main.shake(800, 0.008);

            // --- Phase 3: Cleanup warning, spawn boss ---
            this.time.delayedCall(2000, () => {
                // Fade out warning elements
                this.tweens.add({
                    targets: [darkOverlay, stripeBg, warningText],
                    alpha: 0,
                    duration: 400,
                    onComplete: () => {
                        darkOverlay.destroy();
                        stripeBg.destroy();
                        warningText.destroy();
                    }
                });

                // Slide out cinematic bars
                this.tweens.add({ targets: barTop, y: -barHeight, duration: 400, ease: "Quad.easeIn", onComplete: () => barTop.destroy() });
                this.tweens.add({ targets: barBottom, y: height, duration: 400, ease: "Quad.easeIn", onComplete: () => barBottom.destroy() });

                // Red-tinted background overlay for boss fight
                this.bossBgOverlay = this.add.rectangle(0, 0, width, height, 0xff0000, 0.08).setOrigin(0, 0).setDepth(0);

                // Red border bars (persistent during boss fight)
                this.bossBorderTop = this.add.rectangle(0, 0, width, 3, 0xff0000).setOrigin(0, 0).setDepth(95);
                this.bossBorderBottom = this.add.rectangle(0, height - 3, width, 3, 0xff0000).setOrigin(0, 0).setDepth(95);
                // Pulsing border
                this.tweens.add({ targets: [this.bossBorderTop, this.bossBorderBottom], alpha: 0.3, yoyo: true, repeat: -1, duration: 800 });

                // Spawn the boss
                const yPos = height - 80;
                const bossConfig: ObstacleConfig = {
                    type: "boss",
                    hp: 300,
                    damage: 50,
                    speed: this.scrollSpeed * 0.4,
                    sprite: "boss"
                };
                this.bossMaxHp = bossConfig.hp;

                const boss = new Obstacle(this, width + 80, yPos, bossConfig);
                boss.setScale(1.8);
                this.obstacles.add(boss);

                const body = boss.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.setVelocityX(-bossConfig.speed);
                    body.setSize(boss.width * 0.7, boss.height * 0.8);
                }

                this.currentBoss = boss;
                this.bossActive = true;

                // Boss entrance shake
                this.cameras.main.shake(300, 0.012);

                // HP bar
                this.bossHpBarBg = this.add.rectangle(boss.x, boss.y - 70, 120, 10, 0x333333).setOrigin(0.5).setDepth(90);
                this.bossHpBar = this.add.rectangle(boss.x, boss.y - 70, 120, 10, 0xff0000).setOrigin(0.5).setDepth(91);
            });
        });
    }

    private updateBossHpBar() {
        if (!this.currentBoss || !this.bossHpBar || !this.bossHpBarBg) return;

        const boss = this.currentBoss;
        const hpRatio = Math.max(0, boss.config.hp / this.bossMaxHp);

        this.bossHpBarBg.setPosition(boss.x, boss.y - 70);
        this.bossHpBar.setPosition(boss.x, boss.y - 70);
        this.bossHpBar.width = 120 * hpRatio;

        // Stop boss near center-right of screen
        const body = boss.body as Phaser.Physics.Arcade.Body;
        if (body && boss.x <= this.scale.width * 0.65) {
            body.setVelocityX(0);
            // Start boss attacks once stopped
            if (!this.bossStopped) {
                this.bossStopped = true;
                this.startBossAttacks();
            }
        }
    }

    private startBossAttacks() {
        // Boss fires a beam every 3-5 seconds
        this.bossAttackEvent = this.time.addEvent({
            delay: 3500,
            callback: () => this.bossFireBeam(),
            callbackScope: this,
            loop: true,
        });
    }

    private bossFireBeam() {
        if (!this.currentBoss || !this.currentBoss.active || this.hp <= 0) return;

        const boss = this.currentBoss;

        // Charging indicator on boss
        const chargeCircle = this.add.circle(boss.x - 30, boss.y, 12, 0xff0000, 0.6).setDepth(92);
        this.tweens.add({
            targets: chargeCircle,
            scale: 2.5,
            alpha: 1,
            duration: 600,
            onComplete: () => {
                chargeCircle.destroy();
                if (!this.currentBoss || !this.currentBoss.active || this.hp <= 0) return;
                this.fireBossBeamProjectile();
            }
        });
    }

    private fireBossBeamProjectile() {
        if (!this.currentBoss || this.hp <= 0) return;
        const boss = this.currentBoss;

        // Beam sound effect
        const audioContext = this.resolveAudioContext();
        if (audioContext && audioContext.state === "running") {
            const now = audioContext.currentTime;
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        }

        // Create beam visual — a red rectangle that travels from boss to player
        const beamWidth = boss.x - this.player.x;
        const beam = this.add.rectangle(
            boss.x - 20, boss.y, 20, 8, 0xff2200
        ).setOrigin(1, 0.5).setDepth(80);

        // Beam glow
        const glow = this.add.rectangle(
            boss.x - 20, boss.y, 20, 16, 0xff0000, 0.3
        ).setOrigin(1, 0.5).setDepth(79);

        this.tweens.add({
            targets: [beam, glow],
            displayWidth: beamWidth + 40,
            duration: 400,
            ease: "Quad.easeIn",
            onComplete: () => {
                // Check if beam reaches the player
                if (this.hp > 0) {
                    this.bossBeamHitCount++;

                    if (this.bossBeamHitCount === 1) {
                        // First hit: HP → 1
                        this.hp = 1;
                    } else {
                        // Second+ hit: HP → 0
                        this.hp = 0;
                    }

                    GameEventBus.emit("hp-update", Math.max(0, this.hp));
                    this.playDamageSfx(50);
                    this.playDamageEffects(50);

                    // Screen flash red
                    const { width, height } = this.scale;
                    const hitFlash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.4).setOrigin(0, 0).setDepth(200);
                    this.tweens.add({
                        targets: hitFlash,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => hitFlash.destroy()
                    });

                    if (this.hp <= 0) {
                        this.gameOver();
                    }
                }

                // Fade out beam
                this.tweens.add({
                    targets: [beam, glow],
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        beam.destroy();
                        glow.destroy();
                    }
                });
            }
        });
    }

    private onBossDefeated() {
        if (this.bossDefeated) return;
        this.bossDefeated = true;

        const { width, height } = this.scale;

        // Bonus score
        const bonus = 3000;
        this.score += bonus;

        // Stop gameplay
        this.physics.pause();
        this.spawnEvent.remove();
        this.mpRegenEvent.remove();

        // Victory flash
        const flash = this.add.rectangle(0, 0, width, height, 0xffd700, 0.9).setOrigin(0, 0).setDepth(200);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 800,
        });

        this.cameras.main.shake(400, 0.015);

        // Clean up HP bar
        if (this.bossHpBar) { this.bossHpBar.destroy(); this.bossHpBar = null; }
        if (this.bossHpBarBg) { this.bossHpBarBg.destroy(); this.bossHpBarBg = null; }
        if (this.bossAttackEvent) { this.bossAttackEvent.remove(); this.bossAttackEvent = null; }

        // Clean up boss fight overlays
        this.cleanupBossOverlaysImmediate();

        this.bossActive = false;
        this.currentBoss = null;

        // Transition to Victory scene after short delay
        this.time.delayedCall(1200, () => {
            this.scene.start("VictoryScene", {
                score: Math.floor(this.score),
                stage: this.stage,
            });
        });
    }

    private cleanupBossOverlaysImmediate() {
        if (this.bossBgOverlay) { this.bossBgOverlay.destroy(); this.bossBgOverlay = null; }
        if (this.bossBorderTop) { this.tweens.killTweensOf(this.bossBorderTop); this.bossBorderTop.destroy(); this.bossBorderTop = null; }
        if (this.bossBorderBottom) { this.tweens.killTweensOf(this.bossBorderBottom); this.bossBorderBottom.destroy(); this.bossBorderBottom = null; }
    }

    private onHit(player: Phaser.GameObjects.GameObject, obj: Phaser.GameObjects.GameObject) {
        if (this.hp <= 0) return;

        const obstacle = obj as Obstacle;
        this.hp -= obstacle.config.damage;

        this.playDamageSfx(obstacle.config.damage);
        this.playDamageEffects(obstacle.config.damage);

        GameEventBus.emit("hp-update", Math.max(0, this.hp));

        // Boss doesn't get destroyed on contact — only normal obstacles do
        if (obstacle.config.type !== "boss") {
            obstacle.destroy();
        }

        if (this.hp <= 0) {
            this.gameOver();
        }
    }

    private playDamageSfx(damage: number) {
        const audioContext = this.resolveAudioContext();
        if (!audioContext) return;
        if (audioContext.state === "suspended") {
            void audioContext.resume();
            return;
        }

        const intensity = Phaser.Math.Clamp(damage / 40, 0.2, 1);
        const now = audioContext.currentTime;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(200 + intensity * 120, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12 + intensity * 0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.11);
    }

    private playAttackSfx(type: WeaponData["type"], animation: WeaponData["attack_animation"]) {
        const audioContext = this.resolveAudioContext();
        if (!audioContext) return;
        if (audioContext.state === "suspended") {
            void audioContext.resume();
            return;
        }

        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        let startFreq = 220;
        let endFreq = 110;
        let peakGain = 0.1;
        let duration = 0.1;
        let wave: OscillatorType = "square";

        if (type === "melee") {
            startFreq = animation === "thrust" ? 280 : 210;
            endFreq = 90;
            peakGain = 0.11;
            duration = 0.085;
            wave = "square";
        } else if (type === "ranged") {
            startFreq = animation === "beam" ? 560 : 440;
            endFreq = animation === "beam" ? 300 : 230;
            peakGain = 0.09;
            duration = 0.13;
            wave = "triangle";
        } else if (type === "magic") {
            startFreq = 720;
            endFreq = 280;
            peakGain = 0.095;
            duration = 0.16;
            wave = "sine";
        } else if (type === "heal") {
            startFreq = 420;
            endFreq = 620;
            peakGain = 0.085;
            duration = 0.15;
            wave = "sine";
        }

        osc.type = wave;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);

        if (type === "magic" || type === "heal") {
            const sparkle = audioContext.createOscillator();
            const sparkleGain = audioContext.createGain();
            sparkle.type = "triangle";
            sparkle.frequency.setValueAtTime(type === "magic" ? 920 : 760, now);
            sparkle.frequency.exponentialRampToValueAtTime(430, now + 0.07);
            sparkleGain.gain.setValueAtTime(0.0001, now);
            sparkleGain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
            sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
            sparkle.connect(sparkleGain);
            sparkleGain.connect(audioContext.destination);
            sparkle.start(now);
            sparkle.stop(now + 0.08);
        }
    }

    private resolveAudioContext(): AudioContext | null {
        if ("context" in this.sound && this.sound.context) {
            return this.sound.context;
        }
        if (this.fallbackAudioContext) {
            return this.fallbackAudioContext;
        }
        const AudioContextCtor =
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return null;
        this.fallbackAudioContext = new AudioContextCtor();
        return this.fallbackAudioContext;
    }

    private unlockAudioContext() {
        const audioContext = this.resolveAudioContext();
        if (!audioContext) return;
        if (audioContext.state === "suspended") {
            void audioContext.resume();
        }
    }

    private playDamageEffects(damage: number) {
        const intensity = Phaser.Math.Clamp(damage / 40, 0.25, 1);
        const baseX = this.player.x;

        this.cameras.main.shake(100 + intensity * 140, 0.004 + intensity * 0.006);

        this.tweens.killTweensOf(this.player);
        this.player.setX(baseX);
        this.tweens.add({
            targets: this.player,
            x: baseX - (6 + 10 * intensity),
            duration: 70,
            yoyo: true,
            ease: "Quad.easeOut",
            onComplete: () => {
                this.player.setX(baseX);
            },
        });

        const damageText = this.add.text(this.player.x + 8, this.player.y - 40, `-${damage}`, {
            fontSize: "24px",
            color: "#ff7f7f",
            fontStyle: "bold",
            stroke: "#3a0606",
            strokeThickness: 4,
        }).setOrigin(0.5);
        this.tweens.add({
            targets: damageText,
            y: damageText.y - 36,
            alpha: 0,
            duration: 420,
            ease: "Cubic.easeOut",
            onComplete: () => damageText.destroy(),
        });

        // Keep hit feedback readable without square-looking particle artifacts on custom sprites.
    }

    private gameOver() {
        this.physics.pause();
        this.spawnEvent.remove();
        this.mpRegenEvent.remove();

        // Remove inventory sprites so no icon/background artifact remains above the player on death.
        this.weaponSprites.forEach((sprite) => sprite.destroy());
        this.magicSprites.forEach((sprite) => sprite.destroy());
        this.weaponSprites = [];
        this.magicSprites = [];

        this.player.clearTint();
        this.tweens.killTweensOf(this.player);
        this.tweens.add({
            targets: this.player,
            alpha: 0.6,
            duration: 250,
            ease: "Quad.easeOut",
        });

        // Clean up boss state
        if (this.bossHpBar) { this.bossHpBar.destroy(); this.bossHpBar = null; }
        if (this.bossHpBarBg) { this.bossHpBarBg.destroy(); this.bossHpBarBg = null; }
        if (this.bossAttackEvent) { this.bossAttackEvent.remove(); this.bossAttackEvent = null; }
        if (this.bossBgOverlay) { this.bossBgOverlay.destroy(); this.bossBgOverlay = null; }
        if (this.bossBorderTop) { this.bossBorderTop.destroy(); this.bossBorderTop = null; }
        if (this.bossBorderBottom) { this.bossBorderBottom.destroy(); this.bossBorderBottom = null; }
        this.bossActive = false;
        this.currentBoss = null;

        this.time.delayedCall(1000, () => {
            this.scene.start("GameOverScene", { score: Math.floor(this.score), cleared: false });
        });
    }

    update(time: number, delta: number) {
        if (this.hp <= 0) return;

        this.ground.tilePositionX += this.scrollSpeed * (delta / 1000);
        this.score += delta / 100;

        // Boss spawn timer
        this.gameElapsedSec += delta / 1000;
        if (this.bossEnabled && !this.bossSpawned && this.gameElapsedSec >= this.bossSpawnTimeSec) {
            this.spawnBoss();
        }

        // Update boss HP bar position
        if (this.currentBoss && this.currentBoss.active) {
            this.updateBossHpBar();
        }

        if (Math.floor(time) % 10 === 0) {
            GameEventBus.emit("score-update", Math.floor(this.score));
        }

        this.scrollSpeed = DEFAULT_GAME_CONFIG.baseScrollSpeed + Math.floor(this.score / 500) * DEFAULT_GAME_CONFIG.speedIncreaseRate;

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

        // Position weapon sprites (left side above player)
        this.weaponSprites.forEach((sprite, i) => {
            sprite.setPosition(this.player.x + 20, this.player.y - 15 - (i * 22));
        });
        // Position magic sprites (right side above player)
        this.magicSprites.forEach((sprite, i) => {
            sprite.setPosition(this.player.x - 20, this.player.y - 15 - (i * 22));
        });

        // Cleanup offscreen objects and process dynamic movement
        this.obstacles.getChildren().forEach(child => {
            const obs = child as Obstacle;
            if (obs.x < -100) {
                obs.destroy();
            } else {
                // Moving scary dinosaurs logic
                if (obs.config.type === "dino_updown") {
                    const body = obs.body as Phaser.Physics.Arcade.Body;
                    // Limit the downward sine wave so it doesn't clip into the ground
                    const wave = Math.sin(time / 200) * 150;
                    body.setVelocityY(wave);

                    // Force minimum Y to ground level minus their height
                    if (obs.y > this.scale.height - 40) {
                        obs.y = this.scale.height - 40;
                        body.setVelocityY(0);
                    }
                } else if (obs.config.type === "dino_leftright") {
                    const body = obs.body as Phaser.Physics.Arcade.Body;
                    // base speed + sine wave
                    body.setVelocityX(-obs.config.speed + Math.sin(time / 150) * 150);
                }
            }
        });
    }
}
