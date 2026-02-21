// Simple EventEmitter to avoid importing Phaser on the server-side
type Listener = (...args: any[]) => void;

class CustomEventEmitter {
    private events: Record<string, Listener[]> = {};

    on(event: string, listener: Listener, context?: any) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(context ? listener.bind(context) : listener);
    }

    off(event: string, listener: Listener) {
        if (!this.events[event]) return;
        // Basic implementation: removing exact reference might be tricky with bind,
        // but works for our simple use case if we don't bind, or we just clear them
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    emit(event: string, ...args: any[]) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }

    removeAllListeners(event?: string) {
        if (event) {
            this.events[event] = [];
        } else {
            this.events = {};
        }
    }
}

export const GameEventBus = new CustomEventEmitter();

// イベント一覧:
// "weapon-request"   : React → Phaser : 武器リクエスト開始
// "weapon-charging"  : Phaser → React : チャージ中状態
// "weapon-ready"     : Phaser → React : 武器生成完了
// "attack-executed"  : Phaser → React : 攻撃実行
// "hp-update"        : Phaser → React : HP更新
// "mp-update"        : Phaser → React : MP更新
// "mp-insufficient"  : Phaser → React : MP不足通知
// "score-update"     : Phaser → React : スコア更新
// "game-over"        : Phaser → React : ゲームオーバー
// "obstacle-destroyed": Phaser → React : 障害物破壊
