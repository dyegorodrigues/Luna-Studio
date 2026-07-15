import React, { useState } from "react";
import { Mic, Volume2, Sparkles, AlertCircle, Wand2, Layers, Check, CheckCircle2, Sliders, Play, Pause, Loader2, HelpCircle, FileText, Info } from "lucide-react";
import { AudioAsset } from "../types";

interface LunaConfigCardProps {
  hasApiKey: boolean;
  assets: AudioAsset[];
  onBulkUpdate: (updatedAssets: AudioAsset[]) => void;
}

interface Preset {
  id: string;
  name: string;
  icon: string;
  description: string;
  voiceName: "Kore" | "Aoede" | "Puck" | "Charon" | "Fenrir";
  speed: "lento" | "normal" | "rápido";
  toneStyle: "didático" | "animado" | "suave" | "fônico";
  pureSoundMode: boolean;
}

const PRESETS: Preset[] = [
  {
    id: "fonemas_lento",
    name: "Matemágica - Fonemas Puros",
    icon: "✨",
    description: "Voz isolada, lenta e com tom fônico analítico. Habilita o modo de Som Puro ideal para o aprendizado das letras no Matemágica.",
    voiceName: "Kore",
    speed: "lento",
    toneStyle: "fônico",
    pureSoundMode: true,
  },
  {
    id: "silabas_didatico",
    name: "Matemágica - Sílabas & Palavras",
    icon: "📚",
    description: "Voz didática pedagógica e lenta da Luna. Ideal para juntar sílabas e leitura de palavras de alta frequência.",
    voiceName: "Kore",
    speed: "lento",
    toneStyle: "didático",
    pureSoundMode: false,
  },
  {
    id: "charon_instrutivo",
    name: "Professor Charon - Narrador",
    icon: "🎓",
    description: "Tom professoral maduro e focado, ideal para ditar instruções, regras do jogo e narrativas explicativas.",
    voiceName: "Charon",
    speed: "normal",
    toneStyle: "didático",
    pureSoundMode: false,
  },
  {
    id: "puck_alegre",
    name: "Puck Alegre - Feedbacks",
    icon: "🎉",
    description: "Voz infantil/jovem e entusiasmada. Perfeita para comemorações, sons de acerto, elogios e incentivos divertidos.",
    voiceName: "Puck",
    speed: "normal",
    toneStyle: "animado",
    pureSoundMode: false,
  },
  {
    id: "aoede_suave",
    name: "Aoede Calma - Histórias",
    icon: "🌸",
    description: "Voz feminina suave, calma e acolhedora. Ideal para contação de historinhas de fundo e momentos relaxantes.",
    voiceName: "Aoede",
    speed: "lento",
    toneStyle: "suave",
    pureSoundMode: false,
  },
  {
    id: "fenrir_dinamico",
    name: "Fenrir Jovem - Instruções",
    icon: "⚡",
    description: "Voz masculina jovem e com ritmo natural e dinâmico. Ótimo para narrar missões e interações rápidas.",
    voiceName: "Fenrir",
    speed: "normal",
    toneStyle: "didático",
    pureSoundMode: false,
  },
];

