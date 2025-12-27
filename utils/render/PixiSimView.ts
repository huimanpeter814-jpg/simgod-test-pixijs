import { Container, Graphics, Sprite, Assets, Text, Texture } from 'pixi.js';
import { Sim } from '../Sim';

const failedAssets = new Set<string>(); // [新增] 全局记录失效资源

export class PixiSimView {
    container: Container;
    private characterContainer: Container; 
    private bodySprite: Sprite;
    private outfitSprite: Sprite;
    private hairSprite: Sprite;
    private shadow: Graphics;
    private selectionRing: Graphics;
    
    private selectionArrow: Graphics; 

    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    private currentAssets = { body: '', outfit: '', hair: '' };

    constructor(sim: Sim) {
        this.container = new Container();
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // === 🔧 调整参数区域 ===
        const CHARACTER_SCALE = 0.85; // 缩小比例 (原 1.0)
        const VERTICAL_OFFSET = -28;  // 向上偏移量 (让脚底对齐坐标点)
        // ========================

        // 0. 选中光环 (放在逻辑坐标原点，即脚底)
        this.selectionRing = new Graphics();
        this.selectionRing.ellipse(0, 0, 18, 9).fill({ color: 0x39ff14, alpha: 0.5 });
        this.selectionRing.position.set(0, 0); 
        this.selectionRing.visible = false;
        this.container.addChild(this.selectionRing);

        // 1. 影子 (同上，放在脚底)
        this.shadow = new Graphics();
        this.shadow.ellipse(0, 0, 12, 5).fill({ color: 0x000000, alpha: 0.2 });
        this.shadow.position.set(0, 0); 
        this.container.addChild(this.shadow);

        // 2. 角色主体
        this.characterContainer = new Container();
        
        // ✨ 应用缩放和偏移
        this.characterContainer.scale.set(CHARACTER_SCALE);
        this.characterContainer.position.set(0, VERTICAL_OFFSET);
        
        this.container.addChild(this.characterContainer);

        // 初始化 Sprite (中心对齐)
        this.bodySprite = new Sprite(); this.bodySprite.anchor.set(0.5); this.characterContainer.addChild(this.bodySprite);
        this.outfitSprite = new Sprite(); this.outfitSprite.anchor.set(0.5); this.characterContainer.addChild(this.outfitSprite);
        this.hairSprite = new Sprite(); this.hairSprite.anchor.set(0.5); this.characterContainer.addChild(this.hairSprite);

        // 3. 头顶选中标记 (黄色倒三角)
        this.selectionArrow = new Graphics();
        this.selectionArrow.fillStyle = 0x39ff14;
        this.selectionArrow.moveTo(0, 0);
        this.selectionArrow.lineTo(-6, -10); // 稍微调小一点箭头
        this.selectionArrow.lineTo(6, -10);
        this.selectionArrow.lineTo(0, 0);
        this.selectionArrow.fill();
        // 高度适配：因为人缩小上移了，箭头也要调整
        this.selectionArrow.position.set(0, -65); 
        this.selectionArrow.visible = false;
        this.container.addChild(this.selectionArrow);

        // 4. 气泡
        this.bubbleContainer = new Container();
        this.bubbleContainer.visible = false; 
        this.bubbleContainer.y = -80; // 调整气泡高度
        this.bubbleBg = new Graphics();
        this.bubbleContainer.addChild(this.bubbleBg);
        this.bubbleText = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 16, fill: 0x000000, align: 'center', wordWrap: true, wordWrapWidth: 120 } });
        this.bubbleText.anchor.set(0.5);
        this.bubbleContainer.addChild(this.bubbleText);
        this.container.addChild(this.bubbleContainer);

        this.redraw(sim);
    }

    redraw(sim: Sim) {
        this.updateLayerTexture(this.bodySprite, sim.appearance.body, 'body');
        this.updateLayerTexture(this.outfitSprite, sim.appearance.outfit, 'outfit');
        this.updateLayerTexture(this.hairSprite, sim.appearance.hair, 'hair');
        // ✨ 核心修改：应用头发颜色
        if (sim.hairColor) {
            this.hairSprite.tint = sim.hairColor;
        } else {
            this.hairSprite.tint = 0xFFFFFF;
        }
    }

    private updateLayerTexture(sprite: Sprite, path: string, type: 'body' | 'outfit' | 'hair') {
        if (this.currentAssets[type] === path && sprite.texture !== Texture.EMPTY) return;

        // [新增] 如果已知该资源损坏，直接跳过，防止死循环请求
        if (failedAssets.has(path)) {
            sprite.texture = Texture.EMPTY;
            return;
       }
        
        if (path && Assets.cache.has(path)) {
            sprite.texture = Assets.get(path);
            this.currentAssets[type] = path;
        } else if (path) {
            // 如果路径存在但不在缓存，可能是异步加载延迟，尝试重新从 Assets 加载
            Assets.load(path).then(tex => {
                sprite.texture = tex;
                this.currentAssets[type] = path;
            }).catch(() => {
                sprite.texture = Texture.EMPTY;
            });
        } else {
            sprite.texture = Texture.EMPTY;
            this.currentAssets[type] = '';
        }
    }
