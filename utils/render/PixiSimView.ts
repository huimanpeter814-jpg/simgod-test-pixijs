import { Container, Graphics, Sprite, Assets, Text } from 'pixi.js';
import { Sim } from '../Sim';
import { AGE_CONFIG } from '../../constants';

// 简单的线性插值函数
const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

export class PixiSimView {
    container: Container;
    private shadow: Graphics;
    private body: Graphics;
    private head: Sprite | Graphics;
    
    private nameText: Text;
    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    constructor(sim: Sim) {
        this.container = new Container();
        
        // 初始化位置 (避免从 (0,0) 飞过来)
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // 1. 影子
        this.shadow = new Graphics();
        this.shadow.ellipse(0, 0, 6, 3).fill({ color: 0x000000, alpha: 0.2 });
        this.container.addChild(this.shadow);

        // 2. 身体
        this.body = new Graphics();
        this.container.addChild(this.body);

        // 3. 头部
        this.head = new Graphics(); 
        this.container.addChild(this.head);

        // 4. 名字
        this.nameText = new Text({
            text: sim.name,
            style: {
                fontFamily: 'Arial', 
                fontSize: 10,
                fill: 0xffffff,
                stroke: { color: 0x000000, width: 2 }, 
                align: 'center',
            }
        });
        this.nameText.anchor.set(0.5, 1);
        this.container.addChild(this.nameText);

        // 5. 气泡
        this.bubbleContainer = new Container();
        this.bubbleContainer.visible = false; 
        
        this.bubbleBg = new Graphics();
        this.bubbleContainer.addChild(this.bubbleBg);

        this.bubbleText = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 10,
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
        this.body.clear();
        if (this.head instanceof Graphics) this.head.clear();
        
        const config = AGE_CONFIG[sim.ageStage];
        const w = config.width;
        const h = config.height;
        const headSize = config.headSize;

        // 身体
        this.body.rect(-w / 2, -h * 0.45, w, h * 0.45);
        this.body.fill({ color: sim.pantsColor });
        const shoulderY = -h + (headSize * 0.6);
        const shirtHeight = (-h * 0.45) - shoulderY;
        this.body.rect(-w / 2, shoulderY, w, shirtHeight);
        this.body.fill({ color: sim.clothesColor });

        // 头部
        if (sim.appearance.face && Assets.cache.has(sim.appearance.face)) {
            if (this.head instanceof Graphics) {
                this.container.removeChild(this.head);
                this.head = new Sprite(Assets.get(sim.appearance.face));
                this.head.anchor.set(0.5);
                this.container.addChildAt(this.head, 2); 
            } else {
                (this.head as Sprite).texture = Assets.get(sim.appearance.face);
            }
            this.head.width = headSize * 2;
            this.head.height = headSize * 2;
        } else {
            if (this.head instanceof Sprite) {
                this.container.removeChild(this.head);
                this.head = new Graphics();
                this.container.addChildAt(this.head, 2);
            }
            const g = this.head as Graphics;
            g.rect(-headSize, -headSize, headSize * 2, headSize * 2);
            g.fill({ color: sim.skinColor });
            g.rect(-headSize/2, -2, 2, 2).fill(0x000000);
            g.rect(headSize/2 - 2, -2, 2, 2).fill(0x000000);
        }
        this.head.y = -h + (headSize * 0.5);
        
        this.nameText.y = -h - 5;
        this.bubbleContainer.y = -h - 25;
    }

    updatePosition(sim: Sim) {
        // [核心优化] 视觉插值 (Smoothing)
        // 不要直接 this.container.x = sim.pos.x
        // 而是每次只移动 20% 的距离，创造一种平滑跟随的效果
        // 这能极大缓解因为逻辑帧不稳导致的跳动
        this.container.x = lerp(this.container.x, sim.pos.x, 0.2);
        this.container.y = lerp(this.container.y, sim.pos.y, 0.2);
        
        // Z-Sorting 依然要精确
        this.container.zIndex = sim.pos.y;

        // 气泡逻辑
        if (sim.bubble.timer > 0 && sim.bubble.text) {
            this.bubbleContainer.visible = true;
            if (this.bubbleText.text !== sim.bubble.text) {
                this.bubbleText.text = sim.bubble.text;
                const width = this.bubbleText.width + 10;
                const height = this.bubbleText.height + 6;
                this.bubbleBg.clear();
                this.bubbleBg.roundRect(-width/2, -height/2, width, height, 5);
                this.bubbleBg.fill({ color: 0xffffff, alpha: 0.9 });
                this.bubbleBg.stroke({ width: 1, color: 0x000000 });
                this.bubbleBg.moveTo(0, height/2).lineTo(-3, height/2 + 4).lineTo(3, height/2 + 4).closePath().fill({ color: 0xffffff });
            }
        } else {
            this.bubbleContainer.visible = false;
        }
    }

    destroy() {
        this.container.destroy({ children: true });
    }
}