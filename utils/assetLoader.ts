import { Assets, Texture, Rectangle } from 'pixi.js';

// 缓存：路径 -> HTMLImageElement (给 React UI 用)
const imageCache = new Map<string, HTMLImageElement>();

// 1. 统一加载入口
export const loadGameAssets = async (sources: string[]) => {
    // 过滤掉空字符串或无效路径
    const validSources = sources.filter(s => s && typeof s === 'string' && s.length > 0);
    if (validSources.length === 0) return;

    // 🟢 分类：区分图集 JSON 和普通图片
    const jsonSources = validSources.filter(s => s.endsWith('.json'));
    const imageSources = validSources.filter(s => !s.endsWith('.json'));

    // A. 让 Pixi 加载所有资源 (Pixi 会自动识别 JSON 图集并解析)
    await Assets.load(validSources);

    // B. 让浏览器加载 UI 用图片 (只针对普通图片，跳过 JSON)
    // 图集里的图片无法直接给 <img src> 用，除非你切分，所以 UI 部分暂时只支持单图
    const promises = imageSources.map(src => {
        return new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imageCache.set(src, img);
                resolve();
            };
            img.onerror = () => {
                // 即使失败也不要抛出错误
                console.warn(`[AssetLoader] Failed to load UI image: ${src}`);
                imageCache.set(src, img);
                resolve(); 
            };
        });
    });

    await Promise.all(promises);
    console.log(`[AssetLoader] 资源加载完毕 (包含 ${jsonSources.length} 个图集)`);
};

// 2. 获取纹理 (给 PixiGameCanvas 用)
// 现在支持传入 Frame Name (例如 "sofa.png")
export const getTexture = (path: string | undefined): Texture => {
    if (!path) return Texture.EMPTY;

    // 🟢 情况 1: 这是一个图集里的 Frame Name (例如 "chair_01.png")
    // Pixi 加载图集后，会自动把 Frame Name 注册到 Cache 中
    if (Assets.cache.has(path)) {
        return Assets.get(path);
    }
    
    // 🟢 情况 2: 这是一个完整的文件路径
    if (Assets.cache.has(path)) {
        return Assets.get(path);
    }

    return Texture.EMPTY;
};

// 3. 获取图片对象 (给 React Sidebar/Modal 用)
// [修复] 恢复了旧版的功能，现在能正确返回缓存的图片了
export const getAsset = (path: string | undefined): HTMLImageElement | null => {
    if (!path) return null;
    
    // 优先从缓存取
    if (imageCache.has(path)) {
        return imageCache.get(path)!;
    }
    
    // 如果缓存里没有（可能是动态生成的路径），尝试临时创建一个
    // 注意：这只是兜底，尽量在 loadGameAssets 里预加载所有图片
    const img = new Image();
    img.src = path;
    imageCache.set(path, img); // <--- 防止内存泄漏的关键行
    return img;
};

// [新增] 切片纹理缓存：防止每次渲染都 new Texture，造成内存浪费
// Key 格式: "路径_列_行_宽_高"
const slicedCache = new Map<string, Texture>();

/**
 * 获取图集中的特定切片 (Sprite Sheet Slicer)
 * @param path 图集文件的路径 (例如: '/src/assets/tilesets/furniture_bed.png')
 * @param col 列号 (X轴方向第几格，从0开始)
 * @param row 行号 (Y轴方向第几格，从0开始)
 * @param w 切片宽度 (默认 48)
 * @param h 切片高度 (默认 48)
 */
export const getSlicedTexture = (
    path: string | undefined, 
    col: number, 
    row: number, 
    w: number, 
    h: number,
    gridBase: number = 48
): Texture => {
    if (!path) return Texture.EMPTY;

    // key 加上 gridBase 防止冲突
    const cacheKey = `${path}_${col}_${row}_${w}_${h}_${gridBase}`;
    if (slicedCache.has(cacheKey)) return slicedCache.get(cacheKey)!;

    if (!Assets.cache.has(path)) return Texture.EMPTY;
    const baseTex = Assets.get(path);

    // ✨ 核心修改：位置 = 索引 * 基础步长
    const x = col * gridBase;
    const y = row * gridBase;

    // 越界检查
    if (x + w > baseTex.width || y + h > baseTex.height) {
        console.warn(`[AssetLoader] Slice out of bounds: ${path}`);
        return Texture.EMPTY;
    }

    const rect = new Rectangle(x, y, w, h);
    const source = baseTex.source || baseTex.baseTexture;
    const slicedTex = new Texture({ source, frame: rect });

    slicedCache.set(cacheKey, slicedTex);
    return slicedTex;
};