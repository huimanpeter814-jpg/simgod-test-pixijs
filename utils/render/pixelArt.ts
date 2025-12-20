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

    // 计算绘制尺寸 (保持素材比例)
    // 假设 size 是半径，直径是 size * 2
    const targetSize = size * 2.5; 
    const offset = targetSize / 2;

    // 绘制顺序：Body -> Outfit -> Hair
    // 注意：素材是 48x48 的全身图，我们可能只想在头像框里显示头部
    // 假设头部在素材的上方中间区域
    // 我们可以通过 drawImage 的 source 参数裁剪，或者直接画整个并缩放
    
    // 这里简单处理：画整个图，缩放到合适大小
    
    if (bodyImg) {
        ctx.drawImage(bodyImg, x - offset, y - offset, targetSize, targetSize);
    }
    
    if (outfitImg) {
        ctx.drawImage(outfitImg, x - offset, y - offset, targetSize, targetSize);
    }
    
    if (hairImg) {
        ctx.drawImage(hairImg, x - offset, y - offset, targetSize, targetSize);
    }

    // 如果没有素材 (比如旧存档或者加载失败)，绘制一个兜底的色块
    if (!bodyImg && !outfitImg && !hairImg) {
        ctx.fillStyle = sim.skinColor || '#cccccc';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillText("?", x - 3, y + 3);
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