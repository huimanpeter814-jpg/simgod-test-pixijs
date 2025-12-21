import { SimData, AgeStage } from '../../types';
import { getAsset } from '../assetLoader';
import { Graphics, ColorSource } from 'pixi.js';

// ==========================================
// 🎨 像素风格渲染库
// 包含：
// 1. Canvas 2D 绘图 (用于 UI 头像、程序化发型)
// 2. Pixi Graphics 绘图 (用于高性能场景家具)
// ==========================================

// --- 🛠️ 像素绘图辅助函数 (Pixel Helpers) ---

const PIXEL_STEP = 2; // 像素阶梯大小，控制“像素感”的颗粒度

// 1. 绘制伪圆形 (用矩形堆叠模拟)
const drawPseudoCircle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string | CanvasGradient | CanvasPattern) => {
    ctx.fillStyle = color;
    // 简单的切角正方形 (Chamfered Box)
    // 竖条 (中间宽，上下短)
    ctx.fillRect(cx - r + PIXEL_STEP, cy - r, (r * 2) - (PIXEL_STEP * 2), r * 2);
    // 横条 (中间宽，左右短) - 填充左右突出的部分
    ctx.fillRect(cx - r, cy - r + PIXEL_STEP, r * 2, (r * 2) - (PIXEL_STEP * 2));
};

// 2. 绘制上圆下直的形状 (用于发型主体 - 模拟圆顶)
const drawPseudoTopRound = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasGradient | CanvasPattern) => {
    ctx.fillStyle = color;
    // 顶部凸起 (缩进)
    ctx.fillRect(x + PIXEL_STEP, y, w - (PIXEL_STEP * 2), PIXEL_STEP);
    // 主体
    ctx.fillRect(x, y + PIXEL_STEP, w, h - PIXEL_STEP);
};

// 3. 绘制全圆角矩形 (伪圆角)
const drawPseudoRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasGradient | CanvasPattern) => {
    ctx.fillStyle = color;
    // 竖向主干
    ctx.fillRect(x + PIXEL_STEP, y, w - (PIXEL_STEP * 2), h);
    // 横向主干 (不包含四角)
    ctx.fillRect(x, y + PIXEL_STEP, w, h - (PIXEL_STEP * 2));
};


