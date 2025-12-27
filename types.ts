export interface Vector2 {
  x: number;
  y: number;
}
// 高层意图，决定了一连串的行为
export enum SimIntent {
    IDLE = 'idle',               // 无所事事
    SATISFY_HUNGER = 'hunger',   // 找吃的
    SLEEP = 'sleep',             // 去睡觉
    WORK = 'work',               // 去工作
    SOCIALIZE = 'socialize',     // 去社交
    FUN = 'fun',                 // 找乐子
    WANDER = 'wander',            // 瞎逛
    SURVIVE = 'survive',        // 生存优先（如快饿死、快困死）
    FULFILL_NEED = 'fulfill_need' // 满足特定需求（如上厕所、洗澡）
}
// 队列中的单个动作单元
export interface QueuedAction {
    type: 'WALK' | 'INTERACT' | 'WAIT' | 'USE_ITEM'; // 动作类型
    targetPos?: Vector2;       // 走到哪里去
    targetId?: string;         // 对谁/对什么东西操作
    interactionKey?: string;   // 具体的交互名 (比如 "eat_sandwich")
    duration?: number;         // 持续多久 (毫秒)
    desc?: string;             // 调试用的描述，比如 "走向冰箱"
}

export enum SimAction {
    Idle = 'idle',
    Working = 'working',
    Sleeping = 'sleeping',
    Eating = 'eating',
    Talking = 'talking',
    Using = 'using',
    Moving = 'moving',
    Wandering = 'wandering',
    Commuting = 'commuting',
    CommutingSchool = 'commuting_school', // 上学通勤
    Schooling = 'schooling',              // 在校学习
    WatchingMovie = 'watching_movie',
    Phone = 'phone',
    PlayingHome = 'playing_home',
    Following = 'following',
    MovingHome = 'moving_home',
    EatingOut = 'eat_out',
    PickingUp = 'picking_up',   // 父母去接孩子
    Escorting = 'escorting',    // 父母护送/抱着孩子
    BeingEscorted = 'being_escorted', // 孩子被护送/抱着
    Waiting = 'waiting', // 原地等待状态
    NannyWork = 'nanny_work', // 🆕 保姆工作状态
    FeedBaby = 'feed_baby', // 🆕 喂食婴儿状态
    BatheBaby = 'bathe_baby',   // 大人给宝宝洗澡
    BeingBathed = 'being_bathed' // 宝宝被洗澡
}

export enum JobType {
    Unemployed = 'unemployed',
    Internet = 'internet',
    Design = 'design',
    Business = 'business',
    Store = 'store',
    Restaurant = 'restaurant',
    Library = 'library',
    School = 'school',
    Nightlife = 'nightlife',
    Hospital = 'hospital', 
    ElderCare = 'elder_care'
}

export enum NeedType {
    Hunger = 'hunger',
    Energy = 'energy',
    Fun = 'fun',
    Social = 'social',
    Bladder = 'bladder',
    Hygiene = 'hygiene',
    Comfort = 'comfort'
}

export enum AgeStage {
    Infant = 'Infant',
    Toddler = 'Toddler',
    Child = 'Child',
    Teen = 'Teen',
    Adult = 'Adult',
    MiddleAged = 'MiddleAged',
    Elder = 'Elder'
}

export interface Furniture {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;// 这里的 w, h 指的是逻辑上的占地面积（比如 48x48），而不是图片的高度
  rotation?: number; // 0: Down(Front), 1: Left, 2: Up(Back), 3: Right
  color: string;
  label: string;
  utility: string;
  tags?: string[]; 
  dir?: string;
  multiUser?: boolean;
  gender?: string;
  reserved?: string;
  cost?: number;
  tier?: string;
  imagePath?: string;
 
  tileSheet?: string;               // 图集路径
  tilePos?: { x: number; y: number }; // 图集中的格子坐标
  tileSize?: { w: number; h: number }; // 切片大小 (像素)
  
  pixelPattern?: string;
  pixelOutline?: boolean;
  pixelGlow?: boolean;
  pixelShadow?: boolean;
  glowColor?: string;
  outlineColor?: string;
  shadowColor?: string;
  shape?: 'rectangle' | 'circle' | 'ellipse' | 'l-shape' | 't-shape' | 'polygon';
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  points?: {x: number, y: number}[];
  fill?: boolean;
  borderWidth?: number;
  borderColor?: string;
  homeId?: string; 

