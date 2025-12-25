import { Assets, Texture, Rectangle } from 'pixi.js';

// 缓存：路径 -> HTMLImageElement (给 React UI 用)
const imageCache = new Map<string, HTMLImageElement>();

// 1. 统一加载入口
export const loadGameAssets = async (sources: string[]) => {
    // 过滤掉空字符串或无效路径
    const validSources = sources.filter(s => s && typeof s === 'string' && s.length > 0);
    if (validSources.length === 0) return;

    // A. 让 Pixi 加载 (给游戏画面用)
    await Assets.load(validSources);

    // B. 让浏览器加载 (给 UI 头像用) - 这一步至关重要
    // 我们手动创建 Image 对象并缓存下来，确保 Sidebar 能瞬间拿到图片，不再报错
    const promises = validSources.map(src => {
        return new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imageCache.set(src, img);
                resolve();
            };
            img.onerror = () => {
                // 即使失败也不要抛出错误卡死流程
                console.warn(`[AssetLoader] Failed to load UI image: ${src}`);
                imageCache.set(src, img);
                resolve(); 
            };
        });
    });

    await Promise.all(promises);
    console.log(`[AssetLoader] 资源加载完毕: Pixi & UI 双重缓存 Ready`);
};

// 2. 获取纹理 (给 PixiGameCanvas 用)
export const getTexture = (path: string | undefined): Texture => {
    if (!path) return Texture.EMPTY;
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
    w: number = 48, 
    h: number = 48
): Texture => {
    if (!path) return Texture.EMPTY;

    // 1. 优先检查缓存
    const cacheKey = `${path}_${col}_${row}_${w}_${h}`;
    if (slicedCache.has(cacheKey)) {
        return slicedCache.get(cacheKey)!;
    }

    // 2. 获取原图 BaseTexture
    // 注意：Assets.get 获取的是整个大图的 Texture
    if (!Assets.cache.has(path)) {
        console.warn(`[AssetLoader] Tileset not loaded: ${path}`);
        return Texture.EMPTY;
    }
    const baseTex = Assets.get(path);

    // 3. 计算切片坐标
    const x = col * w;
    const y = row * h;

    // 越界检查
    if (x + w > baseTex.width || y + h > baseTex.height) {
        console.warn(`[AssetLoader] Slice out of bounds: ${path} [${col},${row}]`);
        return Texture.EMPTY;
    }

    // 4. 创建切片 (Frame)
    // 使用 Pixi 的 Texture 构造函数创建引用原图的新纹理
    const rect = new Rectangle(x, y, w, h);
    
    // 兼容 Pixi v7/v8: 使用 baseTex.source (v8) 或 baseTex.baseTexture (v7)
    const source = baseTex.source || baseTex.baseTexture; 
    const slicedTex = new Texture({ source: source, frame: rect });

    // 5. 存入缓存并返回
    slicedCache.set(cacheKey, slicedTex);
    return slicedTex;
};