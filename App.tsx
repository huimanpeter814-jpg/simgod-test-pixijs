import React, { useEffect, useRef } from 'react';
import PixiGameCanvas from './components/PixiGameCanvas';
import TopUI from './components/TopUI';
import Sidebar from './components/Sidebar/Sidebar';
import { GameStore } from './utils/GameStore'; 

const App: React.FC = () => {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        GameStore.boot();
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-bg font-inter text-textMain">
            {/* 容器设置为 relative，以便子元素 absolute 定位生效 */}
            <div className="flex-1 flex flex-col relative bg-black overflow-hidden isolate">
                
                {/* 1. 游戏渲染层 (z-0) */}
                <div className="absolute inset-0 z-0">
                    <PixiGameCanvas />
                </div>

                {/* 2. 顶部 UI 层 (z-50) 
                    pointer-events-none 允许点击穿透空白区域
                    TopUI 内部的按钮需要有 pointer-events-auto 才能被点击 (通常组件自带)
                */}
                <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between">
                     {/* 给 TopUI 包裹一层，确保它在最上层 */}
                     <div className="pointer-events-auto w-full">
                        <TopUI />
                     </div>
                </div>

            </div>
            
            {/* 侧边栏 (z-40) */}
            <Sidebar />
        </div>
    );
};

export default App;