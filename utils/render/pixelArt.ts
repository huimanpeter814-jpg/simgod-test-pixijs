import { SimData, AgeStage } from '../../types';
import { getAsset } from '../assetLoader';

// 2. 绘制头像 (支持分层：Body -> Outfit -> Hair)
// UI 使用，直接操作 CanvasContext2D
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
    const drawLayer = (img: HTMLImageElement | null) => {
        if (img) {
            ctx.imageSmoothingEnabled = false; // 保持像素清晰
            // 参数详解: 图片, 裁剪X, 裁剪Y, 裁剪宽, 裁剪高, 绘制X, 绘制Y, 绘制宽, 绘制高
            ctx.drawImage(img, srcX, srcY, srcS, srcS, destX, destY, destSize, destSize);
        }
    };

    if (renderLayer === 'all' || renderLayer === 'back') {
        drawLayer(bodyImg);
    }
    
    if (renderLayer === 'all' || renderLayer === 'front') {
        drawLayer(outfitImg);
        drawLayer(hairImg);
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

// 3. 绘制像素家具/物体 (保持不变，家具还是用像素绘制或单张图片)
export const drawPixelProp = (ctx: CanvasRenderingContext2D, f: any, p: any) => {
    const rotation = f.rotation || 0;
    
    if (rotation === 0) {
        drawInternal(ctx, f.x, f.y, f.w, f.h, f, p);
    } else {
        const cx = f.x + f.w / 2;
        const cy = f.y + f.h / 2;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rotation * 90 * Math.PI) / 180);
        
        const isRotated90 = rotation % 2 !== 0;
        const localW = isRotated90 ? f.h : f.w;
        const localH = isRotated90 ? f.w : f.h;
        
        drawInternal(ctx, -localW/2, -localH/2, localW, localH, { ...f, x: -localW/2, y: -localH/2 }, p);
        
        ctx.restore();
    }
};

// 内部绘制函数 (此处省略很长的家具绘制代码，保持原样即可)
// 为了文件简洁，这里只保留函数签名，实际文件中请保留原有的 furniture 绘制逻辑
// 如果你上传的文件里已经包含了 drawInternal 的完整代码，我会完整输出它。
// 由于篇幅限制，这里假设 drawInternal 逻辑不变。
const drawInternal = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: any, p: any) => {
    // ... (保持原有的家具绘制逻辑，这里不再重复输出几百行代码，因为它不需要修改)
    // 如果需要完整文件，请告诉我，我再完整输出。
    // 为确保代码可运行，这里放一个简单的 placeholder，实际请使用原文件内容
    ctx.fillStyle = f.color;
    ctx.fillRect(x, y, w, h);
};