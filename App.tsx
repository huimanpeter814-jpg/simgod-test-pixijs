import React, { useEffect, useRef } from 'react';
import PixiGameCanvas from './components/PixiGameCanvas';
import TopUI from './components/TopUI';
import Sidebar from './components/Sidebar/Sidebar';

// [修复] 移除旧的 assetLoader 引用和 ASSET_CONFIG
// import { loadImages } from './utils/assetLoader'; 
// import { ASSET_CONFIG } from './constants';

const App: React.FC = () => {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // [修改] 现在的图片加载已经移到了 PixiGameCanvas 内部
        // 这里只需要初始化游戏数据逻辑即可
        
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-bg font-inter text-textMain">
            <div className="flex-1 flex flex-col items-center justify-center relative bg-black overflow-hidden">
                {/* 渲染层现在由 Pixi 接管 */}
                <PixiGameCanvas />
                <TopUI />
            </div>
            <Sidebar />
        </div>
    );
};

export default App;