export default function LunaConfigCard({ hasApiKey, assets, onBulkUpdate }: LunaConfigCardProps) {
  const [activeTab, setActiveTab] = useState<"presets" | "voiceSandbox" | "info">("presets");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("fonemas_lento");

  // Custom configurations (inherits from selected preset, but editable!)
  const [customVoice, setCustomVoice] = useState<Preset["voiceName"]>("Kore");
  const [customSpeed, setCustomSpeed] = useState<Preset["speed"]>("lento");
  const [customTone, setCustomTone] = useState<Preset["toneStyle"]>("fônico");
  const [customPureSound, setCustomPureSound] = useState<boolean>(true);

  // Target scope: "all" or specific category
  const [targetScope, setTargetScope] = useState<string>("all");
  
  // Status feedback states
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Voice Sandbox/Tester States
  const [sandboxVoice, setSandboxVoice] = useState<Preset["voiceName"]>("Kore");
  const [sandboxSpeed, setSandboxSpeed] = useState<Preset["speed"]>("lento");
  const [sandboxTone, setSandboxTone] = useState<Preset["toneStyle"]>("didático");
  const [sandboxText, setSandboxText] = useState("O som da letra B é b!");
  const [isGeneratingSandbox, setIsGeneratingSandbox] = useState(false);
  const [sandboxPlaying, setSandboxPlaying] = useState(false);
  const [sandboxAudio, setSandboxAudio] = useState<HTMLAudioElement | null>(null);

  // Handle Preset Selection
  const handleSelectPreset = (preset: Preset) => {
    setSelectedPresetId(preset.id);
    setCustomVoice(preset.voiceName);
    setCustomSpeed(preset.speed);
    setCustomTone(preset.toneStyle);
    setCustomPureSound(preset.pureSoundMode);
  };

  // Handle Custom Override Indicator
  const handleCustomOverride = (field: string, value: any) => {
    setSelectedPresetId("custom");
    if (field === "voice") setCustomVoice(value);
    if (field === "speed") setCustomSpeed(value);
    if (field === "tone") setCustomTone(value);
    if (field === "pure") setCustomPureSound(value);
  };

  // Run Bulk Update on Server
  const handleApplyPreset = async () => {
    setIsUpdating(true);
    setSuccessMessage(null);

    // Filter target IDs based on targetScope
    let targetAssets = assets;
    if (targetScope !== "all") {
      targetAssets = assets.filter((a) => a.category === targetScope);
    }

    const targetIds = targetAssets.map((a) => a.id);

    if (targetIds.length === 0) {
      alert("Nenhum áudio encontrado na categoria selecionada para aplicar o preset.");
      setIsUpdating(false);
      return;
    }

    try {
      const res = await fetch("/api/assets/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: targetIds,
          voiceName: customVoice,
          speed: customSpeed,
          toneStyle: customTone,
          pureSoundMode: customPureSound,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onBulkUpdate(data.assets);
        setSuccessMessage(
          `✓ Preset aplicado com sucesso em ${data.updatedCount} de ${targetIds.length} áudios da categoria "${
            targetScope === "all" ? "Todos" : targetScope
          }".`
        );
        setTimeout(() => setSuccessMessage(null), 8000);
      } else {
        alert(`Erro ao aplicar preset: ${data.error}`);
      }
    } catch (err) {
      console.error("Erro na atualização em lote:", err);
      alert("Falha de conexão ao aplicar preset em lote.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Play browser synthesis test
  const handlePlayLocalSandbox = (textToSpeak: string, voice: Preset["voiceName"], speed: Preset["speed"], tone: Preset["toneStyle"]) => {
    if (sandboxPlaying) {
      window.speechSynthesis.cancel();
      if (sandboxAudio) {
        sandboxAudio.pause();
        setSandboxAudio(null);
      }
      setSandboxPlaying(false);
      return;
    }

    const cleanText = textToSpeak.replace(/\[.*?\]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    
    // Convert speed config
    if (speed === "lento") {
      utterance.rate = 0.65;
    } else if (speed === "rápido") {
      utterance.rate = 1.25;
    } else {
      utterance.rate = 0.95;
    }

    // Attempt pitch matching
    let pitch = 1.0;
    if (voice === "Kore") pitch = 1.05;
    else if (voice === "Aoede") pitch = 0.9;
    else if (voice === "Puck") pitch = 1.35;
    else if (voice === "Charon") pitch = 0.75;
    else if (voice === "Fenrir") pitch = 0.95;

    if (tone === "animado") pitch += 0.15;
    else if (tone === "suave") pitch -= 0.1;

    utterance.pitch = pitch;

    const voices = window.speechSynthesis.getVoices();
    const brVoice = voices.find(
      (v) => v.lang === "pt-BR" || v.lang.includes("Brazil") || v.lang.startsWith("pt")
    );
    if (brVoice) {
      utterance.voice = brVoice;
    }

    utterance.onstart = () => setSandboxPlaying(true);
    utterance.onend = () => setSandboxPlaying(false);
    utterance.onerror = () => setSandboxPlaying(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Play high-fidelity dynamic Gemini TTS
  const handlePlayRealSandbox = async (textToSpeak: string, voice: Preset["voiceName"], speed: Preset["speed"], tone: Preset["toneStyle"]) => {
    if (sandboxPlaying) {
      if (sandboxAudio) {
        sandboxAudio.pause();
        setSandboxAudio(null);
      }
      setSandboxPlaying(false);
      return;
    }

    setIsGeneratingSandbox(true);
    try {
      const url = `/api/audio/dynamic?text=${encodeURIComponent(textToSpeak)}&voiceName=${voice}&speed=${speed}&toneStyle=${tone}&t=${Date.now()}`;
      const audio = new Audio(url);
      setSandboxAudio(audio);
      
      await audio.play();
      setSandboxPlaying(true);
      
      audio.onended = () => {
        setSandboxPlaying(false);
        setSandboxAudio(null);
      };
    } catch (e) {
      console.error("Erro ao reproduzir áudio dinâmico do Gemini:", e);
      alert("Não foi possível gerar a prévia com a IA em tempo real. Verifique se a sua GEMINI_API_KEY está configurada.");
    } finally {
      setIsGeneratingSandbox(false);
    }
  };

  return (
    <div className="bg-[#0c0c0c] border border-[#27272a] text-[#d4d4d8] rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#c5a059]/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#c5a059]/5 rounded-full blur-3xl"></div>

      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6 relative z-10 border-b border-[#27272a]/60 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#c5a059] flex items-center justify-center shadow-lg shadow-[#c5a059]/10 shrink-0">
            <Mic className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-serif italic text-[#f4f4f5]">Painel de Voz & Configuração Geral</h2>
            <p className="text-[#71717a] text-xs uppercase tracking-wider">Ajuste em lote, Sandbox de Prévia de Voz e microserviços</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap bg-[#18181b] p-1 rounded-lg border border-[#27272a] shrink-0 gap-1 sm:gap-0">
          <button
            onClick={() => setActiveTab("presets")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "presets"
                ? "bg-[#c5a059] text-black"
                : "text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            Templates em Lote
          </button>
          <button
            onClick={() => setActiveTab("voiceSandbox")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "voiceSandbox"
                ? "bg-[#c5a059] text-black"
                : "text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            Amostras & Sandbox de Voz
          </button>
          <button
            onClick={() => setActiveTab("info")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "info"
                ? "bg-[#c5a059] text-black"
                : "text-[#a1a1aa] hover:text-[#f4f4f5]"
            }`}
          >
            Manual & Integração
          </button>
        </div>
      </div>

      {activeTab === "info" ? (
        <div className="space-y-6 relative z-10 animate-fadeIn text-sm">
          {/* Quick specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
              <span className="text-[10px] uppercase text-[#c5a059] font-bold tracking-widest block mb-1">Luna (Padrão)</span>
              <p className="text-sm text-[#f4f4f5] font-medium">Feminina, calorosa, didática</p>
            </div>
            <div className="bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
              <span className="text-[10px] uppercase text-[#c5a059] font-bold tracking-widest block mb-1">Velocidades</span>
              <p className="text-sm text-[#f4f4f5] font-medium">Lento, Normal e Rápido</p>
            </div>
            <div className="bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
              <span className="text-[10px] uppercase text-[#c5a059] font-bold tracking-widest block mb-1">Entonações</span>
              <p className="text-sm text-[#f4f4f5] font-medium">Didática, Animada, Suave, Fônica</p>
            </div>
            <div className="bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
              <span className="text-[10px] uppercase text-[#c5a059] font-bold tracking-widest block mb-1">Formato de Saída</span>
              <p className="text-sm text-[#f4f4f5] font-medium">WAV 16-bit 24kHz Mono</p>
            </div>
          </div>

          {/* Integration Manual Content */}
          <div className="bg-[#18181b]/50 border border-[#27272a] rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-serif italic text-[#f4f4f5] flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-[#c5a059]" />
                Manual de Integração de Microserviços (Luna TTS Engine)
              </h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Este aplicativo funciona como um **motor acessório de microserviço** projetado para servir áudios didáticos e gerar locuções sob demanda para o jogo **Matemágica**. Ele gerencia as gravações, organiza os fonemas puros e permite a geração dinâmica por IA em tempo real de forma extremamente leve e performática.
              </p>
            </div>

            <div className="border-t border-[#27272a]/40 pt-4 space-y-4">
              <span className="text-xs uppercase font-bold text-[#c5a059] block tracking-wider">1. Fluxo de Consulta de Áudios Estáticos</span>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Para tocar os áudios pré-configurados (como vogais, sílabas e feedbacks), o app **Matemágica** deve consumir as seguintes rotas REST:
              </p>
              <div className="bg-[#0a0a0a] border border-[#27272a] p-3 rounded font-mono text-[11px] text-[#e4e4e7] space-y-2">
                <div>
                  <span className="text-emerald-400 font-bold">GET</span> /api/assets
                  <span className="text-[#71717a] block mt-0.5">// Retorna o mapeamento de todos os áudios configurados e suas URLs de reprodução.</span>
                </div>
                <div className="pt-2 border-t border-[#27272a]/20">
                  <span className="text-emerald-400 font-bold">GET</span> /api/audio/:id
                  <span className="text-[#71717a] block mt-0.5">// Retorna o fluxo binário WAV do áudio solicitado (Ex: `/api/audio/fon_a_aberto`).</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#27272a]/40 pt-4 space-y-4">
              <span className="text-xs uppercase font-bold text-[#c5a059] block tracking-wider">2. Rota Microserviço: Geração de Áudio Dinâmica Sob Demanda</span>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Se o Matemágica precisar gerar frases em tempo real com o nome do jogador (Ex: <em>"Incrível, Pedro! Você acertou 5 de 5!"</em>), utilize a rota dinamicamente via query strings. O microserviço gera por IA e possui <strong>cache inteligente automático em disco</strong> para economizar chamadas:
              </p>
              <div className="bg-[#0a0a0a] border border-[#27272a] p-3 rounded font-mono text-[11px] text-[#e4e4e7] leading-relaxed">
                <span className="text-emerald-400 font-bold">GET</span> /api/audio/dynamic?text=<span className="text-[#c5a059]">TEXTO</span>&voiceName=<span className="text-[#c5a059]">VOZ</span>&speed=<span className="text-[#c5a059]">VELOCIDADE</span>&toneStyle=<span className="text-[#c5a059]">ESTILO</span>
                <div className="text-[10px] text-[#71717a] mt-2 space-y-1">
                  <p>• <strong className="text-zinc-400">text:</strong> O texto completo que a voz irá narrar.</p>
                  <p>• <strong className="text-zinc-400">voiceName:</strong> Kore (Luna), Aoede (Suave), Puck (Alegre), Charon (Professor), Fenrir (Instrutor).</p>
                  <p>• <strong className="text-zinc-400">speed:</strong> lento, normal, rápido.</p>
                  <p>• <strong className="text-zinc-400">toneStyle:</strong> didático, animado, suave, fônico.</p>
                </div>
              </div>

              <div className="bg-[#1e1e24]/40 border border-[#c5a059]/20 p-3.5 rounded-lg text-xs leading-relaxed text-[#c5a059]">
                <strong>Exemplo Prático de Integração em Javascript / React (no Matemágica):</strong>
                <pre className="mt-2 text-[10px] font-mono bg-[#0d0d11] p-2.5 rounded border border-[#27272a] overflow-x-auto text-zinc-300">
{`// Função utilitária de som dinâmico no Matemágica
function playDynamicFeedback(nome, pontuacao) {
  const frase = \`Parabéns, \${nome}! Você conquistou \${pontuacao} estrelas!\`;
  
  // URL apontando para este microserviço
  const audioUrl = \`http://localhost:3000/api/audio/dynamic?text=\${encodeURIComponent(frase)}&voiceName=Puck&speed=normal&toneStyle=animado\`;
  
  const audio = new Audio(audioUrl);
  audio.play();
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "voiceSandbox" ? (
        <div className="space-y-6 relative z-10 animate-fadeIn text-sm">
          {/* Voice Preview Tester Component */}
          <div className="bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 space-y-5">
            <div>
              <h3 className="text-sm uppercase tracking-wider font-bold text-[#c5a059] flex items-center gap-1.5 mb-1">
                <Volume2 className="w-4 h-4" /> Sandbox de Amostras de Voz
              </h3>
              <p className="text-xs text-[#71717a]">
                Experimente e teste como soam as vozes, entonações e velocidades da IA antes de aplicar aos seus arquivos em lote.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Modelo de Voz (Persona)</label>
                <select
                  value={sandboxVoice}
                  onChange={(e) => setSandboxVoice(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                >
                  <option value="Kore">Luna (Feminino - Caloroso / Padrão)</option>
                  <option value="Aoede">Suave (Feminino - Calmo / Acolhedor)</option>
                  <option value="Puck">Jovial (Feminino/Infantil - Alegre)</option>
                  <option value="Charon">Professor (Masculino - Maduro)</option>
                  <option value="Fenrir">Instrutor (Masculino - Jovem)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Velocidade</label>
                <select
                  value={sandboxSpeed}
                  onChange={(e) => setSandboxSpeed(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                >
                  <option value="lento">Lento (Alfabetização)</option>
                  <option value="normal">Normal (Natural)</option>
                  <option value="rápido">Rápido (Dinâmico)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Tom / Estilo</label>
                <select
                  value={sandboxTone}
                  onChange={(e) => setSandboxTone(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                >
                  <option value="didático">Didático / Pedagógico</option>
                  <option value="animado">Animado / Alegre (Feedbacks)</option>
                  <option value="suave">Suave / Tranquilo</option>
                  <option value="fônico">Pronúncia Fônica (Foco no Som)</option>
                </select>
              </div>
            </div>

            {/* Sandbox custom text */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a]">Texto de Teste para Falar</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSandboxText("O som da letra B é b!")}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]"
                  >
                    Fonema B
                  </button>
                  <button
                    onClick={() => setSandboxText("Parabéns! Você decifrou o enigma de forma espetacular!")}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]"
                  >
                    Acerto Alegre
                  </button>
                  <button
                    onClick={() => setSandboxText("Arraste as sílabas corretas para formar a palavra correspondente.")}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]"
                  >
                    Instrução
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded px-3.5 py-2 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                placeholder="Digite qualquer palavra, fonema ou frase para testar..."
              />
            </div>

            {/* Listen Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => handlePlayLocalSandbox(sandboxText, sandboxVoice, sandboxSpeed, sandboxTone)}
                className="flex-1 py-2.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] border border-[#27272a] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {sandboxPlaying && !sandboxAudio ? <Pause className="w-4 h-4 text-rose-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                <span>{sandboxPlaying && !sandboxAudio ? "Pausar" : "Ouvir (Voz Local Rápida)"}</span>
              </button>

              <button
                disabled={isGeneratingSandbox}
                onClick={() => handlePlayRealSandbox(sandboxText, sandboxVoice, sandboxSpeed, sandboxTone)}
                className={`flex-1 py-2.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isGeneratingSandbox
                    ? "bg-[#18181b] text-[#71717a] border border-[#27272a] cursor-not-allowed"
                    : "bg-[#f4f4f5] text-black hover:bg-white active:scale-98"
                }`}
              >
                {isGeneratingSandbox ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : sandboxPlaying && sandboxAudio ? (
                  <Pause className="w-4 h-4 text-rose-500" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-500" />
                )}
                <span>
                  {isGeneratingSandbox
                    ? "Sintetizando IA..."
                    : sandboxPlaying && sandboxAudio
                    ? "Pausar"
                    : "Ouvir com IA Real (Gemini)"}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Speedometer Comparison Area */}
          <div className="bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-bold text-[#c5a059] flex items-center gap-1.5">
                ⚡ Comparador de Velocidades da Voz Ativa
              </h4>
              <p className="text-[11px] text-[#71717a]">
                Ouça back-to-back como soa a voz selecionada (<span className="text-[#c5a059] font-bold">{sandboxVoice}</span>) em cada um de seus ritmos:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-[#18181b]/60 border border-[#27272a] rounded-lg flex flex-col justify-between h-24">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#c5a059]">🐌 Ritmo Lento</span>
                  <span className="text-[9px] font-mono bg-[#0d0d0d] px-1.5 py-0.25 rounded text-zinc-400">0.65x</span>
                </div>
                <p className="text-[11px] italic text-[#a1a1aa] line-clamp-1">"b" ... "ba"</p>
                <button
                  onClick={() => handlePlayLocalSandbox(sandboxText, sandboxVoice, "lento", sandboxTone)}
                  className="w-full mt-2 py-1 bg-[#18181b] hover:bg-[#27272a] text-[#f4f4f5] border border-[#27272a]/80 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  Testar
                </button>
              </div>

              <div className="p-3 bg-[#18181b]/60 border border-[#27272a] rounded-lg flex flex-col justify-between h-24">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-emerald-400">🚶 Ritmo Normal</span>
                  <span className="text-[9px] font-mono bg-[#0d0d0d] px-1.5 py-0.25 rounded text-emerald-400/80">1.00x</span>
                </div>
                <p className="text-[11px] italic text-[#a1a1aa] line-clamp-1">"B com A faz BA."</p>
                <button
                  onClick={() => handlePlayLocalSandbox(sandboxText, sandboxVoice, "normal", sandboxTone)}
                  className="w-full mt-2 py-1 bg-[#18181b] hover:bg-[#27272a] text-[#f4f4f5] border border-[#27272a]/80 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  Testar
                </button>
              </div>

              <div className="p-3 bg-[#18181b]/60 border border-[#27272a] rounded-lg flex flex-col justify-between h-24">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-rose-400">⚡ Ritmo Rápido</span>
                  <span className="text-[9px] font-mono bg-[#0d0d0d] px-1.5 py-0.25 rounded text-rose-400/80">1.25x</span>
                </div>
                <p className="text-[11px] italic text-[#a1a1aa] line-clamp-1">"Incrível! Próximo nível!"</p>
                <button
                  onClick={() => handlePlayLocalSandbox(sandboxText, sandboxVoice, "rápido", sandboxTone)}
                  className="w-full mt-2 py-1 bg-[#18181b] hover:bg-[#27272a] text-[#f4f4f5] border border-[#27272a]/80 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  Testar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 relative z-10 animate-fadeIn">
          {/* Quick Preset Selector Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-[#c5a059] flex items-center gap-1.5">
                <Wand2 className="w-4 h-4" /> 1. Escolha um Template Pronto
              </span>
              <span className="text-[10px] text-[#71717a] font-mono">Clique no template para atualizar todos os parâmetros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                      isSelected
                        ? "bg-[#c5a059]/10 border-[#c5a059] text-white shadow-md shadow-[#c5a059]/5"
                        : "bg-[#0d0d0d] border-[#27272a] hover:bg-[#18181b] text-[#a1a1aa] hover:text-[#f4f4f5]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label="icon">
                        {preset.icon}
                      </span>
                      <span className="font-serif italic font-semibold text-xs text-[#f4f4f5]">{preset.name}</span>
                    </div>
                    <p className="text-[10px] text-[#71717a] line-clamp-2 leading-tight mt-1 mb-auto">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c5a059] pt-1">
                      <span className="bg-[#18181b] px-1 py-0.25 rounded">{preset.voiceName}</span>
                      <span className="text-[#27272a]">•</span>
                      <span className="bg-[#18181b] px-1 py-0.25 rounded">{preset.speed}</span>
                      <span className="text-[#27272a]">•</span>
                      <span className="bg-[#18181b] px-1 py-0.25 rounded">{preset.toneStyle}</span>
                      {preset.pureSoundMode && (
                        <>
                          <span className="text-[#27272a]">•</span>
                          <span className="bg-[#c5a059]/15 text-[#c5a059] px-1 py-0.25 rounded font-bold">Puro</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration fine-tuning & Target selection */}
          <div className="bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Top: Custom Parameter override indicators */}
            <div className="lg:col-span-8 space-y-4">
              <span className="text-xs uppercase tracking-wider font-bold text-[#f4f4f5] flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#c5a059]" /> 2. Personalize ou Ajuste Manualmente
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Modelo de Voz (Persona)</label>
                  <select
                    value={customVoice}
                    onChange={(e) => handleCustomOverride("voice", e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                  >
                    <option value="Kore">Luna (Feminino - Caloroso / Padrão)</option>
                    <option value="Aoede">Suave (Feminino - Calmo / Acolhedor)</option>
                    <option value="Puck">Jovial (Feminino/Infantil - Alegre)</option>
                    <option value="Charon">Professor (Masculino - Maduro)</option>
                    <option value="Fenrir">Instrutor (Masculino - Jovem)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Velocidade da Voz</label>
                  <select
                    value={customSpeed}
                    onChange={(e) => handleCustomOverride("speed", e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                  >
                    <option value="lento">Lento (Alfabetização)</option>
                    <option value="normal">Normal (Natural)</option>
                    <option value="rápido">Rápido (Dinâmico)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Tom & Entonação</label>
                  <select
                    value={customTone}
                    onChange={(e) => handleCustomOverride("tone", e.target.value)}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                  >
                    <option value="didático">Didático / Pedagógico</option>
                    <option value="animado">Animado / Alegre (Feedbacks)</option>
                    <option value="suave">Suave / Tranquilo</option>
                    <option value="fônico">Pronúncia Fônica (Foco no Som)</option>
                  </select>
                </div>
              </div>

              {/* Pure Sound Selector for batch apply */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer bg-[#18181b]/50 p-3 rounded-lg border border-[#27272a] w-full">
                  <input
                    type="checkbox"
                    checked={customPureSound}
                    onChange={(e) => handleCustomOverride("pure", e.target.checked)}
                    className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#0a0a0a] cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#f4f4f5] block">Habilitar Apenas Som Puro em Lote</span>
                    <span className="text-[10px] text-[#71717a] block mt-0.5">
                      Gera apenas a pronúncia isolada da letra/sílaba (ex: "b", "ba"), sem frases introdutórias.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Right/Bottom: Target Scope and Apply Button */}
            <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#27272a] pt-4 lg:pt-0 lg:pl-6 space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-[#f4f4f5] flex items-center gap-1.5 mb-3">
                  <Layers className="w-4 h-4 text-[#c5a059]" /> 3. Escolha o Alvo
                </span>

                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Aplicar Filtro de Destino</label>
                <select
                  value={targetScope}
                  onChange={(e) => setTargetScope(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                >
                  <option value="all">Todos os Áudios ({assets.length})</option>
                  <option value="fonemas">Apenas Fonemas ({assets.filter(a => a.category === "fonemas").length})</option>
                  <option value="silabas">Apenas Sílabas ({assets.filter(a => a.category === "silabas").length})</option>
                  <option value="palavras">Apenas Palavras ({assets.filter(a => a.category === "palavras").length})</option>
                  <option value="instrucoes_e_feedbacks">Apenas Instruções/Feedbacks ({assets.filter(a => a.category === "instrucoes_e_feedbacks").length})</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleApplyPreset}
                  disabled={isUpdating}
                  className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isUpdating
                      ? "bg-[#18181b] text-[#71717a] border border-[#27272a] cursor-not-allowed"
                      : "bg-[#f4f4f5] text-black hover:bg-white hover:shadow-lg hover:shadow-white/5 active:scale-98"
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isUpdating ? "animate-pulse" : "translate-x-0.5"}`} />
                  <span>{isUpdating ? "Aplicando..." : "Aplicar em Lote"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Success / Feedback Alerts */}
          {successMessage && (
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4 flex gap-3 text-emerald-200/90 text-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5 text-emerald-300">Preset Aplicado com Sucesso!</span>
                {successMessage}
                <span className="block mt-1 text-[10px] text-[#71717a]">
                  *Nota: Os áudios modificados foram redefinidos para o estado **"Pendente"**. Use a seção **"Geração em Lote"** abaixo para gerar as novas locuções realistas do Gemini para todos eles de uma vez só!
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demo notice for API key fallback (placed nicely at bottom) */}
      {!hasApiKey && (
        <div className="mt-5 bg-amber-950/15 border border-amber-800/20 rounded-xl p-4 flex gap-3 text-amber-200/80 text-xs relative z-10 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5 text-amber-300">Modo de Teste / Sem Chave de API</span>
            Sem a chave <code className="bg-[#18181b] border border-[#27272a] px-1 py-0.5 rounded text-[#c5a059] font-mono text-[10px]">GEMINI_API_KEY</code>, as locuções em lote são atualizadas no banco, mas a reprodução usará a **Síntese de Voz do Navegador** respeitando fielmente as alterações de velocidade e tom personalizadas!
          </div>
        </div>
      )}
    </div>
  );
}