  // ✨ [新增] 2.5D 渲染配置
  isWall?: boolean; // 标记这是墙体
  textureHeight?: number; // 图片的实际高度（例如占地48，但树高96）
  tilePosDir?: {
    [key: number]: { x: number; y: number }; // 0, 1, 2, 3 对应的图集坐标
  };
  frameDirs?:{
    [key: number]: string;
  }
  hasDirectionalSprites?: boolean;
  frameName?: string;
}

export interface HousingUnit {
    id: string;       
    name: string;     
    capacity: number; 
    cost: number;     
    type: 'public_housing' | 'apartment' | 'villa' | 'elder_care'; 
    area: { x: number, y: number, w: number, h: number }; 
    maxX?: number;
    maxY?: number;
}

export interface PlotTemplate {
    id: string;
    width: number;
    height: number;
    type: 'residential' | 'commercial' | 'public' | 'work' | string;
    rooms: any[]; 
    furniture: Furniture[];
    housingUnits?: HousingUnit[];
}

export interface WorldPlot {
    id: string;
    templateId: string;
    x: number;
    y: number;
    width?: number; 
    height?: number;
    customName?: string;  
    customColor?: string; 
    customType?: string;  
    // ✨ 新增：支持存储贴图信息
    sheetPath?: string;
    tileX?: number;
    tileY?: number;
    tileW?: number;
    tileH?: number;
}

export interface EditorState {
  mode: 'none' | 'plot' | 'furniture' | 'floor'; 
  activeTool: 'camera' | 'select';
  // [新增] 当前正在编辑的地皮 ID。
  // 如果为 null，表示在“世界编辑器”模式（只能操作地皮）；
  // 如果有值，表示在“建筑编辑器”模式（只能在该地皮内操作家具/地板）。
  activePlotId: string | null;
  selectedPlotId: string | null;
  selectedFurnitureId: string | null;
  selectedRoomId: string | null;
  
  isDragging: boolean;
  dragOffset: { x: number, y: number };
  
  placingTemplateId: string | null;
  placingFurniture: Partial<Furniture> | null;

  interactionState: 'idle' | 'carrying' | 'resizing' | 'drawing';
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null;

  drawingPlot: {
      startX: number;
      startY: number;
      currX: number;
      currY: number;
      templateId: string;
  } | null;

  drawingFloor: {
      startX: number;
      startY: number;
      currX: number;
      currY: number;
      pattern: string;
      color: string;
      label: string;
      hasWall: boolean; 
  } | null;

  previewPos: { x: number, y: number } | null;

  gridSize: number;       // 网格大小，默认 50 或 10
  showGrid: boolean;      // 是否显示网格
  isValidPlacement: boolean; // 当前预览位置是否合法（用于显示红/绿）
  snapToGrid: boolean;    // 是否开启吸附
}

export interface EditorAction {
    // 扩充操作类型
    type: 'add' | 'remove' | 'move' | 'modify' | 'resize' | 'rotate' | 
          'place_furniture' | 'delete_furniture' | 'place_plot' | 'delete_plot';
    
    // 设为可选，因为某些特定操作(如 place_furniture)可能不需要显式传这个
    entityType?: 'plot' | 'furniture' | 'room';
    
    // 设为可选
    id?: string;
    
    // 🆕 新增：用于存储操作主体数据 (如被放置的家具对象)
    data?: any; 
    
    prevData?: any; 
    newData?: any;  
}

export interface RoomDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  pixelPattern?: string;
  imagePath?: string;
  homeId?: string;
  isCustom?: boolean;
  hasWall?: boolean; 
  // ✨ 新增：同样添加这些字段
  sheetPath?: string;
  tileX?: number;
  tileY?: number;
  tileW?: number;
  tileH?: number;
}

export type Needs = {
  [key in NeedType]: number;
} & { [key: string]: number | undefined };

export interface Skills {
  cooking: number;
  athletics: number;
  music: number;
  dancing: number;
  logic: number;
  creativity: number;
  gardening: number;
  fishing: number;
  charisma: number; 
  [key: string]: number;
}

export interface Zodiac {
  name: string;
  element: string;
  icon: string;
}

