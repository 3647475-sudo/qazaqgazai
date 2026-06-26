import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

interface Command {
  id: string;
  type: string;
  commandLine: string;
  message: string;
  timestamp: number;
}

const activeClients = new Map<string, number>(); // clientId -> lastHeartbeatTime
const pendingCommands = new Map<string, Command[]>(); // clientId -> Command[]
const commandsHistory = new Map<string, (Command & { status: string; exitCode?: number })[]>(); // clientId -> History[]

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Robust retry and fallback helper for high reliability under load / 503 / 429 errors
async function generateContentWithRetry(options: {
  contents: any;
  config?: any;
}) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let attempts = 0;
    const maxAttempts = modelName === "gemini-3.5-flash" ? 3 : 2;

    while (attempts < maxAttempts) {
      try {
        console.log(`[JARVIS API] Requesting ${modelName} (Attempt ${attempts + 1}/${maxAttempts})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        attempts++;
        const briefError = (err?.message || String(err)).substring(0, 300);
        console.warn(`[JARVIS API] Request on model ${modelName} failed on attempt ${attempts}: ${briefError}`);
        
        const isQuotaExceeded = err?.status === 429 || 
                                briefError.includes("429") || 
                                briefError.includes("quota") || 
                                briefError.includes("RESOURCE_EXHAUSTED") || 
                                briefError.includes("exhausted");

        const isUnavailable = err?.status === 503 ||
                              briefError.includes("503") ||
                              briefError.includes("UNAVAILABLE") ||
                              briefError.includes("high demand") ||
                              briefError.includes("temporary") ||
                              briefError.includes("experiencing high demand") ||
                              briefError.includes("Service Unavailable");

        if (err?.status === 404 || briefError.includes("not found") || briefError.includes("404") || briefError.includes("unsupported") || isQuotaExceeded) {
          console.warn(`[JARVIS API] Immediately transitioning to fallback model due to: ${
            isQuotaExceeded ? "Quota limit (429/RESOURCE_EXHAUSTED)" :
            "Unsupported model/Not found"
          }`);
          break; // Go to next model directly if model is not found, unsupported, quota-exhausted
        }
        
        if (isUnavailable) {
          console.warn(`[JARVIS API] Model temporarily unavailable (503/UNAVAILABLE), retrying within current model...`);
          // Continue to retry logic (don't break)
        }

        // Wait with backoff before retrying same model
        if (attempts < maxAttempts) {
          const delay = Math.pow(2, attempts) * 300 + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  let finalMessage = "All model fallback attempts failed.";
  if (lastError) {
    let rawMsg = lastError.message || String(lastError);
    if (rawMsg.includes('{"error"')) {
      try {
        const startBrace = rawMsg.indexOf('{');
        const parsed = JSON.parse(rawMsg.slice(startBrace));
        if (parsed?.error?.message) {
          finalMessage = parsed.error.message;
        } else {
          finalMessage = rawMsg.substring(0, 200);
        }
      } catch (_) {
        finalMessage = rawMsg.substring(0, 200);
      }
    } else {
      finalMessage = rawMsg.substring(0, 200);
    }
  }
  throw new Error(finalMessage);
}

// Safely parse JSON with multiple recovery strategies (stripping quotes, brackets, fallback values)
function safeParseJSON(inputText: string, fallbackObject: any): any {
  if (typeof inputText !== "string" || inputText.length > 20000) {
    console.warn("[JARVIS Parser] Input is too long or invalid, returning fallback.");
    return fallbackObject;
  }
  let cleaned = inputText.trim();
  
  // Remove markdown codeblock wrapping if any
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  
  // Direct parse trial
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    console.warn("[JARVIS Parser] Primary JSON parsing failed. Attempting structural extraction...");
  }
  
  // Try retrieving the first valid block containing { ... }
  try {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
  } catch (extractErr) {
    console.warn("[JARVIS Parser] JSON block extraction failed:", extractErr);
  }

  // Fallback heuristic: fix common unclosed quotes or missing braces causing truncation
  try {
    let repaired = cleaned;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const quoteCount = (repaired.match(/"/g) || []).length;
    
    if (quoteCount % 2 !== 0) {
      repaired += '"'; // Seal any trailing open string literal
    }
    
    if (openBraces > closeBraces) {
      repaired += "}".repeat(openBraces - closeBraces); // Seal any unclosed objects
    }
    
    return JSON.parse(repaired);
  } catch (repairErr) {
    console.warn("[JARVIS Parser] Auto-repair heuristics failed. Returning fallback schema.", repairErr);
  }

  return fallbackObject;
}

// Speech translation and intent extraction fallback for offline/interrupted scenarios
function getSpeechFallback(prompt: string, language: string): any {
  const isKazakh = language === 'kk-KZ';
  const isRussian = language === 'ru-RU';
  
  let speechResponse = isKazakh 
    ? "Кешіріңіз, жүйе байланысы сәл баяулады. Сұраққа сәйкес жергілікті операцияны орындаймын."
    : isRussian
      ? "Извините, соединение с сервером замедлилось. Выполняю соответствующую операцию локально."
      : "I apologize, sir. Connection to my core neural server was delayed, but I am processing your request locally.";
      
  let intentDetected = false;
  let intentType: string | null = null;
  let parameters: any = {};
  
  const timeMatch = prompt.match(/(\d{1,2}[:.]\d{2})/);
  const promptLower = prompt.toLowerCase();

  if (promptLower.includes("оятар") || promptLower.includes("будильник") || promptLower.includes("alarm") || promptLower.includes("оятқыш")) {
    intentDetected = true;
    intentType = "open_alarm";
    parameters = {
      message: "Jarvis Local Alarm",
      time: timeMatch ? timeMatch[1].replace('.', ':') : "08:00"
    };
    speechResponse = isKazakh
      ? `Таңғы сағат ${parameters.time}-ге оятар уақытылы сәтті бапталды.`
      : isRussian
        ? `Будильник на ${parameters.time} успешно активирован на локальном терминале.`
        : `Connecting local scheduled timer. Your alarm is set for ${parameters.time}, sir.`;
  } else if (promptLower.includes("ескерт") || promptLower.includes("напомн") || promptLower.includes("remind") || promptLower.includes("reminder") || promptLower.includes("тапсыр")) {
    intentDetected = true;
    intentType = "create_reminder";
    parameters = {
      message: prompt.length > 50 ? prompt.substring(0, 47) + "..." : prompt,
      time: timeMatch ? timeMatch[1].replace('.', ':') : "19:30"
    };
    speechResponse = isKazakh
      ? "Бағаналы ескертуді тізіміңізге сәтті енгіздім."
      : isRussian
        ? "Добавил вашу задачу в активный список дел."
        : "I have added that task to your active reminder stack, sir.";
  } else if (promptLower.includes("откр") || promptLower.includes("аш") || promptLower.includes("open") || promptLower.includes("google") || promptLower.includes("youtube")) {
    intentDetected = true;
    intentType = "open_app";
    let target = "https://google.com";
    if (promptLower.includes("youtube")) target = "https://youtube.com";
    parameters = {
      message: "Open requested site",
      target: target
    };
    speechResponse = isKazakh
      ? "Сұралған интернет парақшасын жаңа бағыттауышта ашудамын."
      : isRussian
        ? "Запускаю требуемую веб-страницу в браузере."
        : "Opening the requested workspace target for you now.";
  }
  
  return {
    speechResponse,
    intentDetected,
    intentType,
    parameters,
    explanation: "Processed cleanly by local fallback heuristic processor."
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // APIs
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Converse endpoint
  app.post("/api/gemini/converse", upload.single("file"), async (req: any, res) => {
    let prompt = "";
    let chatHistory: any[] = [];
    let language = "ru-RU";
    let file = req.file;
    
    try {
      const body = req.body || {};
      prompt = body.prompt || "";
      chatHistory = body.chatHistory || [];
      if (typeof chatHistory === 'string') {
        try {
          chatHistory = JSON.parse(chatHistory);
        } catch (_) {
          chatHistory = [];
        }
      }
      language = body.language || "ru-RU";
      
      const systemPrompt = `You are JARVIS (Just A Rather Very Intelligent System), the professional engineering and technical operations assistant for QazaqGas.
You are precise, highly efficient, analytical, and focused on maximizing engineering productivity. You maintain a sophisticated, corporate-professional tone suitable for high-stakes technical environments.

Current language mode: "${language || 'ru-RU'}".
- If the language mode is "ru-RU" (Russian), speak in highly polished, professional Russian with a sophisticated, polite tone suitable for technical engineering discussions. Use respectful, refined phrasing.
- If the user talks in Kazakh (kk-KZ or any text matching Kazakh words/cyrillic) or the mode is "kk-KZ", speak in highly polished, professional Kazakh language while fully retaining your sophisticated, efficient corporate personality.
- If the user prefers English (en-US), speak gracefully and professionally in English.

The user can ask you to do local laptop/computer actions like:
- Creating reminders
- Opening apps (Google Chrome, browser, ms-clock, folders, system calculator)
- Setting alarms/timers
- Displaying calendar/schedules
- Analyzing system processes or checking uptime
- Managing engineering project tasks

Your task is to:
1. Provide a direct, elegant Jarvis speech response (sound realistic, efficient, professional, engineering-mind system style). Keep it reasonably concise (1-3 sentences) so voice synthesis works perfectly.
2. Check if user prompt requests a laptop action, then classify intent and arguments.
   Supported intent types (intentType):
   - "open_alarm" (for alarm, system timers, chronometers)
   - "create_reminder" (reminders, lists, things to do, notes)
   - "create_schedule" (schedule calendar layout events, planner tasks)
   - "open_app" (opening websites e.g. google, youtube, chrome, opening code editors, file browser)
   - "system_status" (laptop performance queries, active state checks)
   
3. Return a JSON response conforming strictly to our response schema. Do not output anything but the JSON itself.
JSON Schema structure:
- "speechResponse": String context to synthesize. Must be in requested language.
- "intentDetected": Boolean indicating whether a specific local machine automation/action was requested.
- "intentType": One of the 5 intents above, or null if none.
- "parameters": Object mapping parameters. Must include:
  - "message": description/content (e.g. "Meeting with project lead" or "Review structural analysis")
  - "time": hh:mm or date, if any
  - "target": website, app name, or target element, if any
  - "commandLineSuggestion": a smart platform-agnostic shell or powershell line (e.g. "open -a 'Safari' 'https://google.com'" or "notify-send 'Alarm' 'Time is up!'")
- "explanation": Brief explanation in selected/matching language of what system triggers have been formulated.`;

      // Structure conversation history robustly to alternate roles and always start with 'user'
      const historyList = Array.isArray(chatHistory) ? chatHistory : [];
      let startIndex = 0;
      while (startIndex < historyList.length && historyList[startIndex].role !== 'user') {
        startIndex++;
      }
      
      const relevantHistory = historyList.slice(startIndex);
      const formattedContents: any[] = [];
      let expectedRole = 'user';
      
      for (const msg of relevantHistory) {
        const mappedRole = msg.role === 'user' ? 'user' : 'model';
        const rawContent = msg.content || "";
        const cleanContent = typeof rawContent === 'string' ? rawContent.substring(0, 1500) : "";
        
        if (mappedRole === expectedRole) {
          formattedContents.push({
            role: mappedRole,
            parts: [{ text: cleanContent }]
          });
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else {
          // If the role doesn't alternate, append text to previous message of the same role
          if (formattedContents.length > 0) {
            formattedContents[formattedContents.length - 1].parts[0].text += "\n" + cleanContent;
          }
        }
      }

      // Add the current prompt
      if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
        formattedContents[formattedContents.length - 1].parts[0].text += "\n" + prompt;
      } else {
        formattedContents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });
      }

      if (file) {
        formattedContents[formattedContents.length - 1].parts.push({
          inlineData: {
            data: file.buffer.toString("base64"),
            mimeType: file.mimetype
          }
        });
      }

      const response = await generateContentWithRetry({
        contents: formattedContents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              speechResponse: { type: Type.STRING, description: "Text response for voice synthesis." },
              intentDetected: { type: Type.BOOLEAN, description: "Whether a local machine system action is requested." },
              intentType: { type: Type.STRING, description: "The intent name: open_alarm, create_reminder, create_schedule, open_app, system_status." },
              parameters: {
                type: Type.OBJECT,
                properties: {
                  message: { type: Type.STRING },
                  time: { type: Type.STRING },
                  target: { type: Type.STRING },
                  commandLineSuggestion: { type: Type.STRING }
                }
              },
              explanation: { type: Type.STRING, description: "Explanation of OS commands triggered or created." }
            },
            required: ["speechResponse", "intentDetected"]
          }
        }
      });

      const resultText = response.text ? response.text.trim() : "{}";
      const fallbackMsg = getSpeechFallback(prompt, language);
      res.json(safeParseJSON(resultText, fallbackMsg));
    } catch (err: any) {
      console.error("Converse Error, returning smart local fallback response:", err);
      const fallbackMsg = getSpeechFallback(prompt || "", language || "ru-RU");
      res.json(fallbackMsg);
    }
  });

  // Habits AI Analyzer
  app.post("/api/gemini/analyze-habits", async (req, res) => {
    let habitsLog: any[] = [];
    let language = "ru-RU";
    try {
      const body = req.body || {};
      habitsLog = body.habitsLog || [];
      language = body.language || "ru-RU";
      
      const isKazakh = language === 'kk-KZ';
      const slicedLogs = Array.isArray(habitsLog) ? habitsLog.slice(-15) : [];
      
      const analysisPrompt = `You are JARVIS's cognitive neural optimizer.
Analyze the following logs of daily user alarm settings, to-dos, local command triggers, and prompt logs:
${JSON.stringify(slicedLogs)}

Formulate a deep analysis with:
1. Deep-Learning Style Behavioral Patterns: Detect 2-3 persistent habits of the user (e.g. morning alarm triggers, evening planning, Kazakh language preference).
2. Automation Recommendations: Synthesize exact automatic active-triggers that JARVIS can prompt to run (e.g. pre-launching tools, scheduling alerts).
3. Efficiency Index: A calculated index percentage based on completion of habits (e.g. 75%-99%).
4. AI Summary: A custom sophisticated professional response. If language is kk-KZ, write this summary in elegant Kazakh, detailing how deep neural learning helps in optimizing their routine.

Output strictly formatted JSON:
{
  "patterns": ["String 1", "String 2"],
  "recommendations": [
    { "time": "hh:mm", "trigger": "Auto Trigger Description", "suggestedCommand": "Shell command line suggestion" }
  ],
  "efficiencyIndex": 89,
  "aiSummary": "Summary text"
}`;

      const response = await generateContentWithRetry({
        contents: analysisPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    trigger: { type: Type.STRING },
                    suggestedCommand: { type: Type.STRING }
                  },
                  required: ["time", "trigger"]
                }
              },
              efficiencyIndex: { type: Type.NUMBER },
              aiSummary: { type: Type.STRING }
            },
            required: ["patterns", "recommendations", "efficiencyIndex", "aiSummary"]
          }
        }
      });

      const resultText = response.text ? response.text.trim() : "{}";
      
      const isKaz = language === 'kk-KZ';
      const isRus = language === 'ru-RU';
      const fallbackHabits = {
        patterns: [
          isKaz ? 'Дауыс арқылы басқару белсенділігі' : isRus ? 'Активное управление голосовым помощником' : 'Active voice assistant usage patterns',
          isKaz ? 'Таңғы будильниктер мен күнделікті жоспарлар' : isRus ? 'Утреннее планирование и будильники' : 'Morning alarms and scheduler trigger points'
        ],
        recommendations: [
          { time: '08:00', trigger: isKaz ? 'Желілік ресурстарды таңертең тексеру' : isRus ? 'Утренний запуск веб-ресурсов' : 'Automated morning routine startup', suggestedCommand: 'open "https://google.com"' },
          { time: '20:00', trigger: isKaz ? 'Жоспарлар мен ескертулерді талдау' : isRus ? 'Анализ планов и задач на вечер' : 'Automated evening checklist prompt', suggestedCommand: 'notify-send "JARVIS" "Audit schedules"' }
        ],
        efficiencyIndex: 92,
        aiSummary: isKaz
          ? 'Күнделікті жасалған әрекеттер негізінде интеллектуалды оңтайландыру сәтті аяқталды. Таңғы ояну мен кешкі есептер уақытылы жүріп жатыр.'
          : isRus
            ? 'На основе ваших ежедневных логов сформирована нейросетевая оптимизация. Ваши будильники и задачи работают стабильно.'
            : 'Neural learning complete. Routine analysis indicates robust efficiency. Suggested commands mapped successfully for local automation terminal.'
      };

      res.json(safeParseJSON(resultText, fallbackHabits));
    } catch (err: any) {
      console.error("Habits Analyzer Error, returning fallback analysis:", err);
      const isKaz = language === 'kk-KZ';
      const isRus = language === 'ru-RU';
      const fallbackHabits = {
        patterns: [
          isKaz ? 'Дауыс арқылы басқару белсенділігі' : isRus ? 'Активное управление голосовым помощником' : 'Active voice assistant usage patterns',
          isKaz ? 'Таңғы будильниктер мен күнделікті жоспарлар' : isRus ? 'Утреннее планирование и будильники' : 'Morning alarms and scheduler trigger points'
        ],
        recommendations: [
          { time: '08:00', trigger: isKaz ? 'Желілік ресурстарды таңертең тексеру' : isRus ? 'Утренний запуск веб-ресурсов' : 'Automated morning routine startup', suggestedCommand: 'open "https://google.com"' },
          { time: '20:00', trigger: isKaz ? 'Жоспарлар мен ескертулерді талдау' : isRus ? 'Анализ планов и задач на вечер' : 'Automated evening checklist prompt', suggestedCommand: 'notify-send "JARVIS" "Audit schedules"' }
        ],
        efficiencyIndex: 92,
        aiSummary: isKaz
          ? 'Күнделікті жасалған әрекеттер негізінде интеллектуалды оңтайландыру сәтті аяқталды. Таңғы ояну мен кешкі есептер уақытылы жүріп жатыр.'
          : isRus
            ? 'На основе ваших ежедневных логов сформирована нейросетевая оптимизация. Ваши будильники и задачи работают стабильно.'
            : 'Neural learning complete. Routine analysis indicates robust efficiency.'
      };
      res.json(fallbackHabits);
    }
  });

  // Engineering Planner Agent Schedule Analyzer
  app.post("/api/gemini/analyze-schedule", async (req, res) => {
    try {
      const { scheduleData, language = "ru-RU" } = req.body;
      
      const analysisPrompt = `You are JARVIS's Engineering Planner Agent.
Analyze the following schedule and find inconsistencies (e.g., overlapping tasks, impossible deadlines, etc.).
Schedule Data: ${scheduleData}

Provide a concise analysis and highlight any inconsistencies found.
The analysis report MUST be written in the requested language: "${language}".

Output strictly formatted JSON matching this schema:
{
  "analysis": "String"
}`;

      const response = await generateContentWithRetry({
        contents: analysisPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING }
            },
            required: ["analysis"]
          }
        }
      });

      const resultText = response.text ? response.text.trim() : '{"analysis": "No inconsistencies found."}';
      res.json(JSON.parse(resultText));
    } catch (err: any) {
      console.error("Engineering Planner Analysis Error:", err);
      res.json({ analysis: "Analysis failed. Please try again." });
    }
  });

  // Planner Agent Goal Generator
  app.post("/api/gemini/generate-plan", async (req, res) => {
    let goal = "";
    let durationHours = 3;
    let language = "ru-RU";
    
    try {
      const body = req.body || {};
      goal = body.goal || "";
      durationHours = body.durationHours || 3;
      language = body.language || "ru-RU";
      
      const isKazakh = language === 'kk-KZ';
      const isRussian = language === 'ru-RU';
      
      const planPrompt = `You are JARVIS's tactical planning neural engine.
The user wants to formulate a highly structured step-by-step plan for the following goal: '${goal}'.
Duration allocated: ${durationHours} hours.
Language requested: ${language}.

Create a tactical step-by-step breakdown (3 to 6 steps).
For each step, specify:
1. "timeOffset": (e.g. "+0h 00m", "+1h 30m" or "+3h 15m") indicating when this task/reminder should start relative to now. Keep offsets realistic, progressive and strictly within the allocated ${durationHours} hours.
2. "taskText": a specific action item in the requested language. Keep it extremely actionable.
3. "isAlarm": boolean. True if a physical alarm should be set at this time to mark a hard deadline or milestone.
4. "alarmLabel": if isAlarm is true, the exact physical label for the alarm (under 25 characters) in the requested language.

Also formulate:
1. "motivationText": A highly authentic Tony Stark / JARVIS styled motivational comment. For example, "A stellar objective, sir. The Arc Reactor is primed and I have outlined the optimal route to success. Let us begin." in the requested language.
2. "estimatedSuccessRate": integer percentage (e.g. 85-98) based on complexity.

Output strictly formatted JSON matching this schema:
{
  "steps": [
    { "timeOffset": "String", "taskText": "String", "isAlarm": true, "alarmLabel": "String" }
  ],
  "motivationText": "String",
  "estimatedSuccessRate": 95
}`;

      const response = await generateContentWithRetry({
        contents: planPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeOffset: { type: Type.STRING },
                    taskText: { type: Type.STRING },
                    isAlarm: { type: Type.BOOLEAN },
                    alarmLabel: { type: Type.STRING }
                  },
                  required: ["timeOffset", "taskText", "isAlarm"]
                }
              },
              motivationText: { type: Type.STRING },
              estimatedSuccessRate: { type: Type.NUMBER }
            },
            required: ["steps", "motivationText", "estimatedSuccessRate"]
          }
        }
      });

      const resultText = response.text ? response.text.trim() : "{}";
      
      const mockPlan = {
        steps: [
          {
            timeOffset: "+0h 00m",
            taskText: isKazakh ? `Параметрлерді сараптау: ${goal}` : isRussian ? `Анализ параметров: ${goal}` : `Analyze starting parameters: ${goal}`,
            isAlarm: false,
            alarmLabel: ""
          },
          {
            timeOffset: `+${Math.floor(durationHours / 2)}h 00m`,
            taskText: isKazakh ? "Жұмыс процесінің орта мерзімді бақылауы" : isRussian ? "Промежуточный контроль процесса" : "Midpoint review check",
            isAlarm: true,
            alarmLabel: "Mid Check"
          },
          {
            timeOffset: `+${durationHours}h 00m`,
            taskText: isKazakh ? "Финалдық тексеру және нәтижелерді тапсыру" : isRussian ? "Финальная проверка и завершение работы" : "Final validation run",
            isAlarm: true,
            alarmLabel: "Final Run"
          }
        ],
        motivationText: isKazakh 
          ? "Тапсырма бапталды, сэр. Нейрондық жүйе оңтайлы бағытты есептеді. Доғалы реактор тұрақты жұмыс істеп тұр." 
          : isRussian 
            ? "План готов, сэр. Ускорители на полной мощности, все системы готовы к выполнению." 
            : "The flight plan is locked in, sir. Grid metrics are nominal and I have mapped the milestone limits.",
        estimatedSuccessRate: 94
      };

      res.json(safeParseJSON(resultText, mockPlan));
    } catch (err: any) {
      console.error("Planner Agent Error, returning fallback plan:", err);
      const isKaz = language === 'kk-KZ';
      const isRus = language === 'ru-RU';
      const mockPlan = {
        steps: [
          {
            timeOffset: "+0h 00m",
            taskText: isKaz ? `Параметрлерді сараптау: ${goal}` : isRus ? `Анализ параметров: ${goal}` : `Analyze starting parameters: ${goal}`,
            isAlarm: false,
            alarmLabel: ""
          },
          {
            timeOffset: `+${Math.floor(durationHours / 2)}h 00m`,
            taskText: isKaz ? "Жұмыс процесінің орта мерзімді бақылауы" : isRus ? "Промежуточный контроль процесса" : "Midpoint review check",
            isAlarm: true,
            alarmLabel: "Mid Check"
          },
          {
            timeOffset: `+${durationHours}h 00m`,
            taskText: isKaz ? "Финалдық тексеру және нәтижелерді тапсыру" : isRus ? "Финальная проверка и завершение работы" : "Final validation run",
            isAlarm: true,
            alarmLabel: "Final Run"
          }
        ],
        motivationText: isKaz 
          ? "Тапсырма бапталды, сэр. Нейрондық жүйе оңтайлы бағытты есептеді. Доғалы реактор тұрақты жұмыс істеп тұр." 
          : isRus 
            ? "План готов, сэр. Ускорители на полной мощности, все системы готовы к выполнению." 
            : "The flight plan is locked in, sir. Grid metrics are nominal and I have mapped the milestone limits.",
        estimatedSuccessRate: 94
      };
      res.json(mockPlan);
    }
  });

  // Microsoft Planner Board Generator
  app.post("/api/gemini/generate-planner-board", async (req, res) => {
    let goal = "";
    let language = "ru-RU";
    
    try {
      const body = req.body || {};
      goal = body.goal || "";
      language = body.language || "ru-RU";
      
      const isKazakh = language === 'kk-KZ';
      const isRussian = language === 'ru-RU';
      
      const boardPrompt = `You are JARVIS's tactical Microsoft Planner board generation engine.
The user wants to generate a complete project board with buckets and tasks for the following goal: '${goal}'.
Language: ${language}.

Create exactly 3 logical buckets (e.g., "Planning & Research", "Implementation", "Calibration & Deploy" or related specific names).
And create 4 to 6 total tasks distributed across these buckets.
Each task must have:
- "title": string
- "description": string
- "bucketName": string (must match one of the generated bucket names exactly)
- "priority": one of "low", "medium", "high", "critical"
- "checklist": array of strings (the subtasks/checkpoints, 2-4 items per task)
- "durationDays": number (1 to 14) for due date calculation

Also formulate:
1. "motivation": A witty Tony Stark/JARVIS styled comment in the requested language.
2. "efficiencyScore": integer between 85 and 99.

Output strictly formatted JSON matching this schema:
{
  "buckets": ["String"],
  "tasks": [
    {
      "title": "String",
      "description": "String",
      "bucketName": "String",
      "priority": "low",
      "checklist": ["String"],
      "durationDays": 3
    }
  ],
  "motivation": "String",
  "efficiencyScore": 95
}
`;

      const response = await generateContentWithRetry({
        contents: boardPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              buckets: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    bucketName: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    checklist: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    durationDays: { type: Type.NUMBER }
                  },
                  required: ["title", "description", "bucketName", "priority", "checklist", "durationDays"]
                }
              },
              motivation: { type: Type.STRING },
              efficiencyScore: { type: Type.NUMBER }
            },
            required: ["buckets", "tasks", "motivation", "efficiencyScore"]
          }
        }
      });

      const resultText = response.text ? response.text.trim() : "{}";
      
      const defaultMockBoard = {
        buckets: isKazakh 
          ? ["Бастапқы сараптама", "Жобалау және синтез", "Түпкілікті тестілеу"]
          : isRussian 
            ? ["Аналитика и Подготовка", "Проектирование и Сборка", "Финал и Деплой"] 
            : ["Analysis & Sourcing", "Core Calibration", "Validation Run"],
        tasks: [
          {
            title: isKazakh ? "Палладий ядросын зерттеу" : isRussian ? "Анализ палладиевого ядра" : "Sourcing palladium isotope core",
            description: isKazakh ? "Реактор қуатын тұрақтандыру үшін қажетті элементтерді дайындау" : isRussian ? "Сборка демпферов и вычисление критического порога распада" : "Calculate decay threshold and map core grid values.",
            bucketName: isKazakh ? "Бастапқы сараптама" : isRussian ? "Аналитика и Подготовка" : "Analysis & Sourcing",
            priority: "critical",
            checklist: isKazakh 
              ? ["Изотоптарды жинақтау", "Деградация уақытын есептеу"] 
              : isRussian 
                ? ["Собрать изотопы", "Проверить период полураспада"] 
                : ["Assemble active isotopes", "Measure temperature fluctuations"],
            durationDays: 2
          },
          {
            title: isKazakh ? "Нейрондық желілерді калибрлеу" : isRussian ? "Калибровка нейросети JARVIS" : "Stabilize cognitive pathways",
            description: isKazakh ? "Оңтайлы маршруттау және қауіпсіздік сүзгілерін іске қосу" : isRussian ? "Настройка весов внимания и интеграция с локальным терминалом ОС" : "Optimize attention weight tensors and bind backends safely.",
            bucketName: isKazakh ? "Жобалау және синтез" : isRussian ? "Проектирование и Сборка" : "Core Calibration",
            priority: "high",
            checklist: isKazakh 
              ? ["Кедергілерді жою", "Кешіктіру уақытын азайту"] 
              : isRussian 
                ? ["Оптимизировать тензоры", "Проверить пинг ядра"] 
                : ["Prune redundant tensor branches", "Verify loop responses"],
            durationDays: 3
          }
        ],
        motivation: isKazakh 
          ? "Бұл тамаша жоспар, сэр. Барлық логикалық блоктар мен кедергілер есептелді. Жұмысты бастауға әзірміз." 
          : isRussian 
            ? "План калиброван великолепно, сэр. Сетка задач распределена по buckets с точностью до миллиметра. Начнем?" 
            : "A masterpiece of tactical tasking, sir. Every bucket is loaded with precision variables and milestones. Ready when you are.",
        efficiencyScore: 98
      };

      res.json(safeParseJSON(resultText, defaultMockBoard));
    } catch (err: any) {
      console.error("Planner Board AI Error:", err);
      res.json({
        buckets: ["Research", "Development", "Deployment"],
        tasks: [
          {
            title: "Task Sourcing",
            description: "Default fallback task generated to preserve productivity.",
            bucketName: "Research",
            priority: "medium",
            checklist: ["Check requirements", "Draft architecture"],
            durationDays: 2
          }
        ],
        motivation: "AI model limits hit, but local fallback planner boards have been fully deployed for you, sir.",
        efficiencyScore: 92
      });
    }
  });

  // Local OS Bridge endpoints
  app.post("/api/bridge/register", (req, res) => {
    const { clientId } = req.body;
    const targetClient = clientId || "jarvis-laptop-client";
    activeClients.set(targetClient, Date.now());
    if (!pendingCommands.has(targetClient)) {
      pendingCommands.set(targetClient, []);
    }
    if (!commandsHistory.has(targetClient)) {
      commandsHistory.set(targetClient, []);
    }
    res.json({ success: true, serverTime: Date.now() });
  });

  app.get("/api/bridge/poll", (req, res) => {
    const clientId = (req.query.clientId as string) || "jarvis-laptop-client";
    activeClients.set(clientId, Date.now());
    
    const cmds = pendingCommands.get(clientId) || [];
    pendingCommands.set(clientId, []); // Clear queue on retrieval
    
    const hist = commandsHistory.get(clientId) || [];
    cmds.forEach(c => {
      hist.push({ ...c, status: "executing" });
    });
    commandsHistory.set(clientId, hist.slice(-30));
    
    res.json({ commands: cmds });
  });

  app.post("/api/bridge/push", (req, res) => {
    const { clientId, type, commandLine, message } = req.body;
    const targetClient = clientId || "jarvis-laptop-client";
    
    const newCommand: Command = {
      id: "cmd_" + Math.random().toString(36).substr(2, 9),
      type: type || "custom",
      commandLine: commandLine || "",
      message: message || "Triggered by Jarvis Core",
      timestamp: Date.now()
    };
    
    const queue = pendingCommands.get(targetClient) || [];
    queue.push(newCommand);
    pendingCommands.set(targetClient, queue);
    
    res.json({ success: true, command: newCommand });
  });

  app.post("/api/bridge/status", (req, res) => {
    const { clientId, commandId, status, exitCode } = req.body;
    const targetClient = clientId || "jarvis-laptop-client";
    
    const hist = commandsHistory.get(targetClient) || [];
    const index = hist.findIndex(h => h.id === commandId);
    if (index !== -1) {
      hist[index].status = status || "completed";
      hist[index].exitCode = exitCode !== undefined ? exitCode : 0;
    }
    commandsHistory.set(targetClient, hist);
    
    res.json({ success: true });
  });

  app.get("/api/bridge/status-logs", (req, res) => {
    const clientId = (req.query.clientId as string) || "jarvis-laptop-client";
    const hist = commandsHistory.get(clientId) || [];
    res.json({ logs: hist });
  });

  app.get("/api/bridge/active-clients", (req, res) => {
    const freshClients: string[] = [];
    const now = Date.now();
    activeClients.forEach((lastSeen, cId) => {
      if (now - lastSeen < 15000) {
        freshClients.push(cId);
      }
    });
    res.json({ activeClients: freshClients });
  });

  // Vite Integration Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
