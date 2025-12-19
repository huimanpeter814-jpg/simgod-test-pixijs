import React, { useState } from 'react';

// Define the structure for help content
interface HelpSection {
    id: string;
    title: string;
    icon: string;
    content: React.ReactNode;
}

const HELP_CONTENT: HelpSection[] = [
    {
        id: 'controls',
        title: '操作说明',
        icon: '🎮',
        content: (
            <div className="space-y-6">
                <section>
                    <h3 className="text-warning font-bold mb-3 border-b border-white/10 pb-1">基础操作</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white/5 p-3 rounded flex items-center justify-between">
                            <span className="text-gray-300 text-xs">移动视角</span>
                            <span className="text-white text-xs font-bold bg-white/10 px-2 py-1 rounded">按下空格并按住左键拖拽</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded flex items-center justify-between">
                            <span className="text-gray-300 text-xs">缩放画面</span>
                            <span className="text-white text-xs font-bold bg-white/10 px-2 py-1 rounded">鼠标滚轮</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded flex items-center justify-between">
                            <span className="text-gray-300 text-xs">选择市民/查看详情</span>
                            <span className="text-white text-xs font-bold bg-white/10 px-2 py-1 rounded">点击市民 / 点击左侧头像</span>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-accent font-bold mb-3 border-b border-white/10 pb-1">界面功能</h3>
                    <ul className="space-y-2 text-xs text-gray-300">
                        <li className="flex gap-2">
                            <span className="text-white font-bold">顶部栏:</span> 
                            控制时间流逝速度 (暂停/播放/极速)，以及存档管理。
                        </li>
                        <li className="flex gap-2">
                            <span className="text-white font-bold">左侧栏:</span> 
                            市民列表 (Roster)，显示所有居民的简要状态。
                        </li>
                        <li className="flex gap-2">
                            <span className="text-white font-bold">右侧栏:</span> 
                            详细信息面板 (Inspector)，显示选中市民的属性、需求、人际关系和记忆。
                        </li>
                        <li className="flex gap-2">
                            <span className="text-white font-bold">底部日志:</span> 
                            显示游戏中发生的重要事件和对话。
                        </li>
                    </ul>
                </section>
            </div>
        )
    },
    {
        id: 'sims',
        title: '市民生态',
        icon: '🧬',
        content: (
            <div className="space-y-6">
                <div className="text-sm text-gray-400 italic">
                    每个市民都是独立的个体，由复杂的AI逻辑驱动，拥有独特的性格、基因和人生轨迹。
                </div>

                <section>
                    <h3 className="text-blue-400 font-bold mb-2">基本需求 (Needs)</h3>
                    <p className="text-xs text-gray-400 mb-2">市民会自动寻找物品来满足以下需求，需求过低会导致心情变差甚至生病。</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/30 p-2 rounded border border-white/5"><span className="text-orange-400">🍖 饥饿</span>: 需要进食</div>
                        <div className="bg-black/30 p-2 rounded border border-white/5"><span className="text-purple-400">💤 精力</span>: 需要睡觉或小憩</div>
                        <div className="bg-black/30 p-2 rounded border border-white/5"><span className="text-yellow-400">🎮 娱乐</span>: 需要玩耍、看电影等</div>
                        <div className="bg-black/30 p-2 rounded border border-white/5"><span className="text-green-400">💬 社交</span>: 需要与人交流</div>
                    </div>
                </section>

                <section>
                    <h3 className="text-pink-400 font-bold mb-2">人生阶段 & 基因</h3>
                    <ul className="list-disc list-inside text-xs space-y-1 text-gray-300">
                        <li>市民会经历 <span className="text-white">婴儿 - 幼儿 - 儿童 - 青少年 - 成年 - 中年 - 老年</span> 的完整一生。</li>
                        <li><strong>基因遗传:</strong> 孩子的长相（肤色、发色）和属性（智商、体质等）会遗传自父母，并伴有一定变异。</li>
                        <li><strong>性格 (MBTI):</strong> 决定了社交偏好、生活习惯和职业相性。</li>
                    </ul>
                </section>
            </div>
        )
    },
    {
        id: 'career',
        title: '职业与经济',
        icon: '💼',
        content: (
            <div className="space-y-5">
                <section>
                    <h3 className="text-warning font-bold mb-2">经济系统</h3>
                    <p className="text-xs text-gray-300 leading-relaxed">
                        市民通过工作赚钱，用于支付房租、购买食物和娱乐消费。
                        如果没钱，他们会陷入焦虑 (Broke)，只能去蹭免费的公园长椅或救济粮。
                        富裕的市民会搬进别墅，购买奢侈品。
                    </p>
                </section>

                <section>
                    <h3 className="text-success font-bold mb-2">职业生涯</h3>
                    <p className="text-xs text-gray-400 mb-2">成年市民会自动求职。表现优异（技能高、心情好）会获得<strong>升职加薪</strong>。</p>
                    <div className="space-y-2">
                        <div className="bg-white/5 p-2 rounded text-xs">
                            <div className="font-bold text-blue-300">💻 互联网行业</div>
                            <div className="text-gray-500">偏好高智商(IQ)、高逻辑技能。高薪但容易脱发。</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded text-xs">
                            <div className="font-bold text-pink-300">🎨 设计行业</div>
                            <div className="text-gray-500">偏好高创造力、高审美。需要灵感(Buff)。</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded text-xs">
                            <div className="font-bold text-yellow-300">🤝 商业/金融</div>
                            <div className="text-gray-500">偏好高情商(EQ)、高魅力。竞争激烈。</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded text-xs">
                            <div className="font-bold text-green-300">🏫 教育/服务</div>
                            <div className="text-gray-500">稳定的铁饭碗，寒暑假福利。</div>
                        </div>
                    </div>
                </section>
            </div>
        )
    },
    {
        id: 'social',
        title: '社交与家庭',
        icon: '❤️',
        content: (
            <div className="space-y-5">
                <section>
                    <h3 className="text-love font-bold mb-2">人际关系</h3>
                    <p className="text-xs text-gray-300 mb-2">
                        市民之间的关系是动态变化的。他们会根据性格契合度、共同话题和颜值相互吸引或排斥。
                    </p>
                    <div className="flex gap-2 text-[10px] flex-wrap">
                        <span className="px-2 py-1 rounded bg-gray-700 text-gray-300 border border-gray-600">陌生人</span>
                        <span className="px-2 py-1 rounded bg-green-900 text-green-300 border border-green-700">朋友</span>
                        <span className="px-2 py-1 rounded bg-pink-900 text-pink-300 border border-pink-700">恋人</span>
                        <span className="px-2 py-1 rounded bg-red-900 text-red-300 border border-red-700">死对头</span>
                    </div>
                </section>

                <section>
                    <h3 className="text-purple-400 font-bold mb-2">家庭周期</h3>
                    <ul className="list-disc list-inside text-xs space-y-2 text-gray-300">
                        <li><strong>恋爱与结婚:</strong> 互有好感的市民会表白、约会，最终求婚并组建家庭。</li>
                        <li><strong>繁衍:</strong> 夫妻可能决定要孩子。怀孕周期结束后，新生命诞生，继承家族姓氏。</li>
                        <li><strong>出轨与离婚:</strong> 如果性格不合或受到诱惑，关系可能破裂。忠诚度低的市民更容易出轨。</li>
                        <li><strong>遗产:</strong> 市民去世后，财产将由配偶或子女继承。无继承人则充公。</li>
                    </ul>
                </section>
            </div>
        )
    },
    {
        id: 'building',
        title: '建筑模式',
        icon: '🏗️',
        content: (
            <div className="space-y-5">
                <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 p-3 rounded border border-white/10">
                    <h4 className="text-sm font-bold text-white mb-1">开启上帝之手</h4>
                    <p className="text-xs text-gray-300">
                        建筑模式允许你重新规划城市布局，摆放家具，甚至创造全新的地块。
                    </p>
                </div>

                <section>
                    <h3 className="text-blue-400 font-bold mb-2">编辑器功能</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white/5 p-2 rounded">
                            <div className="font-bold text-white mb-1">🗺️ 地皮模式 (Plot)</div>
                            <div className="text-gray-400">放置大型建筑区域（如住宅、商场、公园）。地皮会自动生成配套的基础家具。</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded">
                            <div className="font-bold text-white mb-1">🪑 家具模式 (Furniture)</div>
                            <div className="text-gray-400">放置具体的物品（如长椅、售货机、装饰品）。可自由摆放在任何位置。</div>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-green-400 font-bold mb-2">操作指南</h3>
                    <ul className="space-y-2 text-xs text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="bg-white/10 text-white px-1.5 rounded font-mono">放置</span>
                            <span>点击左侧面板的模板，然后在地图上点击任意位置生成。</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-white/10 text-white px-1.5 rounded font-mono">移动</span>
                            <span>直接拖拽地图上的建筑或家具即可调整位置。</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-white/10 text-white px-1.5 rounded font-mono">删除</span>
                            <span>选中物体后，点击面板上的“移除选中项”按钮。</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-white/10 text-white px-1.5 rounded font-mono">保存</span>
                            <span>点击“应用”即会保存当前更改并回到生活模式 </span>
                        </li>
                    </ul>
                </section>
            </div>
        )
    }
];

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTabId, setActiveTabId] = useState('controls');

    const activeContent = HELP_CONTENT.find(s => s.id === activeTabId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-full max-w-3xl h-[600px] bg-[#1e222e] border border-white/20 rounded-xl shadow-2xl flex overflow-hidden">
                
                {/* Sidebar Navigation */}
                <div className="w-48 bg-black/20 border-r border-white/10 flex flex-col">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-pixel text-warning">SimGod</h2>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">WIKI & HELP</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto py-2">
                        {HELP_CONTENT.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveTabId(section.id)}
                                className={`
                                    w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-xs font-bold
                                    ${activeTabId === section.id 
                                        ? 'bg-white/10 text-white border-l-2 border-accent' 
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-l-2 border-transparent'}
                                `}
                            >
                                <span className="text-base">{section.icon}</span>
                                <span>{section.title}</span>
                            </button>
                        ))}
                    </div>

                    <div className="p-4 border-t border-white/10 text-center">
                        <p className="text-[10px] text-gray-600">SimGod v9.6</p>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#121212]/50 relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {activeContent && (
                            <div className="animate-[fadeIn_0.3s_ease-out]">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-4xl">{activeContent.icon}</span>
                                    <h2 className="text-2xl font-bold text-white">{activeContent.title}</h2>
                                </div>
                                <div className="bg-white/5 rounded-xl p-6 border border-white/5">
                                    {activeContent.content}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HelpModal;