// 1. 绘制像素发型 (更新支持年龄段)
const drawPixelHair = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    s: number, 
    color: string, 
    styleIndex: number, 
    ageStage: AgeStage,
    layer: 'back' | 'front'
) => {    
    // 婴儿：只有前层 (毛发稀疏，没有后发)
    if (ageStage === 'Infant') {
        if (layer === 'back') return; // 婴儿没有后发
        ctx.fillStyle = color;
        // 使用伪圆形代替 arc
        drawPseudoCircle(ctx, x, y - s - 2, 2, color);
        ctx.fillRect(x - 4, y - s, 2, 2);
        ctx.fillRect(x + 2, y - s, 2, 2);
        return;
    }

    // 老人颜色处理
    let finalColor = color;
    let effectiveStyle = styleIndex;

    if (ageStage === 'Elder') {
        const greyScale = ['#dcdde1', '#7f8fa6', '#b2bec3'];
        finalColor = greyScale[styleIndex % greyScale.length];
        if (styleIndex % 3 === 0) effectiveStyle = 9; // 地中海
    }

    ctx.fillStyle = finalColor;

    // --- 1. 辅助绘制函数 ---

    // 高光 (仅在前层绘制)
    const drawHighlight = (offY: number = 0, widthScale: number = 1.0) => {
        if (layer === 'back') return; 
        if (finalColor === '#ffffff' || finalColor === '#dcdde1') return;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        const w = s * 1.2 * widthScale;
        const h = s * 0.25;
        // 矩形高光，不做圆角，更像像素
        ctx.fillRect(x - w/2, y - s - s*0.2 + offY, w, h);
        ctx.fillStyle = finalColor;
    };

    // 基础头套 (Base Shape) - 绝大多数属于前层
    const drawBaseCap = () => {
         const noBaseStyles = [6, 7, 9, 14]; 
         if (!noBaseStyles.includes(effectiveStyle)) {
            // 使用伪圆顶绘制
            drawPseudoTopRound(ctx, x - s, y - s - 2, s * 2, s * 1.2, finalColor);
        }
    };

    // --- 2. 分层绘制逻辑 ---

    if (layer === 'front') {
        // === 前层绘制 (Front Layer) ===
        
        drawBaseCap(); 

        switch (effectiveStyle) {
            case 0: // Standard Short
                // 左侧圆顶
                drawPseudoTopRound(ctx, x - s, y - s, s * 0.4, s * 0.8, finalColor);
                // 右侧圆顶
                drawPseudoTopRound(ctx, x + s - s * 0.4, y - s, s * 0.4, s * 0.8, finalColor);
                
                ctx.fillRect(x - s * 0.5, y - s, s, s * 0.4); 
                drawHighlight();
                break;
            case 1: // Bob
                // 顶部整块伪圆角
                drawPseudoTopRound(ctx, x - s, y - s, s * 2, s * 0.5, finalColor);
                // 两侧包脸部分
                ctx.fillRect(x - s - 2, y - s, s * 0.6, s * 1.8);
                ctx.fillRect(x + s + 2 - s * 0.6, y - s, s * 0.6, s * 1.8);
                drawHighlight(0, 1.2);
                break;
            case 2: // Spiky
                // 刺猬头基础覆盖 (保留多边形，但因为是直线所以符合像素风格)
                ctx.beginPath();
                ctx.moveTo(x - s, y - s + 4); 
                ctx.lineTo(x - s * 0.5, y - s - 6);
                ctx.lineTo(x, y - s - 3);
                ctx.lineTo(x + s * 0.5, y - s - 7);
                ctx.lineTo(x + s, y - s + 4);
                ctx.fill();
                // 两侧鬓角
                ctx.fillRect(x - s, y - s, s * 0.3, s * 0.6);
                ctx.fillRect(x + s - s * 0.3, y - s, s * 0.3, s * 0.6);
                break;
            case 3: // Slicked Back
                drawPseudoTopRound(ctx, x - s, y - s, s * 2, s * 0.5, finalColor);
                ctx.fillRect(x - s, y - s, s * 0.5, s * 1.2);
                ctx.fillRect(x + s - s * 0.5, y - s, s * 0.5, s * 1.2);
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.fillRect(x + s * 0.2, y - s - 2, 1, s * 0.8);
                ctx.fillStyle = finalColor;
                drawHighlight();
                break;
            case 4: // Bun
                ctx.fillRect(x - s, y - s, s * 0.3, s * 1.0);
                ctx.fillRect(x + s - s * 0.3, y - s, s * 0.3, s * 1.0);
                // 伪圆丸子
                drawPseudoCircle(ctx, x, y - s - 5, s * 0.6, finalColor);
                drawHighlight(-2);
                break;
            case 5: // Hime Cut (前)
                ctx.fillRect(x - s + 1, y, s * 0.4, s * 0.8); 
                ctx.fillRect(x + s - s * 0.4 - 1, y, s * 0.4, s * 0.8);
                // 刘海顶部伪圆角
                drawPseudoTopRound(ctx, x - s + 2, y - s, s * 2 - 4, s * 0.4, finalColor);
                drawHighlight(0, 1.3);
                break;
            case 6: // Afro (前)
                // 1. 核心主体块
                ctx.fillRect(x - s * 1.0, y - s * 1.1, s * 2.0, s * 1.0);
                // 2. 顶部隆起 (阶梯状)
                ctx.fillRect(x - s * 0.7, y - s * 1.3, s * 1.4, s * 0.2);
                // 3. 底部/鬓角加宽
                ctx.fillRect(x - s * 1.15, y - s * 0.6, s * 0.15, s * 0.8); 
                ctx.fillRect(x + s * 1.0, y - s * 0.6, s * 0.15, s * 0.8);  
                // 4. 底部边缘修整
                ctx.fillRect(x - s * 0.8, y - s * 0.2, s * 1.6, s * 0.2);
                break;
            case 7: // Mohawk (前)
                ctx.fillRect(x - s*0.5, y - s - 9, s * 1, s * 1.8);
                ctx.fillStyle = 'rgba(0,0,0,0.15)'; 
                drawPseudoTopRound(ctx, x - s, y - s, s * 2, s * 0.8, ctx.fillStyle);
                ctx.fillStyle = finalColor;
                break;
            case 8: // Twin Tails (前)
                ctx.fillStyle = '#FF5252'; 
                // 左侧发圈
                ctx.fillRect(x - s - 3, y - s * 0.1, 4, 4);
                ctx.fillStyle = 'rgba(255,255,255,0.3)'; 
                ctx.fillRect(x - s - 3, y - s * 0.1, 2, 2);
                
                ctx.fillStyle = '#FF5252';
                // 右侧发圈
                ctx.fillRect(x + s - 1, y - s * 0.1, 4, 4);
                ctx.fillStyle = 'rgba(255,255,255,0.3)'; 
                ctx.fillRect(x + s - 1, y - s * 0.1, 2, 2);
                ctx.fillStyle = finalColor;
                break;
            case 9: // Balding (前)
                // 左右伪圆角
                drawPseudoRoundRect(ctx, x - s - 3, y - s * 0.6, s * 0.6, s * 0.8, finalColor);
                drawPseudoRoundRect(ctx, x + s - s * 0.4 , y - s * 0.6, s * 0.6, s * 0.8, finalColor);
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.fillRect(x - 2, y - s - 2, 4, 2);
                ctx.fillStyle = finalColor;
                break;
            case 10: // Curtains
                // 像素化曲线：去除贝塞尔曲线，使用直线近似
                // 左边
                ctx.beginPath();
                ctx.moveTo(x, y - s - 2);
                ctx.lineTo(x - s - 2, y + s * 0.8);
                ctx.lineTo(x - s * 0.5, y); // 收回
                ctx.lineTo(x, y - s);
                ctx.fill();
                // 右边
                ctx.beginPath();
                ctx.moveTo(x, y - s - 2);
                ctx.lineTo(x + s + 2, y + s * 0.8);
                ctx.lineTo(x + s * 0.5, y);
                ctx.lineTo(x, y - s);
                ctx.fill();
                drawHighlight();
                break;
            case 11: // High Ponytail (前)
                ctx.fillRect(x - s * 0.3, y - s - 4, s * 0.6, 4); 
                drawHighlight(-4);
                break;
            case 12: // Mullet (前)
                drawPseudoTopRound(ctx, x - s - 1, y - s, s * 2 + 2, s * 0.5, finalColor);
                ctx.fillRect(x - s, y, s * 0.4, s * 0.8);
                ctx.fillRect(x + s - s * 0.4, y, s * 0.4, s * 0.8);
                drawHighlight();
                break;
            case 13: // Emo
                // 像素化Emo刘海：使用矩形堆叠模拟斜度
                ctx.fillRect(x - s, y - s + 2, s * 2, s * 0.5); // 顶部
                // 斜向遮盖
                for(let i=0; i<s*1.5; i+=2) {
                     // 阶梯式下降
                     ctx.fillRect(x - s + i, y - s + 2 + i/2, 4, s);
                }
                drawHighlight();
                break;
            case 14: // Dreads (前)
                drawPseudoTopRound(ctx, x - s, y - s - 2, s * 2, s * 0.3, finalColor);
                ctx.fillRect(x - s, y - s, s * 0.2, s * 0.4); 
                ctx.fillRect(x + s - s * 0.2, y - s, s * 0.2, s * 0.4);
                break;
            case 15: // Wavy (前)
                // 左伪圆角
                drawPseudoTopRound(ctx, x - s - 2, y - s, s * 0.6, s, finalColor);
                // 右伪圆角
                drawPseudoTopRound(ctx, x + s + 2 - s * 0.6, y - s, s * 0.6, s, finalColor);
                drawHighlight();
                break;
            case 16: // Half-Up (前)
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.fillRect(x - s * 0.5, y - s * 0.2, s, 2);
                ctx.fillStyle = finalColor;
                drawHighlight();
                break;
        }

    } else {
        // === 后层绘制 (Back Layer) ===
        // 统一使用伪圆角
        
        switch (effectiveStyle) {
            case 1: // Bob (后)
                drawPseudoRoundRect(ctx, x - s - 2, y - s, s * 2 + 4, s * 1.8, finalColor);
                break;
            case 5: // Hime Cut (后)
                drawPseudoTopRound(ctx, x - s - 1, y - s, s * 2 + 2, s * 2.5, finalColor);
                break;
            case 6: // Afro (后)
                ctx.fillRect(x - s * 1.1, y - s * 0.6, s * 2.2, s * 1.0);
                ctx.fillRect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 0.2);
                ctx.fillRect(x - s * 1.2, y - s * 0.2, s * 0.2, s * 0.8);
                ctx.fillRect(x + s * 1.0, y - s * 0.2, s * 0.2, s * 0.8);
                ctx.fillRect(x - s * 0.9, y + s * 0.4, s * 1.8, s * 0.2);
                break;
            case 7: 
                break;
            case 8: // Twin Tails (后)
                const tailW = s * 0.45;
                const tailH = s * 1.5;
                const tailOffX = s * 1.05;
                // 方块堆叠马尾
                ctx.fillRect(x - tailOffX - tailW + 4, y - s * 0.1, tailW - 2, tailH * 0.3);
                ctx.fillRect(x - tailOffX - tailW + 2, y + s * 0.2, tailW, tailH * 0.4);
                ctx.fillRect(x - tailOffX - tailW, y + s * 0.6, tailW + 2, tailH * 0.3);

                ctx.fillRect(x + tailOffX, y - s * 0.1, tailW - 2, tailH * 0.3);
                ctx.fillRect(x + tailOffX, y + s * 0.2, tailW, tailH * 0.4);
                ctx.fillRect(x + tailOffX, y + s * 0.6, tailW + 2, tailH * 0.3);
                break;
            case 9: // Balding (后)
                ctx.fillRect(x - s, y + s * 0.5, s * 2, s * 0.4);
                break;
            case 11: // High Ponytail (后)
                drawPseudoRoundRect(ctx, x - s * 0.6, y - s - 12, s * 1.2, s * 1.2, finalColor);
                ctx.fillRect(x - s * 0.3, y - s - 4, s * 0.6, s * 1.5);
                break;
            case 12: // Mullet (后)
                ctx.beginPath();
                ctx.moveTo(x - s, y + s * 0.5);
                ctx.lineTo(x - s * 1.4, y + s * 1.5);
                ctx.lineTo(x + s * 1.4, y + s * 1.5);
                ctx.lineTo(x + s, y + s * 0.5);
                ctx.fill();
                break;
            case 14: // Dreads (后)
                for(let i = 0; i < 5; i++) {
                    let off = (i - 2) * (s * 0.5);
                    ctx.fillStyle = finalColor;
                    drawPseudoRoundRect(ctx, x + off - 2, y - s * 0.5, 4, s * 2.0, finalColor);
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.fillRect(x + off - 2, y + s * 0.5, 4, 1);
                    ctx.fillRect(x + off - 2, y + s, 4, 1);
                }
                break;
            case 15: // Wavy (后)
                drawPseudoRoundRect(ctx, x - s - 2, y, s * 0.6, s * 2, finalColor);
                drawPseudoRoundRect(ctx, x + s + 2 - s * 0.6, y, s * 0.6, s * 2, finalColor);
                ctx.fillRect(x - s - 4, y + s * 1.5, 4, 4);
                ctx.fillRect(x + s, y + s * 1.5, 4, 4);
                break;
            case 16: // Half-Up (后)
                ctx.fillRect(x - s * 0.8, y, s * 1.6, s * 2.2);
                break;
        }
    }
};