export interface Relationship {
  friendship: number;
  romance: number;
  isLover: boolean;
  isSpouse: boolean; 
  hasRomance: boolean;
  isColleague?: boolean;
  kinship?: 'parent' | 'child' | 'sibling' | 'spouse' | 'none';
}

export interface Job {
  id: string;
  title: string;
  level: number;
  salary: number;
  startHour: number;
  endHour: number;
  vacationMonths?: number[]; 
  companyType?: JobType | string; 
  requiredTags?: string[]; 
}

export interface WorkLogItem {
    factor: string; // 评分因素，如 "心情极佳"
    score: number;  // 分值，如 +3
}

export interface Buff {
  id: string;
  label: string;
  type: 'good' | 'bad' | 'neutral';
  duration: number;
  source: string;
}

// 🆕 更新外观接口：改为 Body, Outfit, Hair 三层结构
export interface SimAppearance {
    body: string;   // 身体图层 (最底层)
    outfit: string; // 衣服图层 (中间层)
    hair: string;   // 头发图层 (最顶层)
    
    // 兼容旧字段 (可选)
    face?: string;
    clothes?: string;
    pants?: string;
}

export interface Memory {
    id: string;
    time: string; 
    type: 'job' | 'social' | 'life' | 'achievement' | 'bad' | 'diary' | 'family'; 
    text: string;
    relatedSimId?: string; 
}

export interface SimData {
  id: string;
  familyId: string; 
  homeId: string | null;
  workplaceId?: string; 
  
  name: string;
  surname: string; 
  pos: Vector2;
  gender: 'M' | 'F';
  height: number;         
  weight: number;         
  appearanceScore: number;
  luck: number;         
  constitution: number; 
  eq: number;           
  iq: number;           
  reputation: number;   
  morality: number;     
  creativity: number;   
  skinColor: string;
  hairColor: string;
  clothesColor: string;
  pantsColor: string; 
  appearance: SimAppearance; // 使用新的接口
  mbti: string;
  zodiac: Zodiac;
  
  traits: string[];
  familyLore?: string;

  age: number;
  ageStage: AgeStage; 
  health: number; 
  
  partnerId: string | null;
  fatherId: string | null;
  motherId: string | null;
  childrenIds: string[];

  isPregnant: boolean;
  pregnancyTimer: number; 
  partnerForBabyId: string | null; 

  lifeGoal: string;
  orientation: string;
  faithfulness: number;
  needs: Needs;
  skills: Skills;
  relationships: Record<string, Relationship>;
  
  money: number;
  dailyBudget: number;
  workPerformance: number;
  consecutiveAbsences?: number; 
  commutePreTime?: number; 
  lastPunchInTime?: number; 
  
  job: Job;
  dailyExpense: number;
  dailyIncome: number; 
  isSideHustle?: boolean;
  // [新增] 每日工作表现详情 (记录上一天/当天的具体加减分项)
  dailyWorkLog: WorkLogItem[];
  
  royalty?: { amount: number, daysLeft: number };
  hasFreshIngredients?: boolean;
  
  intendedShoppingItemId?: string;

  buffs: Buff[];
  mood: number;

  memories: Memory[];

  action: SimAction | string; 
  bubble?: { text: string | null; type: string; timer: number };
  target?: Vector2 | null;
  interactionTarget?: any;

  schoolPerformance?: number; 
  
  carryingSimId?: string | null;
  carriedBySimId?: string | null;

  isTemporary?: boolean; 

  // [新增] 存档数据结构
  currentIntent?: SimIntent; 
  actionQueue?: QueuedAction[];
}

export interface LogEntry {
  id: number;
  time: string;
  text: string;
  type: 'normal' | 'sys' | 'act' | 'chat' | 'love' | 'bad' | 'jealous' | 'rel_event' | 'money' | 'family' | 'career';
  category: 'sys' | 'chat' | 'rel' | 'life' | 'career'; 
  isAI: boolean;
  simName?: string;
}

export interface GameTime {
  totalDays: number; 
  year: number;      
  month: number;     
  hour: number;
  minute: number;
  speed: number;
}

export interface SaveMetadata {
    slot: number;
    timestamp: number;
    timeLabel: string;
    pop: number;
    realTime: string;
}