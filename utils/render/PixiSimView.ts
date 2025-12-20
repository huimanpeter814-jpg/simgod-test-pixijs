import { Container, Graphics, Sprite, Assets, Text, Texture } from 'pixi.js';
import { Sim } from '../Sim';
import { AGE_CONFIG } from '../../constants';
import { drawAvatarHead } from './pixelArt'; 

// 简单的线性插值函数
const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

export class PixiSimView {
    container: Container;
    private shadow: Graphics;
    private body: Graphics;
    private head: Sprite; 
    private selectionRing: Graphics;
    
    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    private headTextureCache: string = ''; 

    constructor(sim: Sim) {
        this.container = new Container();
        
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // 0. 选中光环
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
        this.head.anchor.set(0.5); // 居中锚点
        this.container.addChild(this.head);

        // 5. 气泡
        this.bubbleContainer = new Container();
        this.bubbleContainer.visible = false; 
        
        this.bubbleBg = new Graphics();
        this.bubbleContainer.addChild(this.bubbleBg);

        this.bubbleText = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
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

    private updateHeadTexture(sim: Sim, size: number) {
        const cacheKey = `${sim.id}_${sim.ageStage}_${sim.appearance.hair}_${sim.hairColor}`;
        if (this.headTextureCache === cacheKey && this.head.texture) return;

        if (sim.appearance.face && Assets.cache.has(sim.appearance.face)) {
            this.head.texture = Assets.get(sim.appearance.face);
            // 确保外部加载的图片也是像素风格
            this.head.texture.source.scaleMode = 'nearest'; 
        } 
        else {
            // [修复1] 扩大画布尺寸：4倍缓冲，防止发型被切
            const bufferScale = 4; 
            const pixelSize = size * bufferScale; 
            
            const canvas = document.createElement('canvas');
            canvas.width = pixelSize;
            canvas.height = pixelSize;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // [修复2] 关闭 Canvas 平滑处理，确保绘制锐利
                ctx.imageSmoothingEnabled = false;

                // 绘制像素画 (注意居中)
                drawAvatarHead(ctx, pixelSize / 2, pixelSize / 2, size, sim as any);

                // [修复3] 修正报错的地方
                const texture = Texture.from(canvas);
                
                // 手动设置缩放模式为最近邻 (Nearest Neighbor)
                // 注意：在 PixiJS v8 中使用 .source.scaleMode
                texture.source.scaleMode = 'nearest'; 
                
                this.head.texture = texture;
                
                // 调整显示大小
                this.head.width = pixelSize; 
                this.head.height = pixelSize;
                
                // 缩小一半以匹配原来的视觉大小 (因为我们用了4倍缓冲)
                this.head.scale.set(1); 
            }
        }
        
        this.headTextureCache = cacheKey;
    }

    redraw(sim: Sim) {
        this.body.clear();
        
        const config = AGE_CONFIG[sim.ageStage] || AGE_CONFIG.Adult;
        const w = config.width;
        const h = config.height;
        const headSize = config.headSize;

        // 绘制身体
        this.body.rect(-w / 2, -h * 0.45, w, h * 0.45);
        this.body.fill({ color: sim.pantsColor || '#455A64' });
        
        const shoulderY = -h + (headSize * 0.6);
        const shirtHeight = (-h * 0.45) - shoulderY;
        this.body.rect(-w / 2, shoulderY, w, shirtHeight);
        this.body.fill({ color: sim.clothesColor || '#e66767' });

        if (sim.ageStage === 'Infant' || sim.ageStage === 'Toddler') {
            this.body.clear();
            this.body.roundRect(-w / 2 + 1, -h * 0.45, w - 2, h * 0.45, 4);
            this.body.fill({ color: '#ffffff' }); 
            this.body.rect(-w / 2, -h + (headSize * 1), w, h * 0.4);
            this.body.fill({ color: sim.clothesColor });
        }

        this.updateHeadTexture(sim, headSize);
        
        // [调整] 头部位置修正
        // 因为现在 head Sprite 的中心点是 (0.5, 0.5)，且画布很大
        // 我们只需要把 Sprite 放在脖子的位置即可
        this.head.y = -h + (headSize * 0.5);

        this.bubbleContainer.y = -h - 25;
    }

    updatePosition(sim: Sim) {
        // [修复4] 确保坐标是整数，避免子像素渲染导致的模糊
        this.container.x = Math.round(sim.pos.x);
        this.container.y = Math.round(sim.pos.y);
        
        this.container.zIndex = sim.pos.y;

        if (sim.bubble && sim.bubble.timer > 0 && sim.bubble.text) {
            this.bubbleContainer.visible = true;
            if (this.bubbleText.text !== sim.bubble.text) {
                this.bubbleText.text = sim.bubble.text;
                
                let bgColor = 0xffffff;
                let strokeColor = 0x000000;
                if (sim.bubble.type === 'love') { bgColor = 0xfd79a8; strokeColor = 0xe84393; }
                else if (sim.bubble.type === 'bad') { bgColor = 0xff7675; strokeColor = 0xd63031; }
                else if (sim.bubble.type === 'money') { bgColor = 0xffeaa7; strokeColor = 0xfdcb6e; }

                const width = this.bubbleText.width + 15;
                const height = this.bubbleText.height + 10;
                
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