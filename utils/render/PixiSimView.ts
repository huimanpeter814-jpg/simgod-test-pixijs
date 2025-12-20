import { Container, Graphics, Sprite, Assets, Text, Texture } from 'pixi.js';
import { Sim } from '../Sim';
import { AGE_CONFIG } from '../../constants';
import { drawAvatarHead } from './pixelArt'; 
import { OutlineFilter } from 'pixi-filters'; // 引入描边滤镜

// 简单的线性插值函数
const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

export class PixiSimView {
    container: Container;
    
    // 🆕 新增：角色整体容器（用于应用统一的轮廓描边）
    private characterContainer: Container; 

    private shadow: Graphics;
    private body: Graphics;
    
    // 🆕 修改：将头部拆分为前后两层
    private headFront: Sprite; 
    private headBack: Sprite;

    private selectionRing: Graphics;
    
    private bubbleContainer: Container;
    private bubbleBg: Graphics;
    private bubbleText: Text;

    private headTextureCache: string = ''; 

    constructor(sim: Sim) {
        this.container = new Container();
        
        this.container.x = sim.pos.x;
        this.container.y = sim.pos.y;
        
        // 0. 选中光环 (在最底层，不参与人物轮廓描边)
        this.selectionRing = new Graphics();
        this.selectionRing.ellipse(0, 5, 12, 6).fill({ color: 0x39ff14, alpha: 0.5 });
        this.selectionRing.visible = false;
        this.container.addChild(this.selectionRing);

        // 1. 影子 (也不参与轮廓描边)
        this.shadow = new Graphics();
        this.shadow.ellipse(0, 0, 6, 3).fill({ color: 0x000000, alpha: 0.2 });
        this.container.addChild(this.shadow);

        // === 🆕 角色主体容器 ===
        this.characterContainer = new Container();
        this.container.addChild(this.characterContainer);

        // 尝试添加轮廓描边滤镜
        // [修复] 提升质量参数：thickness: 1, color: 0x000000, quality: 1 (原分辨率)
        // 之前 0.1 导致了严重的模糊
        try {
            this.characterContainer.filters = [new OutlineFilter(2, 0x000000, 1)]; 
        } catch (e) {
            console.warn("OutlineFilter load failed, ignoring outline.", e);
        }

        // 2. 后发 (Back Hair) - 最底层
        this.headBack = new Sprite();
        this.headBack.anchor.set(0.5);
        this.characterContainer.addChild(this.headBack);

        // 3. 身体 (Body) - 中间层 (遮挡后发)
        this.body = new Graphics();
        this.characterContainer.addChild(this.body);

        // 4. 前发与脸 (Front Hair & Face) - 最上层 (遮挡身体顶部)
        this.headFront = new Sprite(); 
        this.headFront.anchor.set(0.5); 
        this.characterContainer.addChild(this.headFront);

        // 5. 气泡 (在最上层)
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

    // 🆕 更新：生成两张纹理（前层和后层）
    private updateHeadTextures(sim: Sim, size: number) {
        const cacheKey = `${sim.id}_${sim.ageStage}_${sim.appearance.hair}_${sim.hairColor}`;
        if (this.headTextureCache === cacheKey && this.headFront.texture && this.headBack.texture) return;

        if (sim.appearance.face && Assets.cache.has(sim.appearance.face)) {
            // 如果是图片资源，目前简化处理，都放在前层
            this.headFront.texture = Assets.get(sim.appearance.face);
            this.headFront.texture.source.scaleMode = 'nearest'; 
            this.headBack.texture = Texture.EMPTY;
        } 
        else {
            // [修复] 缓冲倍率优化：2倍足够且通常能保持整数运算，避免子像素模糊
            const bufferScale = 2; 
            const pixelSize = size * bufferScale; 
            
            // --- 生成后发纹理 ---
            const canvasBack = document.createElement('canvas');
            canvasBack.width = pixelSize;
            canvasBack.height = pixelSize;
            const ctxBack = canvasBack.getContext('2d');
            
            if (ctxBack) {
                ctxBack.imageSmoothingEnabled = false;
                // 仅绘制 'back' 层
                drawAvatarHead(ctxBack, pixelSize / 2, pixelSize / 2, size, sim as any, 'back');
                
                const textureBack = Texture.from(canvasBack);
                textureBack.source.scaleMode = 'nearest'; 
                this.headBack.texture = textureBack;
                this.headBack.width = pixelSize; 
                this.headBack.height = pixelSize;
                // 恢复到正常大小 (因为 texture 是 2 倍大，如果不缩放会显示很大，或者设置 width/height 也可以)
                // 这里通过设置 width/height 来控制显示大小，保持和 bufferScale 无关的逻辑尺寸
                // 但为了保持像素点 sharp，最好是 texture 是多少像素就显示多少像素，然后让 camera zoom 去缩放
                // 不过 SimView 的逻辑是基于 World Unit 的，所以这里 width 设为 pixelSize 其实是让它在世界中变大了
                // 实际上我们应该缩放 Sprite 以匹配 bufferScale
                
                // 修正：如果 bufferScale=2，texture 是 size*2。
                // 我们希望在世界中显示的大小仍然大致对应 size。
                // pixelArt 绘制时是基于 size 的。
                // 如果我们把 width 设为 pixelSize，它在屏幕上会很大。
                // 我们直接设置 scale = 1，让它按像素显示，这样看起来更清晰，但可能有点大。
                // 或者我们可以缩放回去：
                // this.headBack.scale.set(1 / bufferScale); 
                // 但之前的代码是直接设置 width = pixelSize，这会让头变得很大 (size * 2)。
                // 让我们保持 width = pixelSize，这样头会比较清晰（大像素），配合身体。
                this.headBack.width = pixelSize; 
                this.headBack.height = pixelSize;
            }

            // --- 生成前发+脸部纹理 ---
            const canvasFront = document.createElement('canvas');
            canvasFront.width = pixelSize;
            canvasFront.height = pixelSize;
            const ctxFront = canvasFront.getContext('2d');
            
            if (ctxFront) {
                ctxFront.imageSmoothingEnabled = false;
                // 仅绘制 'front' 层 (包含脸部)
                drawAvatarHead(ctxFront, pixelSize / 2, pixelSize / 2, size, sim as any, 'front');
                
                const textureFront = Texture.from(canvasFront);
                textureFront.source.scaleMode = 'nearest'; 
                this.headFront.texture = textureFront;
                this.headFront.width = pixelSize; 
                this.headFront.height = pixelSize;
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

        // 更新前后两层纹理
        this.updateHeadTextures(sim, headSize);
        
        // 头部位置
        const headY = -h + (headSize * 0.5);
        this.headFront.y = headY;
        this.headBack.y = headY;

        this.bubbleContainer.y = -h - 25;
    }

    updatePosition(sim: Sim) {
        // [修复] 使用 Math.round 确保像素对齐，防止模糊
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