// 2. 绘制头像 (支持分层：后发 -> 脸 -> 前发)
export function drawAvatarHead(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    sim: SimData,
    renderLayer: 'all' | 'back' | 'front' = 'all' // 此参数在图片模式下意义不大，保留兼容性
) {
    // 基础尺寸是 48x48 (素材尺寸)
    // size 参数通常是期望的半径或一半大小，我们需要计算缩放比例
    // 假设目标是绘制一个完整的头像区域
    
    const bodyImg = getAsset(sim.appearance.body);
    const outfitImg = getAsset(sim.appearance.outfit);
    const hairImg = getAsset(sim.appearance.hair);

    // === 核心修改：只截取头部区域 ===
    // 假设 48x48 素材中，头部位于上方中间
    // sourceX/Y/W/H: 在原图上裁剪的区域 (头部框)
    const srcX = 15; 
    const srcY = 10;  
    const srcS = 50; // 截取 20x20 像素的头部区域

    // destX/Y/W/H: 在画布上绘制的区域 (放大显示)
    const destSize = size * 2.5; // 根据传入的半径 size 放大填充
    const destX = x - destSize / 2;
    const destY = y - destSize / 2;

    // 辅助绘制函数
    const drawLayer = (img: HTMLImageElement | null, tintColor?: string) => {
        if (img) {
            ctx.imageSmoothingEnabled = false; // 保持像素清晰

            if (tintColor) {
                // 🆕 染色逻辑
                const buffer = document.createElement('canvas');
                buffer.width = destSize;
                buffer.height = destSize;
                const bCtx = buffer.getContext('2d');
                if (bCtx) {
                    bCtx.imageSmoothingEnabled = false;

                    // 1. 绘制原图 (裁切后)
                    bCtx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, destSize, destSize);

                    // 2. 正片叠底着色 (适用于灰度/白底素材)
                    bCtx.globalCompositeOperation = 'multiply';
                    bCtx.fillStyle = tintColor;
                    bCtx.fillRect(0, 0, destSize, destSize);

                    // 3. 恢复透明度 (将颜色限制在原图非透明区域)
                    bCtx.globalCompositeOperation = 'destination-in';
                    bCtx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, destSize, destSize);

                    // 4. 绘制到主画布
                    ctx.drawImage(buffer, destX, destY);
                }
            } else {
                // 原逻辑：直接绘制
                // 参数详解: 图片, 裁剪X, 裁剪Y, 裁剪宽, 裁剪高, 绘制X, 绘制Y, 绘制宽, 绘制高
                ctx.drawImage(img, srcX, srcY, srcS, srcS, destX, destY, destSize, destSize);
            }
        }
    };

    if (renderLayer === 'all' || renderLayer === 'back') {
        drawLayer(bodyImg);
    }
    
    if (renderLayer === 'all' || renderLayer === 'front') {
        drawLayer(outfitImg);
        // 🆕 传入发色进行绘制
        drawLayer(hairImg, sim.hairColor);
    }

    // 兜底逻辑：如果没有图片，画一个带问号的圆圈
    if (!bodyImg && !outfitImg && !hairImg) {
        ctx.fillStyle = sim.skinColor || '#cccccc';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("?", x, y);
    }
}