x
    updatePosition(sim: Sim) {
        this.container.x = Math.round(sim.pos.x);
        this.container.y = Math.round(sim.pos.y);
        // [修改后]：如果有被抱起的状态，强制提升层级 (zIndex + 1000)，保证在所有物体最上层
        this.container.zIndex = this.container.y + 10; // +10 是为了让它在同一直线时稍微遮挡物体一点点

        // 特殊状态处理
        if (sim.carriedBySimId) {
            this.container.zIndex = 999999; // 被抱着时，层级极高
        }

        // 标记浮动动画
        if (this.selectionArrow.visible) {
            const floatOffset = Math.sin(Date.now() / 150) * 4;
            this.selectionArrow.y = -65 + floatOffset;
        }

        if (sim.bubble && sim.bubble.timer > 0 && sim.bubble.text) {
            this.bubbleContainer.visible = true;
            this.selectionArrow.visible = false; 
            
            // 翻转处理：如果人朝左，气泡要翻转回来，防止文字镜像
            // 注意：因为我们现在只翻转 characterContainer，而 bubbleContainer 是同级，所以不用特殊处理
            // 除非你以后要翻转整个 container
            
            if (this.bubbleText.text !== sim.bubble.text) {
                this.bubbleText.text = sim.bubble.text;
                let bgColor = 0xffffff; let strokeColor = 0x000000;
                if (sim.bubble.type === 'love') { bgColor = 0xfd79a8; strokeColor = 0xe84393; }
                else if (sim.bubble.type === 'bad') { bgColor = 0xff7675; strokeColor = 0xd63031; }
                else if (sim.bubble.type === 'money') { bgColor = 0xffeaa7; strokeColor = 0xfdcb6e; }
                
                const width = this.bubbleText.width + 20; 
                const height = this.bubbleText.height + 16;
                
                this.bubbleBg.clear();
                this.bubbleBg.roundRect(-width/2, -height/2, width, height, 6);
                this.bubbleBg.fill({ color: bgColor, alpha: 0.95 });
                this.bubbleBg.stroke({ width: 1.5, color: strokeColor });
                this.bubbleBg.moveTo(0, height/2).lineTo(-4, height/2 + 5).lineTo(4, height/2 + 5).closePath().fill({ color: bgColor });
            }
        } else {
            this.bubbleContainer.visible = false;
            if (this.selectionRing.visible) this.selectionArrow.visible = true;
        }
    }

    showSelectionRing(show: boolean) {
        this.selectionRing.visible = show;
        if (!this.bubbleContainer.visible) {
            this.selectionArrow.visible = show;
        }
    }

    destroy() {
        this.container.destroy({ children: true });
    }
}