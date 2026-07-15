import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import AdmZip from "adm-zip";
import { GoogleGenAI, Modality } from "@google/genai";
import { DEFAULT_ASSETS, AudioAsset } from "./src/data/defaultAssets.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Paths for persistence
const DATA_DIR = path.join(process.cwd(), "data");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

let assets: AudioAsset[] = [];
const audioBuffers = new Map<string, Buffer>();

// Initialize Gemini API client if key exists
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini client:", error);
  }
} else {
  console.log("No GEMINI_API_KEY found or it is placeholder. Audio will be generated using client-side speech synthesis as fallback.");
}

/**
 * Executes a Gemini TTS generation request with exponential backoff on 429/quota errors.
 */
async function generateTTSWithRetry(
  aiClient: GoogleGenAI,
  prompt: string,
  voiceName: string,
  retries = 3,
  delayMs = 2500
): Promise<any> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });
      return response;
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || "";
      const isQuotaError =
        errorMessage.includes("429") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("limit") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.code === 429;

      console.warn(`[Gemini TTS] Tentativa ${attempt}/${retries} falhou. Erro: ${errorMessage}`);

      if (isQuotaError && attempt < retries) {
        // Calculate backoff: attempt 1: 3000ms, attempt 2: 7000ms (+ random jitter)
        const waitTime = delayMs * Math.pow(2, attempt) + Math.random() * 1500;
        console.warn(`[Gemini TTS] Limite de quota/taxa atingido (429/RESOURCE_EXHAUSTED). Aguardando ${Math.round(waitTime)}ms antes de tentar novamente...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Extracts a clean phonetic/target word fallback if pureSoundText is not supplied.
 */
function getFallbackPureText(asset: AudioAsset): string {
  if (asset.id.startsWith("fon_")) {
    const part = asset.id.replace("fon_", "");
    if (part === "e_fechado") return "êêê";
    if (part === "e_aberto") return "ééé";
    if (part === "o_fechado") return "ôôô";
    if (part === "o_aberto") return "óóó";
    if (part === "a_nasal") return "ããã";
    
    // Improve fallback representations for consonants to encourage correct phonetic outputs
    if (part === "b") return "b... b... b...";
    if (part === "c_k" || part === "k" || part === "q") return "k... k... k...";
    if (part === "c_s" || part === "s" || part === "c_brando") return "sssss";
    if (part === "d") return "d... d... d...";
    if (part === "g_forte") return "g... g... g...";
    if (part === "g_brando" || part === "j") return "jjjjj";
    if (part === "r_forte") return "rrrrr";
    if (part === "r_brando") return "rrr... rrr...";
    if (part === "lh") return "lhâ... lhâ...";
    if (part === "nh") return "nhê... nhê...";
    if (part === "f") return "fffff";
    if (part === "v") return "vvvvv";
    if (part === "m") return "mmmmm";
    if (part === "n") return "nnnnn";
    if (part === "l") return "lllll";
    if (part === "t") return "t... t... t...";
    if (part === "p") return "p... p... p...";
    if (part === "x" || part === "ch") return "chhhhh";
    if (part === "z") return "zzzzz";
    
    return part.charAt(0).toUpperCase();
  }
  if (asset.id.startsWith("sil_")) {
    const part = asset.id.replace("sil_", "");
    return part.toUpperCase();
  }
  if (asset.id.startsWith("pal_")) {
    const part = asset.id.replace("pal_", "");
    return part.toUpperCase();
  }
  return asset.text_to_speak.replace(/\[.*?\]\s*/g, ""); // strip manual tags if present
}

/**
 * Loads assets from database file or initializes with defaults.
 */
function loadAssets() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      assets = JSON.parse(data);
      console.log(`Loaded ${assets.length} assets from persistent storage.`);
    } catch (error) {
      console.error("Failed to read persistent assets file, falling back to defaults:", error);
      initializeDefaultAssets();
    }
  } else {
    initializeDefaultAssets();
  }

  // Ensure assets are synchronized with physical files on disk
  syncAssetsWithDisk();
}

/**
 * Synchronizes assets in-memory/db with physical wav files in AUDIO_DIR.
 * Restores completed status and reconstructs missing items if they exist as physical files.
 */
function syncAssetsWithDisk() {
  try {
    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }
    const files = fs.readdirSync(AUDIO_DIR);
    let updated = false;

    console.log(`[Disk Sync] Scanning ${files.length} files in /data/audio...`);

    for (const file of files) {
      if (file.endsWith(".wav")) {
        const id = file.substring(0, file.length - 4);
        let asset = assets.find((a) => a.id === id);

        if (!asset) {
          // Reconstruct asset if it was in DEFAULT_ASSETS
          const defAsset = DEFAULT_ASSETS.find((a) => a.id === id);
          if (defAsset) {
            asset = {
              ...defAsset,
              status: "completed",
              audioUrl: `/api/audio/${id}`,
              voiceName: defAsset.voiceName || "Kore",
              speed: defAsset.speed || "lento",
              toneStyle: defAsset.toneStyle || "didático",
              pureSoundMode: defAsset.pureSoundMode || false,
              pureSoundText: defAsset.pureSoundText || getFallbackPureText(defAsset),
            };
            assets.push(asset);
            updated = true;
            console.log(`[Disk Sync] Recovered default asset '${id}' from physical wav file.`);
          } else {
            // Reconstruct as custom asset
            const category = id.startsWith("fon_")
              ? "fonemas"
              : id.startsWith("sil_")
              ? "silabas"
              : id.startsWith("pal_")
              ? "palavras"
              : "instrucoes_e_feedbacks";

            asset = {
              id,
              category,
              text_to_speak: id.replace(/_/g, " "),
              file_name: file,
              difficulty: "fácil",
              status: "completed",
              audioUrl: `/api/audio/${id}`,
              voiceName: "Kore",
              speed: "lento",
              toneStyle: "didático",
              pureSoundMode: false,
              pureSoundText: id.replace(/_/g, " "),
            };
            assets.push(asset);
            updated = true;
            console.log(`[Disk Sync] Recovered custom asset '${id}' from physical wav file.`);
          }
        } else {
          if (asset.status !== "completed" || !asset.audioUrl) {
            asset.status = "completed";
            asset.audioUrl = `/api/audio/${id}`;
            updated = true;
            console.log(`[Disk Sync] Restored 'completed' status of asset '${id}' from disk.`);
          }
        }
      }
    }

    if (updated) {
      saveAssets();
    }
  } catch (error) {
    console.error("[Disk Sync] Failed to synchronize assets with physical files:", error);
  }
}

/**
 * Initializes defaulted voice settings for initial assets.
 */
function initializeDefaultAssets() {
  assets = DEFAULT_ASSETS.map(asset => ({
    ...asset,
    status: "pending",
    audioUrl: undefined,
    voiceName: asset.voiceName || "Kore",
    speed: asset.speed || "lento",
    toneStyle: asset.toneStyle || "didático",
    pureSoundMode: asset.pureSoundMode || false,
    pureSoundText: asset.pureSoundText || getFallbackPureText(asset)
  }));
  saveAssets();
}

/**
 * Writes assets schema to database file.
 */
function saveAssets() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(assets, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save assets database:", error);
  }
}

// Initial boot load
loadAssets();

/**
 * Creates a 44-byte WAV header for raw 16-bit PCM little-endian audio.
 */
function addWavHeader(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = dataSize + headerSize - 8;

  const header = Buffer.alloc(headerSize);

  // RIFF identifier
  header.write("RIFF", 0);
  // file length
  header.writeUInt32LE(fileSize, 4);
  // WAVE identifier
  header.write("WAVE", 8);
  // Fmt identifier
  header.write("fmt ", 12);
  // chunk length
  header.writeUInt32LE(16, 16);
  // sample format (raw PCM = 1)
  header.writeUInt16LE(1, 20);
  // channel count
  header.writeUInt16LE(numChannels, 22);
  // sample rate
  header.writeUInt32LE(sampleRate, 24);
  // byte rate
  header.writeUInt32LE(byteRate, 28);
  // block align
  header.writeUInt16LE(blockAlign, 32);
  // bits per sample
  header.writeUInt16LE(bitsPerSample, 34);
  // Data identifier
  header.write("data", 36);
  // data chunk length
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// API Routes

// Get all assets
app.get("/api/assets", (req, res) => {
  res.json({
    assets,
    hasApiKey: !!ai,
  });
});

// Reset assets to default
app.post("/api/assets/reset", (req, res) => {
  initializeDefaultAssets();
  audioBuffers.clear();

  // Clear physically stored audios
  try {
    const files = fs.readdirSync(AUDIO_DIR);
    for (const file of files) {
      if (file.endsWith(".wav")) {
        fs.unlinkSync(path.join(AUDIO_DIR, file));
      }
    }
  } catch (e) {
    console.error("Failed to clean audio storage directory:", e);
  }

  res.json({ success: true, assets });
});

// Create/Add a custom asset
app.post("/api/assets", (req, res) => {
  const { id, category, text_to_speak, file_name, difficulty, voiceName, speed, toneStyle, pureSoundMode, pureSoundText } = req.body;

  if (!id || !category || !text_to_speak || !file_name || !difficulty) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sanitizedId = id.toLowerCase().trim().replace(/\s+/g, "_");
  if (assets.some((a) => a.id === sanitizedId)) {
    return res.status(400).json({ error: "An asset with this ID already exists" });
  }

  const newAsset: AudioAsset = {
    id: sanitizedId,
    category,
    text_to_speak,
    file_name: file_name.endsWith(".wav") ? file_name : `${file_name}.wav`,
    difficulty,
    status: "pending",
    voiceName: voiceName ?? "Kore",
    speed: speed ?? "lento",
    toneStyle: toneStyle ?? "didático",
    pureSoundMode: pureSoundMode ?? false,
    pureSoundText: pureSoundText ?? text_to_speak.replace(/\[.*?\]\s*/g, ""),
  };

  assets.unshift(newAsset);
  saveAssets();

  res.json({ success: true, asset: newAsset });
});

// Update an asset's properties
app.put("/api/assets/:id", (req, res) => {
  const { id } = req.params;
  const { 
    text_to_speak, 
    file_name, 
    difficulty,
    voiceName,
    speed,
    toneStyle,
    pureSoundMode,
    pureSoundText
  } = req.body;

  const index = assets.findIndex((a) => a.id === id);
  if (index !== -1) {
    const oldAsset = assets[index];

    // Check if fields affecting voice generation have changed
    const hasVoiceGenerationParamsChanged = 
      (text_to_speak !== undefined && text_to_speak !== oldAsset.text_to_speak) ||
      (voiceName !== undefined && voiceName !== oldAsset.voiceName) ||
      (speed !== undefined && speed !== oldAsset.speed) ||
      (toneStyle !== undefined && toneStyle !== oldAsset.toneStyle) ||
      (pureSoundMode !== undefined && pureSoundMode !== oldAsset.pureSoundMode) ||
      (pureSoundText !== undefined && pureSoundText !== oldAsset.pureSoundText);

    assets[index] = {
      ...oldAsset,
      text_to_speak: text_to_speak !== undefined ? text_to_speak : oldAsset.text_to_speak,
      file_name: file_name !== undefined ? file_name : oldAsset.file_name,
      difficulty: difficulty !== undefined ? difficulty : oldAsset.difficulty,
      voiceName: voiceName !== undefined ? voiceName : oldAsset.voiceName,
      speed: speed !== undefined ? speed : oldAsset.speed,
      toneStyle: toneStyle !== undefined ? toneStyle : oldAsset.toneStyle,
      pureSoundMode: pureSoundMode !== undefined ? pureSoundMode : oldAsset.pureSoundMode,
      pureSoundText: pureSoundText !== undefined ? pureSoundText : oldAsset.pureSoundText,
      status: hasVoiceGenerationParamsChanged ? "pending" : oldAsset.status,
      audioUrl: hasVoiceGenerationParamsChanged ? undefined : oldAsset.audioUrl,
    };

    if (hasVoiceGenerationParamsChanged) {
      audioBuffers.delete(id);
      try {
        const audioFilePath = path.join(AUDIO_DIR, `${id}.wav`);
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }
      } catch (e) {
        console.error(`Failed to delete obsolete audio file for ${id}:`, e);
      }
    }

    saveAssets();
    res.json({ success: true, asset: assets[index] });
  } else {
    res.status(404).json({ error: "Asset not found" });
  }
});

// Import multiple assets in bulk (merges or overwrites existing ones by ID)
app.post("/api/assets/import", (req, res) => {
  const { assets: importedAssets } = req.body;

  if (!Array.isArray(importedAssets)) {
    return res.status(400).json({ error: "O corpo da requisição deve conter um array de 'assets'." });
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of importedAssets) {
    if (!item.id || !item.category || !item.text_to_speak || !item.file_name || !item.difficulty) {
      continue; // Skip invalid entries
    }

    const sanitizedId = item.id.toLowerCase().trim().replace(/\s+/g, "_");
    const existingIndex = assets.findIndex((a) => a.id === sanitizedId);

    const assetData: AudioAsset = {
      id: sanitizedId,
      category: item.category,
      text_to_speak: item.text_to_speak,
      file_name: item.file_name.endsWith(".wav") ? item.file_name : `${item.file_name}.wav`,
      difficulty: item.difficulty,
      status: item.status || "pending",
      audioUrl: item.audioUrl,
      voiceName: item.voiceName || "Kore",
      speed: item.speed || "lento",
      toneStyle: item.toneStyle || "didático",
      pureSoundMode: !!item.pureSoundMode,
      pureSoundText: item.pureSoundText || item.text_to_speak.replace(/\[.*?\]\s*/g, ""),
    };

    if (existingIndex !== -1) {
      const oldAsset = assets[existingIndex];
      // If voice parameters are different from the old ones, mark as pending to allow regeneration
      const hasVoiceGenerationParamsChanged =
        oldAsset.text_to_speak !== assetData.text_to_speak ||
        oldAsset.voiceName !== assetData.voiceName ||
        oldAsset.speed !== assetData.speed ||
        oldAsset.toneStyle !== assetData.toneStyle ||
        oldAsset.pureSoundMode !== assetData.pureSoundMode ||
        oldAsset.pureSoundText !== assetData.pureSoundText;

      if (hasVoiceGenerationParamsChanged) {
        assetData.status = "pending";
        assetData.audioUrl = undefined;
        audioBuffers.delete(sanitizedId);
        try {
          const audioFilePath = path.join(AUDIO_DIR, `${sanitizedId}.wav`);
          if (fs.existsSync(audioFilePath)) {
            fs.unlinkSync(audioFilePath);
          }
        } catch (e) {
          console.error(`Falha ao excluir áudio obsoleto na importação para ${sanitizedId}:`, e);
        }
      }

      assets[existingIndex] = assetData;
      updatedCount++;
    } else {
      assets.unshift(assetData);
      addedCount++;
    }
  }

  saveAssets();
  res.json({
    success: true,
    message: `Importação concluída. ${addedCount} novos áudios adicionados, ${updatedCount} atualizados.`,
    assets,
  });
});

// Bulk update multiple assets at once with voice templates/presets
app.put("/api/assets/bulk-update", (req, res) => {
  const { ids, voiceName, speed, toneStyle, pureSoundMode, applyToAll } = req.body;

  let targetIds = ids || [];
  if (applyToAll) {
    targetIds = assets.map((a) => a.id);
  }

  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return res.status(400).json({ error: "Nenhum ID de áudio fornecido para atualização em lote." });
  }

  let updatedCount = 0;

  assets = assets.map((asset) => {
    if (targetIds.includes(asset.id)) {
      const currentVoice = asset.voiceName || "Kore";
      const currentSpeed = asset.speed || "lento";
      const currentTone = asset.toneStyle || "didático";
      const currentPure = !!asset.pureSoundMode;

      const nextVoice = voiceName !== undefined ? voiceName : currentVoice;
      const nextSpeed = speed !== undefined ? speed : currentSpeed;
      const nextTone = toneStyle !== undefined ? toneStyle : currentTone;
      const nextPure = pureSoundMode !== undefined ? !!pureSoundMode : currentPure;

      const hasVoiceGenerationParamsChanged = 
        currentVoice !== nextVoice ||
        currentSpeed !== nextSpeed ||
        currentTone !== nextTone ||
        currentPure !== nextPure;

      if (hasVoiceGenerationParamsChanged) {
        const updatedAsset = { ...asset };

        if (voiceName !== undefined) updatedAsset.voiceName = voiceName;
        if (speed !== undefined) updatedAsset.speed = speed;
        if (toneStyle !== undefined) updatedAsset.toneStyle = toneStyle;
        if (pureSoundMode !== undefined) {
          updatedAsset.pureSoundMode = pureSoundMode;
          if (pureSoundMode && !updatedAsset.pureSoundText) {
            updatedAsset.pureSoundText = getFallbackPureText(updatedAsset);
          }
        }

        updatedAsset.status = "pending";
        updatedAsset.audioUrl = undefined;
        updatedCount++;
        audioBuffers.delete(asset.id);
        
        try {
          const audioFilePath = path.join(AUDIO_DIR, `${asset.id}.wav`);
          if (fs.existsSync(audioFilePath)) {
            fs.unlinkSync(audioFilePath);
          }
        } catch (e) {
          console.error(`Falha ao excluir arquivo de áudio obsoleto para ${asset.id} em lote:`, e);
        }

        return updatedAsset;
      }
    }
    return asset;
  });

  if (updatedCount > 0) {
    saveAssets();
  }

  res.json({ success: true, updatedCount, assets });
});

// Generate audio for an asset using Gemini TTS with customizable features
app.post("/api/assets/generate", async (req, res) => {
  const { id, voiceName: overrideVoiceName, speed: overrideSpeed, toneStyle: overrideToneStyle, pureSoundMode: overridePureSoundMode, pureSoundText: overridePureSoundText } = req.body;

  const assetIndex = assets.findIndex((a) => a.id === id);
  if (assetIndex === -1) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const asset = assets[assetIndex];

  // Apply overrides if provided to ensure absolute consistency
  if (overrideVoiceName !== undefined) asset.voiceName = overrideVoiceName;
  if (overrideSpeed !== undefined) asset.speed = overrideSpeed;
  if (overrideToneStyle !== undefined) asset.toneStyle = overrideToneStyle;
  if (overridePureSoundMode !== undefined) {
    asset.pureSoundMode = overridePureSoundMode;
    if (overridePureSoundMode && !asset.pureSoundText) {
      asset.pureSoundText = overridePureSoundText || getFallbackPureText(asset);
    }
  }
  if (overridePureSoundText !== undefined) asset.pureSoundText = overridePureSoundText;

  asset.status = "generating";
  saveAssets();

  // Determine what text to speak
  const textToSpeak = asset.pureSoundMode 
    ? (asset.pureSoundText || getFallbackPureText(asset)) 
    : asset.text_to_speak;

  if (!ai) {
    // Fallback: browser Web Speech synthesis with simulated completion
    asset.status = "completed";
    asset.audioUrl = `fallback://${encodeURIComponent(textToSpeak)}`;
    saveAssets();
    return res.json({
      success: true,
      asset,
      message: "Generated using browser Web Speech API fallback (no API key configured).",
    });
  }

  try {
    const voiceName = asset.voiceName || "Kore";
    const speed = asset.speed || "lento";
    const toneStyle = asset.toneStyle || "didático";

    let speedPrompt = "fale de forma lenta, pausada e muito articulada, ideal para alfabetização infantil";
    if (speed === "normal") {
      speedPrompt = "fale com velocidade e ritmo natural";
    } else if (speed === "rápido") {
      speedPrompt = "fale com ritmo rápido, dinâmico e fluido";
    }

    let stylePrompt = "tom de professora carinhosa, muito didática e paciente";
    if (toneStyle === "animado") {
      stylePrompt = "tom super animado, alegre, celebrativo, sorridente e empolgante";
    } else if (toneStyle === "suave") {
      stylePrompt = "tom extremamente suave, calmo, doce e acolhedor";
    } else if (toneStyle === "fônico") {
      stylePrompt = "tom fônico analítico, focando na pronúncia silábica e nos sons puros isolados";
    }

    // Clean text by stripping manual formatting tags
    const cleanText = textToSpeak.replace(/\[.*?\]\s*/g, "");

    let phoneticInstruction = "";
    if (asset.pureSoundMode || toneStyle === "fônico" || cleanText.includes("...") || cleanText.length <= 4) {
      phoneticInstruction = `
- ATENÇÃO: O texto solicitado representa um FONEMA PURO, SOM DE LETRA OU SÍLABA ISOLADA (sons puros de consoantes para alfabetização fônica, como /b/, /p/, /d/).
- NÃO PRONUNCIE O NOME DA LETRA (por exemplo, se o texto for "b... b...", NÃO diga "bê", diga apenas o som puro explosivo /b/.../b/.../b/).
- Se o texto contiver reticências "...", interprete como pequenas pausas para pronunciar o fonema repetidas vezes.
- Se o texto for "rrrrr", reproduza o som forte e prolongado da letra R raspada (como em 'rato').
- Se o texto for "sssss", reproduza o som de sopro prolongado do S (como em 'sapo').
- Se o texto for "chhhhh", reproduza o som prolongado de CH/X (como em 'chave').
- Fale de forma limpa, clara e isolada, sem explicar o que está fazendo.`;
    }

    const prompt = `Fale exatamente o seguinte texto em português (Brasil): "${cleanText}".
Instruções importantes:
- Use a persona de voz correspondente.
- Tom de fala: ${stylePrompt}.
- Ritmo: ${speedPrompt}.${phoneticInstruction}
Não adicione nenhuma palavra extra, nenhuma saudação nem comentário de introdução ou conclusão. Fale estritamente e exatamente apenas o texto solicitado.`;

    const response = await generateTTSWithRetry(ai, prompt, voiceName);

    let base64Audio: string | undefined;
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
      if (base64Audio) break;
    }

    if (!base64Audio) {
      console.error("Gemini TTS response structure details:", JSON.stringify(response, null, 2));
      const firstCandidate = response.candidates?.[0];
      if (firstCandidate?.finishReason && firstCandidate.finishReason !== "STOP") {
        throw new Error(`Gemini TTS generation did not complete successfully (Finish Reason: ${firstCandidate.finishReason})`);
      }
      throw new Error("No audio data returned from Gemini TTS. Please verify your prompt content and try again.");
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = addWavHeader(pcmBuffer, 24000);

    // Save persistent audio WAV file to disk
    fs.writeFileSync(path.join(AUDIO_DIR, `${id}.wav`), wavBuffer);
    audioBuffers.set(id, wavBuffer);

    asset.status = "completed";
    asset.audioUrl = `/api/audio/${id}`;
    saveAssets();

    res.json({ success: true, asset });
  } catch (error: any) {
    console.error(`Error generating audio for ${id}:`, error);
    asset.status = "failed";
    saveAssets();

    const errorMsg = error?.message || "";
    if (
      errorMsg.includes("429") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      error?.status === "RESOURCE_EXHAUSTED" ||
      error?.code === 429
    ) {
      let retryDelaySec = 60; // default to 60 seconds
      try {
        const rawErrorStr = JSON.stringify(error);
        const matchSeconds = errorMsg.match(/Please retry in ([\d\.]+)s/i) || rawErrorStr.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
        if (matchSeconds && matchSeconds[1]) {
          retryDelaySec = Math.ceil(parseFloat(matchSeconds[1]));
        }
      } catch (e) {
        console.error("Failed to parse retryDelay from error:", e);
      }

      return res.status(429).json({
        error: "Limite de cota de áudio excedido no Gemini TTS para a chave gratuita atual (Código 429). Por favor, aguarde cerca de 1 minuto antes de gerar novos áudios, ou utilize uma chave de API paga/faturada para obter requisições ilimitadas.",
        isQuotaExceeded: true,
        retryDelaySec,
      });
    }

    res.status(500).json({ error: error.message || "Failed to generate audio" });
  }
});

