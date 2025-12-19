// services/geminiService.ts

// 硅基流动 API 配置
const SILICON_FLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen3-8B"; 

export const callGemini = async (prompt: string, systemInstruction: string = ""): Promise<string | null> => {
    const apiKey = import.meta.env.VITE_API_KEY;
    
    if (!apiKey) {
        console.error("❌ 致命错误: .env.local 中未找到 API Key");
        return null;
    }

    const messages: { role: string; content: string }[] = [];
    
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const payload = {
        model: MODEL_ID, 
        messages: messages,
        temperature: 0.6, // 稍微降低一点温度，让它更专注执行指令
        stream: false,
        max_tokens: 8192 // [修改] 增加 Token 上限，防止 R1 思考太长导致正文被截断
    };

    try {
        const response = await fetch(SILICON_FLOW_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error [${response.status}]:`, errorText);
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;

    } catch (error) {
        console.error("❌ Network Error:", error);
        return null;
    }
};

export const batchGenerateDiaries = async (simsData: any[], globalContext: string = ""): Promise<Record<string, string>> => {
    // [修改] 增强 Prompt，反复强调“所有市民”
    const systemPrompt = `
    你是一个像素风模拟游戏《SimGod》的叙事助手。
    你将收到一个包含 ${simsData.length} 位市民数据的列表。
    你的任务是：**为列表中的【每一位】市民**写一句第一人称的“微博/推特”风短的每月总结。

    请严格参考数据：
    - **Events (经历)**: 如果有具体事件，必须提及。
    - **Buffs (状态)**: 这是最重要的心情指标！
    - **LifeGoal (目标)**: 如果这个月没事发生，可以感慨一下梦想。
    - **MBTI (性格)**
    - **Global Context**: ${globalContext} (如果是节日，请尽量关联)。
    - 也可以是和经历、工作、目标完全无关但是符合性格的一些类似个性签名的话语。

    ❌ 严禁事项：
    1. 不要只写一个人的！必须处理完列表里所有人！
    2. 不要 Markdown 格式，只返回纯 JSON。
    3. 不要解释，不要多余的废话。每个人30字以内。

    ✅ 输出格式（纯JSON）：
    {
        "ID_1": "每月总结...",
        "ID_2": "每月总结...",
        ...
        "ID_N": "每月总结..."
    }
    `;

    // [修改] 在用户输入里也再次提醒
    const userPrompt = `请为以下 ${simsData.length} 位市民生成每月总结：\n${JSON.stringify(simsData)}`;

    let responseText = await callGemini(userPrompt, systemPrompt);

    if (!responseText) return {};

    // 清洗 DeepSeek R1 的思考标签
    responseText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    try {
        // 尝试提取 JSON 部分
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        const startIdx = cleanJson.indexOf('{');
        const endIdx = cleanJson.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1) {
            const finalJsonStr = cleanJson.substring(startIdx, endIdx + 1);
            return JSON.parse(finalJsonStr);
        }
        
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("AI 日记解析失败:", e);
        // console.log("原始返回:", responseText); // 调试时可以打开
        return {};
    }
};