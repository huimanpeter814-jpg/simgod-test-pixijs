import { Container, Graphics, Sprite, Assets, Text, Texture } from 'pixi.js';
import { Sim } from '../Sim';
import { OutlineFilter } from 'pixi-filters';

// 简单的线性插值函数
const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

export class PixiSimView {
    container: Container;
    
    // 🆕 角色整体容器（用于应用统一的轮廓描边和缩放）
    private characterContainer: Container; 

    // 🆕 三层 Sprite 结构
    private bodySprite: Sprite;
    private outfitSprite: Sprite;
    private hairSprite: Sprite;

    private shadow: Graphics;
    private selectionRing: Graphics;
    
    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    // 缓存当前的资源路径，避免每帧重复赋值纹理
    private currentAssets = {
        body: '',
        outfit: '',
        hair: ''
    };

    constructor(sim: Sim) {
        this.container = new Container();
        
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // 0. 选中光环 (最底层)
        this.selectionRing = new Graphics();
        this.selectionRing.ellipse(0, 0, 20, 10).fill({ color: 0x39ff14, alpha: 0.5 });
        this.selectionRing.position.set(0, 20); // 放在脚底
        this.selectionRing.visible = false;
        this.container.addChild(this.selectionRing);

        // 1. 影子
        this.shadow = new Graphics();
        this.shadow.ellipse(0, 0, 14, 6).fill({ color: 0x000000, alpha: 0.2 });
        this.shadow.position.set(0, 20); // 放在脚底
        this.container.addChild(this.shadow);

        // === 🆕 角色主体容器 ===
        this.characterContainer = new Container();
        // 你的素材是 48x48，可能稍微有点小，这里可以整体放大一点
        // 也可以不放大，看实际效果
        // this.characterContainer.scale.set(1.5); 
        this.container.addChild(this.characterContainer);


        // === 🆕 初始化三层 Sprite ===
        // 层级顺序：Body (底) -> Outfit (中) -> Hair (顶)
        
        this.bodySprite = new Sprite();
        this.bodySprite.anchor.set(0.5); // 中心对齐
        this.characterContainer.addChild(this.bodySprite);

        this.outfitSprite = new Sprite();
        this.outfitSprite.anchor.set(0.5);
        this.characterContainer.addChild(this.outfitSprite);

        this.hairSprite = new Sprite();
        this.hairSprite.anchor.set(0.5);
        this.characterContainer.addChild(this.hairSprite);

        // 5. 气泡 (在最上层)
        this.bubbleContainer = new Container();
        this.bubbleContainer.visible = false; 
        this.bubbleContainer.y = -50; // 调整气泡高度，使其位于头顶上方
        
        this.bubbleBg = new Graphics();
        this.bubbleContainer.addChild(this.bubbleBg);

        this.bubbleText = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0x000000,
                align: 'center',
                wordWrap: true,
                wordWrapWidth: 120
            }
        });
        this.bubbleText.anchor.set(0.5);
        this.bubbleContainer.addChild(this.bubbleText);
        this.container.addChild(this.bubbleContainer);

        this.redraw(sim);
    }

    redraw(sim: Sim) {
        // 更新三层纹理
        this.updateLayerTexture(this.bodySprite, sim.appearance.body, 'body');
        this.updateLayerTexture(this.outfitSprite, sim.appearance.outfit, 'outfit');
        this.updateLayerTexture(this.hairSprite, sim.appearance.hair, 'hair');
    }

    private updateLayerTexture(sprite: Sprite, path: string, type: 'body' | 'outfit' | 'hair') {
        if (this.currentAssets[type] === path) return; // 路径没变，跳过

        if (path && Assets.cache.has(path)) {
            sprite.texture = Assets.get(path);
            //sprite.texture.source.scaleMode = 'nearest'; // 保持像素清晰
            this.currentAssets[type] = path;
        } else {
            // 如果资源不存在或为空，设为空纹理
            sprite.texture = Texture.EMPTY;
            this.currentAssets[type] = '';
        }
    }

    updatePosition(sim: Sim) {
        // [修复] 使用 Math.round 确保像素对齐，防止模糊
        this.container.x = Math.round(sim.pos.x);
        this.container.y = Math.round(sim.pos.y);
        
        // ZIndex 排序
        this.container.zIndex = sim.pos.y;

        // 简单的翻转逻辑：根据移动方向或目标方向翻转 Sprite
        // 假设素材默认是朝右或朝下的，如果朝左走，scale.x = -1
        // 这里假设素材是正面的，或者根据 x 轴移动翻转
        // if (sim.pos.x < sim.prevPos.x - 0.1) {
        //     this.characterContainer.scale.x = -1; // 向左走，翻转
        // } else if (sim.pos.x > sim.prevPos.x + 0.1) {
        //     this.characterContainer.scale.x = 1;  // 向右走，正常
        // }

        // 气泡更新
        if (sim.bubble && sim.bubble.timer > 0 && sim.bubble.text) {
            this.bubbleContainer.visible = true;
            // 翻转回来，防止文字反向
            this.bubbleContainer.scale.x = this.characterContainer.scale.x === -1 ? -1 : 1; 

            if (this.bubbleText.text !== sim.bubble.text) {
                this.bubbleText.text = sim.bubble.text;
                
                let bgColor = 0xffffff;
                let strokeColor = 0x000000;
                if (sim.bubble.type === 'love') { bgColor = 0xfd79a8; strokeColor = 0xe84393; }
                else if (sim.bubble.type === 'bad') { bgColor = 0xff7675; strokeColor = 0xd63031; }
                else if (sim.bubble.type === 'money') { bgColor = 0xffeaa7; strokeColor = 0xfdcb6e; }

                const width = this.bubbleText.width + 10;
                const height = this.bubbleText.height + 6;
                
                this.bubbleBg.clear();
                this.bubbleBg.roundRect(-width/2, -height/2, width, height, 5);
                this.bubbleBg.fill({ color: bgColor, alpha: 0.9 });
                this.bubbleBg.stroke({ width: 1, color: strokeColor });
                this.bubbleBg.moveTo(0, height/2).lineTo(-3, height/2 + 4).lineTo(3, height/2 + 4).closePath().fill({ color: bgColor });
            }
        } else {
            this.bubbleContainer.visible = false;
        }
    }

    showSelectionRing(show: boolean) {
        this.selectionRing.visible = show;
    }

    destroy() {
        this.container.destroy({ children: true });
    }
}