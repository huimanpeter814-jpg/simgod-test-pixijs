// ==========================================
// 1. 物品标签 (ItemTag) - 用于 AI 搜索和分类
// 定义“这是什么东西”，Sim 会根据这个找东西
// ==========================================
export enum ItemTag {
    // --- 基础家具 ---
    Seat = 'seat',               // 座位 (椅子/板凳)
    Sofa = 'sofa',               // 沙发 (特殊的座位，通常舒适度更高)
    Bed = 'bed',                 // 床
    Crib = 'crib',               // 婴儿床 (对应原 utility: nap_crib)
    Table = 'table',             // 桌子 (一般指饭桌/茶几)
    Desk = 'desk',               // 书桌/办公桌
    Surface = 'surface',         // 通用台面 (柜子顶等)
    Storage = 'storage',         // 储物柜/书架
    
    // --- 功能设施 ---
    Fridge = 'fridge',           // 冰箱 (特殊的储物，有食材)
    Stove = 'stove',             // 炉灶
    KitchenSink = 'kitchen_sink',// 厨房水槽
    BathroomSink = 'bathroom_sink', // 卫浴水槽 (如果有)
    Toilet = 'toilet',           // 马桶
    Shower = 'shower',           // 淋浴/浴缸
    FoodSource = 'food_source',
    
    // --- 电子/娱乐 ---
    Computer = 'computer',       // 电脑
    TV = 'tv',                   // 电视
    GameConsole = 'game_console',// 游戏机
    Instrument = 'instrument',   // 乐器
    Easel = 'easel',             // 画架
    GymEquipment = 'gym',        // 健身器材
    
    // --- 商业/公共 ---
    ShopShelf = 'shop_shelf',    // 货架
    VendingMachine = 'vending',  // 自动贩卖机
    Cashier = 'cashier',         // 收银台
    PublicSeat = 'public_seat',  // 公共长椅
    StreetLight = 'street_light',// 路灯
    
    // --- 装饰/其他 ---
    Decoration = 'decor',        // 装饰品
    Light = 'light',             // 灯光
    Wall = 'wall',               // 墙体
    Floor = 'floor',             // 地板
    Food = 'food',               // 食物实体
    TrashCan = 'trash_can',       // 垃圾桶

    FishingSpot = 'fishing_spot', // 钓鱼点
    GardenPlant = 'garden_plant', // 园艺植物/花盆
    Medical = 'medical',          // 医疗设施
    DanceFloor = 'dance_floor',   // 舞池/跳舞毯
    Chess = 'chess',              // 如下棋
    Toy = 'toy',                  // 玩具

    General = 'general',           // 通用标签 (适用于任何物品)
    Clothes = 'clothes',           // 衣物
    Drink = 'drink',              // 饮品
    Book = 'book',                 // 书籍
  }
  
  // ==========================================
  // 2. 交互类型 (InteractionType) - 决定触发什么代码逻辑
  // 定义“能对它做什么”，替代原来的 utility
  // ==========================================
  export enum InteractionType {
    // --- 基础生理需求 ---
    Sit = 'sit',                 // 坐下 (对应原 utility: comfort)
    Sleep = 'sleep',             // 睡觉 (对应原 utility: energy, nap_crib)
    UseToilet = 'use_toilet',    // 上厕所 (对应原 utility: bladder)
    WashHands = 'wash_hands',    // 洗手 (对应原 utility: hygiene)
    Shower = 'shower',           // 洗澡 (对应原 utility: hygiene)

    NapCrib = 'nap_crib',     // 婴儿床小憩 (对应原 utility: nap_crib)
    
    // --- 饮食相关 ---
    // 注意：原 utility: fridge/cooking 被拆分为具体的行为配置
    OpenStorage = 'open_storage',// 打开储物/冰箱 (对应原 utility: fridge)
    Cook = 'cook',               // 烹饪 (对应原 utility: cooking)
    Eat = 'eat',                 // 吃饭 (对应原 utility: dining)
    WashDishes = 'wash_dishes',  // 洗碗 (对应原 utility: cleaning)
    
    // --- 工作与技能 ---
    Work = 'work',               // 工作/使用电脑 (对应原 utility: work)
    PracticeMusic = 'practice_music', // 练琴 (对应原 utility: play_instrument)
    Paint = 'paint',             // 绘画 (对应原 utility: paint)
    Exercise = 'exercise',       // 运动 (对应原 utility: run)
    AttendingWork = 'work_attend',   // 上班打卡
    AttendingSchool = 'school_attend', // 上学签到
    
    // --- 娱乐 ---
    WatchTV = 'watch',             // 观看 (对应原 utility: TV, cinema_)
    PlayGame = 'play_game',      // 玩游戏 (对应原 utility: play)
    ViewArt = 'view_art',        // 欣赏艺术 (对应原 utility: decor)
    Movie = 'movie',             // 观看电影 (对应原 utility: cinema_)
    
    // --- 商业交互 ---
    BuyItem = 'buy_item',        // 购买物品 (对应原 utility: buy_item, buy_drink)
    BuyBook = 'buy_book',      // 购买书籍 (对应原 utility: buy_book)
    BuyFood = 'buy_food',      // 购买食物/小吃 (对应原 utility: buy_food)
    OrderFood = 'order_food',    // 点餐 (对应原 utility: eat_out/ordering)
    Checkout = 'checkout',       // 结账 (对应原 utility: cashier)

    Read = 'read',               // 对应 BuyBook / Book
    Study = 'study',             // 对应 Study
    Garden = 'garden',           // 对应 Garden
    Fish = 'fish',               // 对应 Fishing
    Dance = 'dance',             // 对应 Dance
    PracticeSpeech = 'practice_speech', // 对应 PracticeSpeech
    Chess = 'chess',             // 对应 PlayChess
    UseVending = 'use_vending',  // 对应 Vending (喝饮料)
    Stretch = 'stretch',         // 对应 Stretch (瑜伽)
    Lift = 'lift',               // 对应 Lift (举铁)

  }
  
  // ==========================================
  // 3. 放置层级 (SlotType) - 决定家具放在哪里
  // 对应原来的 placementLayer
  // ==========================================
  export enum SlotType {
    Floor = 'floor',             // 放在地上 (默认)
    Surface = 'surface',         // 放在台面上 (如电脑、台灯)
    Wall = 'wall',               // 挂在墙上 (如挂画、壁灯)
    Ceiling = 'ceiling',         // 吊在天花板 (如果有吊灯)
    Rug = 'rug'                  // 地毯层 (位于 Floor 之上，家具之下)
  }
  
  // ==========================================
  // 4. 需求类型 (NeedType) - 保持与你 types.ts 一致
  // 为了完整性，这里列出引用，确保无缝衔接
  // ==========================================
  export enum NeedType {
    Hunger = 'hunger',
    Energy = 'energy',
    Fun = 'fun',
    Social = 'social',
    Bladder = 'bladder',
    Hygiene = 'hygiene',
    Comfort = 'comfort'
  }