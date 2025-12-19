import { Assets, Texture } from 'pixi.js';

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
    return img;
};