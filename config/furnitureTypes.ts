/**
 * 家具功能枚举 (Utility)
 * 决定了点击该家具时触发什么核心逻辑 (InteractionHandler)
 */
export enum FurnitureUtility {
    // 🧱 基础
    None = 'none',            // 纯装饰

    // 🛌 核心需求
    Energy = 'energy',        // 睡觉 (床)
    Comfort = 'comfort',      // 休息 (椅子/沙发)
    NapCrib = 'nap_crib',     // 婴儿午睡
    Toilet = 'toilet',        // 上厕所
    Shower = 'shower',        // 淋浴
    Bathtub = 'bathtub',      // 泡澡 (注意：有时数据里也用 hygiene)
    Hygiene = 'hygiene',      // 泛指卫生设施 (洗手台/浴缸)
    Sink = 'sink',            // 洗手台 (有时用于洗盘子)

    // 🍔 饮食与厨房
    Fridge = 'fridge',        // 冰箱
    Cooking = 'cooking',      // 炉灶烹饪
    Microwave = 'microwave',  // 微波炉
    Coffee = 'coffee',        // 咖啡机
    Dining = 'dining',        // 进餐点 (餐桌)
    EatCanteen = 'eat_canteen', // 吃食堂
    BuyFood = 'buy_food',     // 买小吃

    // 🛍️ 购物与商业
    Vending = 'buy_drink',    // 贩卖机 (买饮料)
    Shelf = 'buy_item',       // 商店货架 (通用商品)
    BookStore = 'buy_book',   // 书店买书
    EatOut = 'eat_out',       // 餐厅点餐
    Cashier = 'cashier',      // 收银台

    // 💼 工作与学习
    Work = 'work',            // 使用电脑/办公
    Study = 'study',          // 写作业 (小学)
    StudyHigh = 'study_high', // 自习 (中学)
    Healing = 'healing',      // 治疗 (医院病床)

    // 🎨 技能与运动
    Easel = 'paint',          // 绘画
    Instrument = 'play_instrument', // 乐器
    Exercise = 'run',         // 跑步机/健身
    Lift = 'lift',            // 举铁
    Stretch = 'stretch',      // 瑜伽/拉伸
    Chess = 'play_chess',     // 下棋
    Mirror = 'practice_speech', // 演讲练习
    Garden = 'gardening',     // 园艺
    Fishing = 'fishing',      // 钓鱼
    Dance = 'dance',          // 跳舞

    // 🎉 娱乐
    TV = 'tv',                // 看电视
    Cinema = 'cinema',        // 看电影 (前缀匹配 cinema_2d, cinema_3d)
    Game = 'play',            // 玩游戏 (游戏机) - 注意：有时也用 play_game
    Toy = 'toy',              // 玩具
    PlayBlocks = 'play_blocks', // 堆积木
    Book = 'read_book',       // 阅读 (书架) - 对应 interactionRegistry 的 'bookshelf' 或 'read_book'

    // 🧹 杂项
    Trash = 'trash',          // 垃圾桶
    Wardrobe = 'wardrobe',    // 衣柜
    Mailbox = 'mailbox',      // 信箱
}

/**
 * 家具标签枚举 (Tags)
 * 用于 AI 搜索 (DecisionLogic) 和 类型判断 (Helpers)
 */
export enum FurnitureTag {
    // 🏠 场所/区域
    LivingRoom = 'livingroom',
    Bedroom = 'bedroom',
    Kitchen = 'kitchen',
    Bathroom = 'bathroom',
    Office = 'office',
    Gym = 'gym',
    Shop = 'shop',
    Restaurant = 'restaurant',
    Park = 'park',
    School = 'school',

    // 🪑 基础类型
    Seat = 'seat',            // 所有能坐的
    Sofa = 'sofa',            // 沙发
    Bed = 'bed',              // 床
    Table = 'table',          // 桌子
    Desk = 'desk',            // 书桌/办公桌
    Chair = 'chair',          // 椅子
    Bench = 'bench',          // 长椅
    Armchair = 'armchair',    // 扶手椅

    // 🔧 设备与设施
    Computer = 'computer',    // 电脑
    TV = 'tv',                // 电视
    GameConsole = 'game',     // 游戏机
    Fridge = 'fridge',
    Stove = 'stove',
    Sink = 'sink',
    Toilet = 'toilet',
    Bathtub = 'bathtub',
    Shower = 'shower',
    Bookshelf = 'bookshelf',
    Mirror = 'mirror',
    TrashCan = 'trash_can',
    Wardrobe = 'wardrobe',
    VendingMachine = 'vending_machine', // 贩卖机 (用于搜索)
    
    // 💼 办公/商业特定
    Cashier = 'cashier',
    Shelf = 'shelf',
    Counter = 'counter',      // 柜台
    Bar = 'bar',              // 吧台
    Meeting = 'meeting',      // 会议桌
    BossChair = 'boss_chair', // 老板椅
    MedicalBed = 'medical_bed', // 病床
    Blackboard = 'blackboard', // 黑板
    DjBooth = 'dj_booth',     // DJ台

    // 🎨 技能相关
    Art = 'art',              // 艺术品
    Easel = 'easel',          // 画架
    Instrument = 'instrument',
    Piano = 'piano',
    Guitar = 'guitar',
    Treadmill = 'treadmill',  // 跑步机
    YogaMat = 'yoga_mat',     // 瑜伽垫
    
    // 📦 其他
    Food = 'food',
    Plant = 'plant',
    Light = 'light',
    Decor = 'decor',
    Wall = 'wall',
    Floor = 'floor',
    Outside = 'outside',
}