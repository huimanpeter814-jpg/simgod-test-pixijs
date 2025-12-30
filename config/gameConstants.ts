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
   // --- 基础状态 ---
    Idle = 'idle',

    // --- 核心生理需求 (保留) ---
    Sit = 'sit',                 // 坐下/休息
    Sleep = 'sleep',             // 睡觉
    UseToilet = 'use_toilet',    // 上厕所
    Shower = 'shower',           // 洗澡
    
    // --- 饮食与烹饪 (合并) ---
    // 无论是吃零食、喝饮料还是吃大餐，都是 Eating，区别在于吃的东西
    Dining = 'dining',           
    // 无论是微波炉还是燃气灶，都是 Cooking，区别在于设备等级
    Cook = 'cook',               
    
    // --- 🌟 重构核心：通用商业交互 ---
    // 所有的购买行为（买书、买水、买门票、自动贩卖机）统统走这个
    // 区别在于家具的 inventory（商品列表）不同
    Shop = 'shop',                

    // --- 🌟 重构核心：通用娱乐/技能 ---
    // 看电视、看电影、玩电脑 -> UseEntertainment
    // 区别在于家具配置的 funRate 和 contentTags
    UseEntertainment = 'use_entertainment', 
    
    // 练琴、画画、下棋、健身 -> PracticeSkill
    // 区别在于家具配置的 skillId
    PracticeSkill = 'practice_skill',       
    
    // --- 机构交互 ---
    // 上学、上班
    AttendInstitution = 'attend_institution', 
    
    // --- 其他特殊交互 (按需保留) ---
    OpenStorage = 'open_storage',
    WashDishes = 'wash_dishes',
    Garden = 'garden',
    Fish = 'fish',
    Dance = 'dance',
    PracticeSpeech = 'practice_speech',
    NapCrib = 'nap_crib',
    PlayBlocks = 'play_blocks',

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