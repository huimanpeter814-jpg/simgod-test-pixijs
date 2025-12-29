/**
 * 家具功能枚举 (Utility)
 * 决定了 Sim 点击该家具时触发什么核心逻辑。
 * 对应 data/furnitureData.ts 中的 'utility' 字段。
 */
export enum FurnitureUtility {
    // ==========================================
    // 🧱 基础与被动 (Passive)
    // ==========================================
    None = 'none',            // 纯装饰 / 结构 (墙、地基、植物)
    
    // ==========================================
    // 🛌 核心生理需求 (Needs - Survival)
    // ==========================================
    // 对应 NeedsLogic 中的 Hunger, Energy, Bladder, Hygiene
    Comfort = 'comfort',      // 回复舒适度 (椅子, 沙发, 长凳)
    Energy = 'energy',        // 深度睡眠 (床)
    NapCrib = 'nap_crib',     // 婴儿睡眠 (婴儿床 - SimAction.Sleeping 变体)
    
    Toilet = 'toilet',        // 上厕所 (马桶 - 解决 Bladder)
    Shower = 'shower',        // 淋浴 (淋浴房 - 快速解决 Hygiene)
    Bathtub = 'bathtub',      // 泡澡 (浴缸 - 慢速 Hygiene + Comfort，且用于 BatheBaby)
    Sink = 'sink',            // 洗手/洗盘子 (洗手台 - 微量 Hygiene)

    // ==========================================
    // 🍔 饮食与烹饪 (Food & Kitchen)
    // ==========================================
    // 对应 InteractionSystem 中的饮食拦截逻辑
    Fridge = 'fridge',        // 冰箱 (获取食材入口)
    Cooking = 'cooking',      // 炉灶/烤箱 (SimAction.Cooking)
    Microwave = 'microwave',  // 微波炉 (快速加热 - 还没做逻辑但预留)
    Coffee = 'coffee',        // 咖啡机 (SimAction.Drinking - 回复 Energy)
    
    Dining = 'dining',        // 进餐位 (餐桌 - AI 寻找 "finding_seat" 的首选目标)

    // ==========================================
    // 🛍️ 购物与商业 (Economy & Shop)
    // ==========================================
    // 对应 InteractionSystem 中的购物拦截逻辑
    Vending = 'buy_drink',    // 自动贩卖机/摊车 (直接扣钱获得物品，无需结账)
    Shelf = 'buy_item',       // 商店货架 (SimAction.Browsing -> 拿取 -> 结账)
    Cashier = 'cashier',      // 收银台 (SimAction.Ordering / 结账点)
    EatOut = 'eat_out',       // 餐厅点餐台 (SimAction.Ordering -> 等餐)

    // ==========================================
    // 🎨 技能与成长 (Skills)
    // ==========================================
    // 对应 SkillLogic.ts 中的技能定义
    Work = 'work',            // 工作/上网 (电脑, 办公桌 - Logic 技能)
    Easel = 'paint',          // 绘画 (画架 - Creativity 技能)
    Instrument = 'play_instrument', // 乐器 (钢琴, 吉他 - Music 技能)
    Exercise = 'run',         // 运动 (跑步机, 哑铃 - Athletics 技能)
    Chess = 'chess',          // 下棋 (棋盘 - Logic 技能)
    Mirror = 'mirror',        // 照镜子/演讲 (全身镜 - Charisma 技能)
    Garden = 'garden',        // 种植箱 (植物 - Gardening 技能)
    Fishing = 'fish',         // 钓鱼点 (水域 - Fishing 技能)
    Stereo = 'dance',         // 音响 (跳舞 - Dancing 技能)
    Book = 'read',            // 阅读 (书架 - Logic/Fun)

    // ==========================================
    // 🎉 娱乐与媒体 (Fun)
    // ==========================================
    TV = 'tv',                // 看电视 (家庭 - Fun)
    Cinema = 'cinema',        // 看电影 (公共大屏 - Fun ++, Social)
    Game = 'play',            // 玩游戏 (游戏机, 电脑游戏 - Fun)
    Toy = 'toy',              // 玩具 (儿童/宠物 - Fun)

    // ==========================================
    // 🧹 家务与杂项 (Chores)
    // ==========================================
    Trash = 'trash',          // 垃圾桶 (扔盘子/垃圾)
    Wardrobe = 'wardrobe',    // 衣柜 (SimAction.ChangeOutfit)
    Mailbox = 'mailbox',      // 信箱 (付账单)
}

/**
 * 家具标签枚举 (Tags)
 * 用于 AI 寻路、对象过滤 (filter) 或特定场景判断 (hasTag)。
 * 对应 data/furnitureData.ts 中的 'tags' 字段。
 */
export enum FurnitureTag {
    // ==========================================
    // 🏠 基础分类
    // ==========================================
    Decor = 'decor',          // 装饰品
    Light = 'light',          // 灯光
    Wall = 'wall',            // 墙体相关
    Floor = 'floor',          // 地板相关
    Outside = 'outside',      // 户外设施

    // ==========================================
    // 🪑 交互表面与座位
    // ==========================================
    Seat = 'seat',            // 所有能坐的东西 (椅子, 长凳)
    Sofa = 'sofa',            // 沙发 (通常 Comfort 值更高)
    Bed = 'bed',              // 床 (用于区分普通的 Seat)
    
    Surface = 'surface',      // 泛指台面 (可放置物品)
    Desk = 'desk',            // 书桌/办公桌 (Work 偏好)
    DiningTable = 'dining_table', // 餐桌 (Eating 偏好)
    CoffeeTable = 'coffee_table', // 茶几

    // ==========================================
    // 🏫 房间/区域标识 (AI 区域判断)
    // ==========================================
    LivingRoom = 'livingroom',
    Bedroom = 'bedroom',
    Kitchen = 'kitchen',
    Bathroom = 'bathroom',
    Office = 'office',
    Gym = 'gym',
    Shop = 'shop',
    Restaurant = 'restaurant',
    Park = 'park',

    // ==========================================
    // 🔧 特定设备标识
    // ==========================================
    Computer = 'computer',    // 电脑 (Work/Fun/Logic)
    TV = 'tv',                // 电视
    GameConsole = 'game',     // 游戏机
    
    Fridge = 'fridge',        // 冰箱
    Stove = 'stove',          // 炉灶
    Sink = 'sink',            // 水槽
    Toilet = 'toilet',        // 马桶
    Bathtub = 'bathtub',      // 浴缸
    Shower = 'shower',        // 淋浴

    Bookshelf = 'bookshelf',  // 书架
    Mirror = 'mirror',        // 镜子
    TrashCan = 'trash_can',   // 垃圾桶
    Wardrobe = 'wardrobe',    // 衣柜
    
    Cashier = 'cashier',      // 收银台 (关键 Tag: OrderingState 依赖此 Tag)
    Shelf = 'shelf',          // 货架

    // ==========================================
    // 🎨 技能与物品
    // ==========================================
    Art = 'art',              // 艺术品 (Easel)
    Instrument = 'instrument',// 乐器 (Piano)
    Piano = 'piano',          // 钢琴特指
    Food = 'food',            // 食物实体
    Plant = 'plant',          // 植物
}