// Serve the generated audio WAV file (with disk reading fallback)
app.get("/api/audio/:id", (req, res) => {
  const { id } = req.params;
  let buffer = audioBuffers.get(id);

  if (!buffer) {
    const audioFilePath = path.join(AUDIO_DIR, `${id}.wav`);
    if (fs.existsSync(audioFilePath)) {
      try {
        buffer = fs.readFileSync(audioFilePath);
        audioBuffers.set(id, buffer); // Cache in-memory
      } catch (error) {
        console.error(`Failed to read audio file for ${id} from disk:`, error);
      }
    }
  }

  if (!buffer) {
    return res.status(404).send("Audio not found or not yet generated");
  }

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Disposition", `attachment; filename="${id}.wav"`);
  res.send(buffer);
});

// Download all generated audios as a ZIP file
app.get("/api/assets/download-zip", (req, res) => {
  try {
    const zip = new AdmZip();
    let fileCount = 0;

    // Add db.json metadata to the ZIP
    if (fs.existsSync(DB_FILE)) {
      zip.addLocalFile(DB_FILE, undefined, "db.json");
    }

    for (const asset of assets) {
      if (asset.status === "completed") {
        const audioFilePath = path.join(AUDIO_DIR, `${asset.id}.wav`);
        if (fs.existsSync(audioFilePath)) {
          zip.addLocalFile(audioFilePath, undefined, asset.file_name);
          fileCount++;
        }
      }
    }

    if (fileCount === 0) {
      return res.status(400).send("Nenhum áudio gerado disponível para download. Por favor, gere pelo menos um áudio primeiro.");
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="luna_studio_audios.zip"');
    res.send(zipBuffer);
  } catch (error: any) {
    console.error("Erro ao criar arquivo ZIP de áudios:", error);
    res.status(500).send("Erro interno ao empacotar os arquivos de áudio.");
  }
});

// Helper for dynamic caching hashes
function getStringHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "dyn_" + Math.abs(hash).toString(16);
}

