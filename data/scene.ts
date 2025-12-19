// ==========================================
// 🎨 像素风RPG调色板 (高饱和度、高对比度)
// ==========================================
// 基础颜色定义
const PALETTE = {
    // 基础环境色 (像素风常用色)
    ground_concrete: '#e0e4e8', 
    ground_asphalt: '#2a2f3c',  
    ground_pave: '#9ca6b4',     
    ground_grass_light: '#6cff8c',
    ground_grass_dark: '#28c75d',
    ground_water: '#5a8fff',    
    
    // 建筑色
    build_glass: '#cff2f5',     
    build_brick_red: '#ff6b6b', 
    build_brick_white: '#fff9e8', 
    
    // 功能色
    shadow_dark: '#1e222e',
    highlight_light: '#f8f9fa',
    highlight_warm: '#fff9e8',
};

// 像素风光影氛围配置 (Time of Day System)
export const PALETTES: any = {
    earlyMorning: { 
        zone1: '#f0f8ff', 
        zone2: '#e6f0fa', 
        zone3: '#dce8f5', 
        wall: '#7fa5b8', 
        bg: '#2a3240', 
        overlay: 'rgba(163, 203, 255, 0.25)', 
        furniture_shadow: 'rgba(40, 45, 60, 0.3)',
        pixel_glow: 'rgba(100, 150, 255, 0.1)' 
    },
    noon: { 
        zone1: '#ffffff', 
        zone2: '#f5f7fa', 
        zone3: '#ebf0f5', 
        wall: '#8a9ca6', 
        bg: '#2a3240', 
        overlay: 'rgba(255, 250, 240, 0.1)', 
        furniture_shadow: 'rgba(40, 45, 60, 0.25)',
        pixel_glow: 'rgba(255, 255, 200, 0.05)'
    },
    afternoon: { 
        zone1: '#fff8f0', 
        zone2: '#faf0e6', 
        zone3: '#f5e8dc', 
        wall: '#9ca6b4', 
        bg: '#2a3240', 
        overlay: 'rgba(255, 200, 150, 0.15)', 
        furniture_shadow: 'rgba(40, 45, 60, 0.25)',
        pixel_glow: 'rgba(255, 180, 100, 0.1)'
    },
    dusk: { 
        zone1: '#ffe8cc', 
        zone2: '#ffd89c', 
        zone3: '#ffb894', 
        wall: '#5a6572', 
        bg: '#2a3240',
        overlay: 'rgba(140, 100, 255, 0.3)', 
        furniture_shadow: 'rgba(35, 40, 50, 0.4)',
        pixel_glow: 'rgba(255, 100, 100, 0.2)'
    },
    night: { 
        zone1: '#303848', 
        zone2: '#2a3240', 
        zone3: '#242a35', 
        wall: '#1a1e2c', 
        bg: '#2a3240', 
        overlay: 'rgba(20, 35, 70, 0.5)', 
        furniture_shadow: 'rgba(0, 0, 0, 0.6)',
        pixel_glow: 'rgba(0, 100, 255, 0.3)'
    },
    lateNight: { 
        zone1: '#2a3240', 
        zone2: '#252a36', 
        zone3: '#202530', 
        wall: '#000010', 
        bg: '#2a3240', 
        overlay: 'rgba(0, 0, 20, 0.7)', 
        furniture_shadow: 'rgba(0, 0, 0, 0.7)',
        pixel_glow: 'rgba(50, 0, 100, 0.4)'
    }
};