// 3. 绘制像素家具/物体 (支持旋转)
export const drawPixelProp = (ctx: CanvasRenderingContext2D, f: any, p: any) => {
    // 🆕 旋转支持
    const rotation = f.rotation || 0;
    
    // 如果没有旋转，走快速通道
    if (rotation === 0) {
        drawInternal(ctx, f.x, f.y, f.w, f.h, f, p);
    } else {
        // 计算旋转中心
        const cx = f.x + f.w / 2;
        const cy = f.y + f.h / 2;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rotation * 90 * Math.PI) / 180);
        
        const isRotated90 = rotation % 2 !== 0;
        const localW = isRotated90 ? f.h : f.w;
        const localH = isRotated90 ? f.w : f.h;
        
        // drawInternal 期望左上角坐标。我们在中心，所以偏移 -localW/2
        drawInternal(ctx, -localW/2, -localH/2, localW, localH, { ...f, x: -localW/2, y: -localH/2 }, p);
        
        ctx.restore();
    }
};

// 内部绘制函数 (Canvas 版本 - 保留用于 Ghost 预览等)
const drawInternal = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: any, p: any) => {
    const { color, pixelPattern } = f;
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.fillStyle = color;

    // --- 🌳 自然景观 (树木/灌木) ---
    if (pixelPattern === 'tree_pixel') {
        ctx.fillStyle = '#6D4C41';
        const trunkW = w * 0.3;
        ctx.fillRect(x + (w - trunkW) / 2, y + h * 0.6, trunkW, h * 0.4);
        
        ctx.fillStyle = color; 
        // 使用伪圆绘制树冠
        drawPseudoCircle(ctx, cx, cy - 5, w/2, color);
        drawPseudoCircle(ctx, cx - 8, cy + 5, w/3, color);
        drawPseudoCircle(ctx, cx + 8, cy + 5, w/3, color);
        
        ctx.fillStyle = '#ff7675';
        ctx.fillRect(cx - 10, cy - 10, 4, 4);
        ctx.fillRect(cx + 5, cy, 4, 4);
        return;
    }
    
    if (pixelPattern === 'bush') {
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(x, y + h*0.2, w, h*0.8);
        ctx.fillStyle = '#4CAF50'; 
        ctx.fillRect(x + 4, y, w - 8, h*0.4);
        ctx.fillStyle = '#FF5252';
        ctx.fillRect(x + 6, y + 10, 4, 4);
        ctx.fillRect(x + w - 10, y + 15, 4, 4);
        return;
    }

    if (pixelPattern === 'flower_rose') {
        ctx.fillStyle = '#27ae60';
        drawPseudoCircle(ctx, cx, cy, w/2, '#27ae60');
        ctx.fillStyle = '#d63031';
        drawPseudoCircle(ctx, cx - 5, cy - 5, 4, '#d63031');
        drawPseudoCircle(ctx, cx + 5, cy + 5, 4, '#d63031');
        drawPseudoCircle(ctx, cx + 5, cy - 5, 4, '#d63031');
        drawPseudoCircle(ctx, cx - 5, cy + 5, 4, '#d63031');
        return;
    }

    // --- 1. 🎹 乐器类 ---
    if (pixelPattern === 'piano') {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(x, y, w, h);
        if (h > w) {
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(x + w * 0.6, y + 2, w * 0.35, h - 4);
        } else {
             ctx.fillStyle = '#3d3d3d';
             ctx.fillRect(x, y + h * 0.4, w, h * 0.2);
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(x + 2, y + h * 0.6, w - 4, h * 0.35);
             ctx.fillStyle = '#000000';
             for (let i = 10; i < w - 10; i += 12) {
                 if (i % 24 !== 0) ctx.fillRect(x + i, y + h * 0.6, 6, h * 0.2);
             }
        }
        return;
    }

    // --- 2. 🏃 健身类 ---
    if (pixelPattern === 'treadmill') { 
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#636e72'; 
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8); 
        ctx.fillStyle = '#000';
        if (h > w) {
            for(let i=y+4; i<y+h-4; i+=10) ctx.fillRect(x+4, i, w-8, 2); 
            ctx.fillStyle = '#dfe6e9'; ctx.fillRect(x, y, w, 20); 
        } else {
            for(let i=x+4; i<x+w-4; i+=10) ctx.fillRect(i, y+4, 2, h-8);
            ctx.fillStyle = '#dfe6e9'; ctx.fillRect(x, y, 20, h); 
        }
        return;
    }
    if (pixelPattern === 'weights_rack') {
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(x, y, w, h); 
        ctx.fillStyle = '#b2bec3';
        if (h > w) {
            ctx.fillRect(x - 5, y + 20, w + 10, 6); 
            ctx.fillStyle = '#000';
            drawPseudoCircle(ctx, x - 5, y + 23, 8, '#000');
            drawPseudoCircle(ctx, x + w + 5, y + 23, 8, '#000');
        } else {
            ctx.fillRect(x + 20, y - 5, 6, h + 10);
            ctx.fillStyle = '#000';
            drawPseudoCircle(ctx, x + 23, y - 5, 8, '#000');
            drawPseudoCircle(ctx, x + 23, y + h + 5, 8, '#000');
        }
        return;
    }
    if (pixelPattern === 'yoga_mat') {
        drawPseudoRoundRect(ctx, x, y, w, h, color);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        return;
    }

    // --- 3. 🎨 艺术与技能 ---
    if (pixelPattern === 'easel') {
        ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 3;
        ctx.beginPath();
        if (h > w) {
            ctx.moveTo(cx, y); ctx.lineTo(x, y+h);
            ctx.moveTo(cx, y); ctx.lineTo(x+w, y+h);
            ctx.moveTo(cx, y); ctx.lineTo(cx, y+h); 
        } else {
            ctx.moveTo(x, cy); ctx.lineTo(x+w, y);
            ctx.moveTo(x, cy); ctx.lineTo(x+w, y+h);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + w*0.1, y + h*0.2, w*0.8, h * 0.6);
        ctx.fillStyle = color;
        drawPseudoCircle(ctx, cx, cy, 6, color);
        return;
    }
    if (pixelPattern === 'chess_table') {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(x+4, y+4, w-8, h-8);
        ctx.fillStyle = '#dcdde1'; ctx.fillRect(x, y, w, h);
        const cellSize = Math.min(w, h) / 4;
        ctx.fillStyle = '#2f3542';
        for(let r=0; r<4; r++) {
            for(let c=0; c<4; c++) {
                if ((r+c)%2===1) ctx.fillRect(x + c*cellSize + (w-cellSize*4)/2, y + r*cellSize + (h-cellSize*4)/2, cellSize, cellSize);
            }
        }
        return;
    }

    // --- 4. 🏥 医疗与科技 ---
    if (pixelPattern === 'medical_bed') {
        ctx.fillStyle = '#dfe6e9'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#74b9ff'; 
        if (h > w) ctx.fillRect(x, y, w, 15);
        else ctx.fillRect(x, y, 15, h);
        
        const crossSize = 12;
        ctx.fillStyle = '#ff7675';
        ctx.fillRect(cx - crossSize/2, cy - 4, crossSize, 8);
        ctx.fillRect(cx - 4, cy - crossSize/2, 8, crossSize);
        return;
    }
    if (pixelPattern === 'scanner') { 
        ctx.fillStyle = '#b2bec3'; 
        const minDim = Math.min(w,h);
        drawPseudoCircle(ctx, cx, cy, minDim/2, '#b2bec3'); 
        ctx.fillStyle = '#2d3436';
        drawPseudoCircle(ctx, cx, cy, minDim/3, '#2d3436'); 
        
        ctx.fillStyle = '#74b9ff';
        if (h > w) ctx.fillRect(x + 10, cy, w - 20, h/2);
        else ctx.fillRect(cx, y + 10, w/2, h - 20);
        return;
    }
    if (pixelPattern === 'server') {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(x, y, w, h);
        const time = Date.now();
        
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

        if (h > w) {
            for (let i = 5; i < h - 5; i += 8) {
                ctx.fillStyle = (Math.sin(time/200 + i) > 0) ? '#00b894' : '#000';
                ctx.fillRect(x + w - 8, y + i, 4, 4);
            }
        } else {
            for (let i = 5; i < w - 5; i += 8) {
                ctx.fillStyle = (Math.sin(time/200 + i) > 0) ? '#00b894' : '#000';
                ctx.fillRect(x + i, y + h - 8, 4, 4);
            }
        }
        return;
    }

    // --- 5. 🏡 居家生活 ---
    if (pixelPattern && pixelPattern.startsWith('bed')) {
        ctx.fillStyle = '#5D4037'; ctx.fillRect(x, y, w, 8); // Headboard
        ctx.fillStyle = color; ctx.fillRect(x + 2, y + 8, w - 4, h - 8); // Body
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 2, y + 30, w - 4, h - 32); // Blanket
        ctx.fillStyle = '#FFFFFF'; // Pillow
        if (pixelPattern === 'bed_king' || pixelPattern === 'bed_bunk') {
            ctx.fillRect(x + 6, y + 12, w / 2 - 10, 12); 
            ctx.fillRect(x + w / 2 + 4, y + 12, w / 2 - 10, 12); 
        } else {
            ctx.fillRect(x + w/2 - 10, y + 12, 20, 12);
        }
        return;
    }

    if (pixelPattern === 'kitchen' || pixelPattern === 'fridge') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; 
        if (pixelPattern === 'kitchen') {
            if (h > w) {
                ctx.fillRect(x + w - 4, y, 2, h); 
                if (f.tags?.includes('stove')) {
                    ctx.fillStyle = '#2d3436';
                    drawPseudoCircle(ctx, cx, y + h/6, 6, '#2d3436');
                    drawPseudoCircle(ctx, cx, y + h/2, 6, '#2d3436');
                }
            } else {
                ctx.fillRect(x, y + 4, w, 2); 
                if (f.tags?.includes('stove')) {
                    ctx.fillStyle = '#2d3436';
                    drawPseudoCircle(ctx, x + w/6, y + h/2, 6, '#2d3436');
                    drawPseudoCircle(ctx, x + w/2, y + h/2, 6, '#2d3436');
                }
            }
        } else {
            if (h > w) ctx.fillRect(x, y + h/3, w, 2);
            else ctx.fillRect(x + w/3, y, 2, h);
        }
        return;
    }
    
    if (pixelPattern === 'toilet') {
        ctx.fillStyle = '#fff';
        if (h > w) {
            ctx.fillRect(x + w/4, y, w/2, 10);
            drawPseudoCircle(ctx, cx, cy + 5, 10, '#fff');
        } else {
            ctx.fillRect(x, y + h/4, 10, h/2);
            drawPseudoCircle(ctx, cx + 5, cy, 10, '#fff');
        }
        return;
    }
    if (pixelPattern === 'shower_stall') {
        ctx.fillStyle = 'rgba(129, 236, 236, 0.3)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h);
        return;
    }
    
    // 6. 🛋️ 座椅沙发
    if (pixelPattern === 'sofa_vip' || pixelPattern === 'boss_chair' || pixelPattern === 'sofa_pixel' || pixelPattern === 'sofa_lazy') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        if (h > w) {
            ctx.fillRect(x + w*0.2, y, w*0.8, h);
        } else {
            ctx.fillRect(x, y + h*0.2, w, h*0.8);
        }
        return;
    }

    // --- 💻 办公/科技类 ---
    if (pixelPattern === 'desk_pixel' || pixelPattern === 'desk_simple' || pixelPattern === 'desk_wood') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, w, h * 0.8);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + w - 14, y + 4, 10, h - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + w - 10, y + h/2 - 1, 2, 2);
        return;
    }
    
    if (pixelPattern === 'pc_pixel' || pixelPattern === 'console') {
        ctx.fillStyle = '#37474F';
        ctx.fillRect(x + w/2 - 6, y + h - 6, 12, 6);
        ctx.fillStyle = '#263238';
        ctx.fillRect(x, y, w, h - 6);
        const time = Date.now() % 2000;
        ctx.fillStyle = time < 1000 ? '#00BCD4' : '#0097A7';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 10);
        return;
    }

    // --- 🏙️ 城市设施 ---
    if (pixelPattern === 'vending') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x + 2, y + 2, w - 4, 6);
        ctx.fillStyle = '#81D4FA';
        ctx.fillRect(x + 4, y + 12, w * 0.6, h * 0.5);
        ctx.fillStyle = '#263238';
        ctx.fillRect(x + 4, y + h - 10, w - 8, 8);
        ctx.fillStyle = '#FF5252';
        ctx.fillRect(x + w - 10, y + 16, 4, 4);
        ctx.fillStyle = '#FFD740';
        ctx.fillRect(x + w - 10, y + 22, 4, 4);
        return;
    }

    // --- 🛍️ 商店货架 ---
    if (pixelPattern && pixelPattern.startsWith('shelf')) {
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(x, y, w, h);
        const colors = pixelPattern === 'shelf_veg' ? ['#66BB6A', '#9CCC65'] : 
                       pixelPattern === 'shelf_meat' ? ['#EF5350', '#EC407A'] : 
                       ['#FFCA28', '#42A5F5', '#AB47BC'];
        for (let r = 0; r < 3; r++) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x, y + (h/3)*r + (h/3)-2, w, 2);
            for (let c = 0; c < 4; c++) {
                ctx.fillStyle = colors[(r+c)%colors.length];
                const itemW = w/4 - 2;
                const itemH = h/3 - 6;
                ctx.fillRect(x + 1 + c * (w/4), y + 2 + r * (h/3), itemW, itemH);
            }
        }
        return;
    }
    
    // --- 🚦 交通标识 ---
    if (pixelPattern === 'zebra') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, w, h);
        return;
    }

    // --- 🎨 艺术品 ---
    if (pixelPattern === 'painting') {
        ctx.fillStyle = '#dcdde1'; 
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#f5f6fa';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        
        const seed = (x + y) % 5; 
        if (seed === 0) { 
            ctx.fillStyle = '#e84118'; ctx.fillRect(x + 4, y + 4, w/2, h/2);
            ctx.fillStyle = '#0097e6'; ctx.fillRect(x + w/2 + 2, y + h/2 + 2, w/2 - 6, h/2 - 6);
            ctx.fillStyle = '#fbc531'; ctx.fillRect(x + w - 10, y + 4, 6, 6);
        } else if (seed === 1) { 
            ctx.fillStyle = '#4cd137'; ctx.fillRect(x + 4, y + h/2, w - 8, h/2 - 4); 
            ctx.fillStyle = '#00a8ff'; ctx.fillRect(x + 4, y + 4, w - 8, h/2); 
            drawPseudoCircle(ctx, x + w - 10, y + 10, 4, '#fbc531'); 
        } else { 
            drawPseudoCircle(ctx, x + w/2, y + h/2, w/4, color);
            ctx.strokeStyle = '#2f3640'; ctx.lineWidth = 1; 
            ctx.strokeRect(x + w/2 - w/4, y + h/2 - w/4, w/2, w/2);
        }
        return;
    }

    if (pixelPattern === 'statue') {
        ctx.fillStyle = '#7f8fa6';
        ctx.fillRect(x + 4, y + h - 10, w - 8, 10);
        ctx.fillStyle = '#f5f6fa'; 
        ctx.fillRect(x + w/2 - 6, y + 10, 12, h - 20);
        drawPseudoCircle(ctx, x + w/2, y + 10, 8, '#f5f6fa');
        
        ctx.fillStyle = '#dcdde1';
        ctx.fillRect(x + w/2 - 12, y + 20, 6, 20);
        ctx.fillRect(x + w/2 + 6, y + 25, 6, 15);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + w/2 + 2, y + 10, 4, h - 20);
        return;
    }

    // 💎 展示柜
    if (pixelPattern === 'display_case') {
        ctx.fillStyle = 'rgba(129, 236, 236, 0.3)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(x, y + h - 10, w, 10);
        
        ctx.fillStyle = color; 
        if (f.label.includes('钻石')) {
             ctx.beginPath(); ctx.moveTo(x+w/2, y+h/2-5); ctx.lineTo(x+w/2+5, y+h/2); ctx.lineTo(x+w/2, y+h/2+5); ctx.lineTo(x+w/2-5, y+h/2); ctx.fill();
        } else {
             ctx.fillRect(x + w/2 - 4, y + h/2 + 5, 8, 8);
        }
        return;
    }

    // --- 8. 通用兜底 ---
    if (f.shape === 'circle') {
        drawPseudoCircle(ctx, cx, cy, w/2, color);
        return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, y, 4, h);
    
    if (f.label) {
        if (f.label.includes('电脑')) {
            ctx.fillStyle = '#81ecec'; ctx.fillRect(cx-6, cy-6, 12, 10);
        } else if (f.label.includes('书')) {
            ctx.fillStyle = '#a29bfe'; 
            if (w > h) for(let i=4; i<w-4; i+=6) ctx.fillRect(x+i, y+4, 4, h-8);
            else for(let i=4; i<h-4; i+=6) ctx.fillRect(x+4, y+i, w-8, 4);
        }
    }
};