// On-demand dynamic TTS generation microservice endpoint
app.get("/api/audio/dynamic", async (req, res) => {
  const text = (req.query.text as string || "").trim();
  const voiceName = (req.query.voiceName as string || "Kore").trim();
  const speed = (req.query.speed as string || "lento").trim();
  const toneStyle = (req.query.toneStyle as string || "didático").trim();

  if (!text) {
    return res.status(400).send("O parâmetro 'text' é obrigatório para geração dinâmica.");
  }

  const cacheKey = getStringHash(`${text}_${voiceName}_${speed}_${toneStyle}`);
  let buffer = audioBuffers.get(cacheKey);

  if (!buffer) {
    const audioFilePath = path.join(AUDIO_DIR, `${cacheKey}.wav`);
    if (fs.existsSync(audioFilePath)) {
      try {
        buffer = fs.readFileSync(audioFilePath);
        audioBuffers.set(cacheKey, buffer);
      } catch (e) {
        console.error("Erro ao ler áudio dinâmico do disco:", e);
      }
    }
  }

  if (buffer) {
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `inline; filename="${cacheKey}.wav"`);
    return res.send(buffer);
  }

  if (!ai) {
    return res.status(503).send("Serviço de IA não configurado (sem chave de API).");
  }

  try {
    let speedPrompt = "fale de forma lenta, pausada e muito articulada, ideal para alfabetização infantil";
    if (speed === "normal") {
      speedPrompt = "fale com velocidade e ritmo natural";
    } else if (speed === "rápido") {
      speedPrompt = "fale com ritmo rápido, dinâmico e fluido";
    }

    let stylePrompt = "tom de professora carinhosa, muito didática e paciente";
    if (toneStyle === "animado") {
      stylePrompt = "tom super animado, alegre, celebrativo, sorridente e empolgante";
    } else if (toneStyle === "suave") {
      stylePrompt = "tom extremamente suave, calmo, doce e acolhedor";
    } else if (toneStyle === "fônico") {
      stylePrompt = "tom fônico analítico, focando na pronúncia silábica e nos sons puros isolados";
    }

    const cleanText = text.replace(/\[.*?\]\s*/g, "");

    const prompt = `Fale exatamente o seguinte texto em português (Brasil): "${cleanText}".
Instruções importantes:
- Use a persona de voz correspondente.
- Tom de fala: ${stylePrompt}.
- Ritmo: ${speedPrompt}.
Não adicione nenhuma palavra extra, nenhuma saudação nem comentário de introdução ou conclusão. Fale estritamente e exatamente apenas o texto solicitado.`;

    const response = await generateTTSWithRetry(ai, prompt, voiceName);

    let base64Audio: string | undefined;
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
      if (base64Audio) break;
    }

    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini TTS");
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = addWavHeader(pcmBuffer, 24000);

    fs.writeFileSync(path.join(AUDIO_DIR, `${cacheKey}.wav`), wavBuffer);
    audioBuffers.set(cacheKey, wavBuffer);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `inline; filename="${cacheKey}.wav"`);
    res.send(wavBuffer);
  } catch (error: any) {
    console.error("Erro na geração dinâmica de áudio:", error);
    const errorMsg = error?.message || "";
    if (
      errorMsg.includes("429") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      error?.status === "RESOURCE_EXHAUSTED" ||
      error?.code === 429
    ) {
      return res.status(429).send("Limite de cota de áudio excedido no Gemini TTS (Código 429). Aguarde cerca de 1 a 2 minutos ou use uma chave de API faturada.");
    }
    res.status(500).send(`Erro ao gerar áudio por IA: ${error.message || "Erro desconhecido"}`);
  }
});

// Vite Integration Middleware Setup and Server Start
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start the server:", err);
});
