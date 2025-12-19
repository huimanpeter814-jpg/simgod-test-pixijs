import { Container, Graphics, Sprite, Assets, Text, Texture } from 'pixi.js';
import { Sim } from '../Sim';
import { AGE_CONFIG } from '../../constants';
import { drawAvatarHead } from './pixelArt'; // 复用原来的像素绘制逻辑

// 简单的线性插值函数
const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

export class PixiSimView {
    container: Container;
    private shadow: Graphics;
    private body: Graphics;
    private head: Sprite; // 现在只使用 Sprite，因为我们会把像素画转为 Texture
    private selectionRing: Graphics; // 🆕 选中光环
    
    private nameText: Text;
    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    // 缓存生成的头像纹理，避免每帧重绘
    private headTextureCache: string = ''; 

    constructor(sim: Sim) {
        this.container = new Container();
        
        // 初始化位置
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // 0. 选中光环 (默认隐藏)
        this.selectionRing = new Graphics();
        this.selectionRing.ellipse(0, 5, 12, 6).fill({ color: 0x39ff14, alpha: 0.5 });
        this.selectionRing.visible = false;
        this.container.addChild(this.selectionRing);

        // 1. 影子
        this.shadow = new Graphics();
        this.shadow.ellipse(0, 0, 6, 3).fill({ color: 0x000000, alpha: 0.2 });
        this.container.addChild(this.shadow);

        // 2. 身体
        this.body = new Graphics();
        this.container.addChild(this.body);

        // 3. 头部
        this.head = new Sprite(); 
        this.head.anchor.set(0.5);
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

    // 核心：生成头像纹理
    private updateHeadTexture(sim: Sim, size: number) {
        // 生成缓存键值：ID + 状态 + 外观变化
        const cacheKey = `${sim.id}_${sim.ageStage}_${sim.appearance.hair}_${sim.hairColor}`;
        if (this.headTextureCache === cacheKey && this.head.texture) return;

        // 如果有图片资源，直接使用
        if (sim.appearance.face && Assets.cache.has(sim.appearance.face)) {
            this.head.texture = Assets.get(sim.appearance.face);
        } 
        // 否则，使用离屏 Canvas 绘制像素头像
        else {
            const canvas = document.createElement('canvas');
            const pixelSize = size * 2; // 2倍大小以保证清晰
            canvas.width = pixelSize;
            canvas.height = pixelSize;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // 调用原始的像素绘制函数
                // 注意：坐标要偏移到中心
                drawAvatarHead(ctx, pixelSize / 2, pixelSize / 2 + size * 0.2, size, sim as any);
                const texture = Texture.from(canvas);
                this.head.texture = texture;
            }
        }
        
        this.headTextureCache = cacheKey;
        this.head.width = size * 2;
        this.head.height = size * 2;
    }

    redraw(sim: Sim) {
        this.body.clear();
        
        const config = AGE_CONFIG[sim.ageStage] || AGE_CONFIG.Adult;
        const w = config.width;
        const h = config.height;
        const headSize = config.headSize;

        // 绘制身体 (直接用 Graphics，性能更好)
        // 裤子
        this.body.rect(-w / 2, -h * 0.45, w, h * 0.45);
        this.body.fill({ color: sim.pantsColor || '#455A64' });
        
        // 衣服
        const shoulderY = -h + (headSize * 0.6);
        const shirtHeight = (-h * 0.45) - shoulderY;
        this.body.rect(-w / 2, shoulderY, w, shirtHeight);
        this.body.fill({ color: sim.clothesColor || '#e66767' });

        // 婴儿/幼儿特殊处理
        if (sim.ageStage === 'Infant' || sim.ageStage === 'Toddler') {
            this.body.clear();
            this.body.roundRect(-w / 2 + 1, -h * 0.45, w - 2, h * 0.45, 4);
            this.body.fill({ color: '#ffffff' }); // 尿布
            this.body.rect(-w / 2, -h + (headSize * 1), w, h * 0.4);
            this.body.fill({ color: sim.clothesColor });
        }

        // 更新头部纹理
        this.updateHeadTexture(sim, headSize);
        this.head.y = -h + (headSize * 0.5);
        
        this.nameText.y = -h - 5;
        this.bubbleContainer.y = -h - 25;
    }

    updatePosition(sim: Sim) {
        // [视觉插值] 平滑移动
        this.container.x = lerp(this.container.x, sim.pos.x, 0.2);
        this.container.y = lerp(this.container.y, sim.pos.y, 0.2);
        
        // [深度排序] 确保遮挡关系正确
        this.container.zIndex = sim.pos.y;

        // 气泡逻辑
        if (sim.bubble && sim.bubble.timer > 0 && sim.bubble.text) {
            this.bubbleContainer.visible = true;
            if (this.bubbleText.text !== sim.bubble.text) {
                this.bubbleText.text = sim.bubble.text;
                
                // 根据类型改变颜色
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
                // 小尾巴
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