// ==========================================
// Part B: Pixi Graphics 绘制逻辑 (新迁移内容)
// ==========================================

export const drawPixiFurniture = (g: Graphics, w: number, h: number, f: any) => {
    const color = f.color || '#cccccc';
    const pattern = f.pixelPattern || '';
    const cx = w / 2;
    const cy = h / 2;

    // 辅助：Pixi 绘图简写
    const rect = (x: number, y: number, w: number, h: number, c: ColorSource) => g.rect(x, y, w, h).fill(c);
    const circle = (cx: number, cy: number, r: number, c: ColorSource) => g.circle(cx, cy, r).fill(c);

    // --- 🌳 自然景观 ---
    if (pattern === 'tree_pixel') {
        const trunkW = w * 0.3;
        rect((w - trunkW) / 2, h * 0.6, trunkW, h * 0.4, '#6D4C41');
        circle(cx, cy - 5, w/2, color);
        circle(cx - 8, cy + 5, w/3, color);
        circle(cx + 8, cy + 5, w/3, color);
        rect(cx - 10, cy - 10, 4, 4, '#ff7675');
        rect(cx + 5, cy, 4, 4, '#ff7675');
        return;
    }
    if (pattern === 'bush') {
        rect(0, h * 0.2, w, h * 0.8, '#2E7D32');
        rect(4, 0, w - 8, h * 0.4, '#4CAF50');
        rect(6, 10, 4, 4, '#FF5252');
        rect(w - 10, 15, 4, 4, '#FF5252');
        return;
    }
    if (pattern === 'flower_rose') {
        circle(cx, cy, w/2, '#27ae60');
        circle(cx - 5, cy - 5, 4, '#d63031');
        circle(cx + 5, cy + 5, 4, '#d63031');
        circle(cx + 5, cy - 5, 4, '#d63031');
        circle(cx - 5, cy + 5, 4, '#d63031');
        return;
    }

    // --- 🎹 乐器 ---
    if (pattern === 'piano') {
        rect(0, 0, w, h, '#1e1e1e');
        if (h > w) { // 竖向
            rect(w * 0.6, 2, w * 0.35, h - 4, '#ffffff'); 
        } else { // 横向
            rect(0, h * 0.4, w, h * 0.2, '#3d3d3d');
            rect(2, h * 0.6, w - 4, h * 0.35, '#ffffff'); 
            for (let i = 10; i < w - 10; i += 12) {
                if (i % 24 !== 0) rect(i, h * 0.6, 6, h * 0.2, '#000000');
            }
        }
        return;
    }

    // --- 🏡 居家 ---
    if (pattern && pattern.startsWith('bed')) {
        rect(0, 0, w, 8, '#5D4037'); // 床头
        rect(2, 8, w - 4, h - 8, color); // 床身
        rect(2, 30, w - 4, h - 32, 'rgba(255,255,255,0.8)'); // 被子
        rect(6, 12, w / 2 - 10, 12, '#FFFFFF'); // 枕头
        if (pattern === 'bed_king') rect(w / 2 + 4, 12, w / 2 - 10, 12, '#FFFFFF');
        return;
    }
    
    if (pattern === 'kitchen' || pattern === 'fridge') {
        rect(0, 0, w, h, color);
        if (pattern === 'kitchen') {
            if (h > w) {
                rect(w - 4, 0, 2, h, 'rgba(0,0,0,0.1)');
                if (f.tags?.includes('stove')) {
                    circle(cx, h/6, 6, '#2d3436');
                    circle(cx, h/2, 6, '#2d3436');
                }
            } else {
                rect(0, 4, w, 2, 'rgba(0,0,0,0.1)');
                if (f.tags?.includes('stove')) {
                    circle(w/6, cy, 6, '#2d3436');
                    circle(w/2, cy, 6, '#2d3436');
                }
            }
        } else {
            if (h > w) rect(0, h/3, w, 2, 'rgba(0,0,0,0.1)');
            else rect(w/3, 0, 2, h, 'rgba(0,0,0,0.1)');
        }
        return;
    }

    if (pattern === 'toilet') {
        if (h > w) { rect(w/4, 0, w/2, 10, '#fff'); circle(cx, cy + 5, 10, '#fff'); }
        else { rect(0, h/4, 10, h/2, '#fff'); circle(cx + 5, cy, 10, '#fff'); }
        return;
    }

    if (pattern === 'shower_stall') {
        rect(0, 0, w, h, 'rgba(129, 236, 236, 0.3)');
        g.rect(0, 0, w, h).stroke({ width: 2, color: '#fff' });
        return;
    }

    if (pattern?.includes('sofa') || f.utility === 'comfort') {
        rect(0, 0, w, h, color);
        if (h > w) {
            rect(w*0.2, 0, w*0.8, h, 'rgba(0,0,0,0.1)');
        } else {
            rect(0, h*0.2, w, h*0.8, 'rgba(0,0,0,0.1)');
        }
        return;
    }

    // --- 💻 办公 ---
    if (pattern?.includes('desk') || pattern?.includes('table')) {
        rect(0, 0, w, h, color);
        rect(0, 0, w, h * 0.8, 'rgba(255,255,255,0.1)');
        rect(w - 14, 4, 10, h - 8, 'rgba(0,0,0,0.15)');
        return;
    }
    if (pattern === 'pc_pixel' || f.tags?.includes('computer')) {
        rect(w/2 - 6, h - 6, 12, 6, '#37474F');
        rect(0, 0, w, h - 6, '#263238');
        rect(2, 2, w - 4, h - 10, '#00BCD4');
        return;
    }

    // --- 🛍️ 商业 ---
    if (pattern === 'vending') {
        rect(0, 0, w, h, color);
        rect(2, 2, w-4, 6, 'rgba(255,255,255,0.4)');
        rect(4, 12, w*0.6, h*0.5, '#81D4FA');
        rect(4, h-10, w-8, 8, '#263238');
        rect(w-10, 16, 4, 4, '#FF5252');
        rect(w-10, 22, 4, 4, '#FFD740');
        return;
    }

    if (pattern && pattern.startsWith('shelf')) {
        rect(0, 0, w, h, '#E0E0E0');
        const colors = pattern === 'shelf_veg' ? ['#66BB6A', '#9CCC65'] : 
                       pattern === 'shelf_meat' ? ['#EF5350', '#EC407A'] : 
                       ['#FFCA28', '#42A5F5', '#AB47BC'];
        for (let r = 0; r < 3; r++) {
            rect(0, (h/3)*r + (h/3)-2, w, 2, 'rgba(0,0,0,0.15)');
            for (let c = 0; c < 4; c++) {
                rect(1 + c * (w/4), 2 + r * (h/3), w/4 - 2, h/3 - 6, colors[(r+c)%colors.length]);
            }
        }
        return;
    }

    // --- 🏃 健身 ---
    if (pattern === 'treadmill') {
        rect(0, 0, w, h, '#2d3436');
        rect(4, 4, w - 8, h - 8, '#636e72');
        if (h > w) {
            for(let i=4; i<h-4; i+=10) rect(4, i, w-8, 2, '#000000');
            rect(0, 0, w, 20, '#dfe6e9');
        } else {
            for(let i=4; i<w-4; i+=10) rect(i, 4, 2, h-8, '#000000');
            rect(0, 0, 20, h, '#dfe6e9');
        }
        return;
    }
    if (pattern === 'weights_rack') {
        rect(0, 0, w, h, '#2d3436');
        if (h > w) {
            rect(0, 20, w, 6, '#b2bec3'); 
            circle(0, 23, 8, '#000'); 
            circle(w, 23, 8, '#000');
        } else {
            rect(20, 0, 6, h, '#b2bec3');
            circle(23, 0, 8, '#000');
            circle(23, h, 8, '#000');
        }
        return;
    }
    if (pattern === 'yoga_mat') {
        rect(0, 0, w, h, color);
        rect(2, 2, w - 4, h - 4, 'rgba(255,255,255,0.2)');
        return;
    }

    // --- 🎨 艺术与技能 ---
    if (pattern === 'easel') {
        if (h > w) {
            g.moveTo(cx, 0).lineTo(0, h).stroke({width:3, color:'#8b4513'});
            g.moveTo(cx, 0).lineTo(w, h).stroke({width:3, color:'#8b4513'});
            g.moveTo(cx, 0).lineTo(cx, h).stroke({width:3, color:'#8b4513'});
        } else {
            g.moveTo(0, cy).lineTo(w, 0).stroke({width:3, color:'#8b4513'});
            g.moveTo(0, cy).lineTo(w, h).stroke({width:3, color:'#8b4513'});
        }
        rect(w*0.1, h*0.2, w*0.8, h*0.6, '#fff');
        circle(cx, cy, 6, color);
        return;
    }
    
    if (pattern === 'chess_table') {
        rect(4, 4, w-8, h-8, '#8b4513');
        rect(0, 0, w, h, '#dcdde1');
        const cellSize = Math.min(w, h) / 4;
        for(let r=0; r<4; r++) {
            for(let c=0; c<4; c++) {
                if ((r+c)%2===1) rect(c*cellSize + (w-cellSize*4)/2, r*cellSize + (h-cellSize*4)/2, cellSize, cellSize, '#2f3542');
            }
        }
        return;
    }

    // --- 🏥 医疗与科技 ---
    if (pattern === 'medical_bed') {
        rect(0, 0, w, h, '#dfe6e9');
        if (h > w) rect(0, 0, w, 15, '#74b9ff');
        else rect(0, 0, 15, h, '#74b9ff');
        
        const cs = 12;
        rect(cx - cs/2, cy - 4, cs, 8, '#ff7675');
        rect(cx - 4, cy - cs/2, 8, cs, '#ff7675');
        return;
    }
    if (pattern === 'scanner') {
        const minDim = Math.min(w,h);
        circle(cx, cy, minDim/2, '#b2bec3');
        circle(cx, cy, minDim/3, '#2d3436');
        if (h > w) rect(10, cy, w - 20, h/2, '#74b9ff');
        else rect(cx, 10, w/2, h - 20, '#74b9ff');
        return;
    }
    if (pattern === 'server') {
        rect(0, 0, w, h, '#1e1e1e');
        rect(4, 4, w - 8, h - 8, '#2d3436');
        if (h > w) {
            for (let i = 5; i < h - 5; i += 8) rect(w - 8, i, 4, 4, '#00b894');
        } else {
            for (let i = 5; i < w - 5; i += 8) rect(i, h - 8, 4, 4, '#00b894');
        }
        return;
    }

    // --- 🚦 交通标识 ---
    if (pattern === 'zebra') {
        rect(0, 0, w, h, '#FFFFFF');
        return;
    }
    
    // --- 🎨 艺术品 ---
    if (pattern === 'painting') {
         rect(0, 0, w, h, '#dcdde1');
         rect(2, 2, w - 4, h - 4, '#f5f6fa');
         circle(cx, cy, w/4, color);
         return;
    }
    
    if (pattern === 'statue') {
        rect(4, h - 10, w - 8, 10, '#7f8fa6');
        rect(w/2 - 6, 10, 12, h - 20, '#f5f6fa');
        circle(w/2, 10, 8, '#f5f6fa');
        return;
    }
    
    if (pattern === 'display_case') {
         rect(0, 0, w, h, 'rgba(129, 236, 236, 0.3)');
         g.rect(0, 0, w, h).stroke({width:1, color:'rgba(255,255,255,0.5)'});
         rect(0, h-10, w, 10, '#2f3640');
         rect(w/2-4, h/2+5, 8, 8, color);
         return;
    }

    // 默认兜底
    rect(0, 0, w, h, color);
    rect(0, 0, w, 4, 'rgba(255,255,255,0.2)');
    rect(0, 0, 4, h, 'rgba(255,255,255,0.2)');
    if (f.label?.includes('书')) rect(4, 4, w-8, 4, '#a29bfe');
};