import React, { useState } from "react";
import { Play, Pause, Edit2, Check, X, RefreshCw, AlertCircle, Download, FileAudio, Settings, Volume2, Mic } from "lucide-react";
import { AudioAsset } from "../types";

interface AudioItemRowProps {
  asset: AudioAsset;
  onUpdate: (id: string, updatedFields: Partial<AudioAsset>) => Promise<void>;
  onGenerate: (id: string) => Promise<void>;
  hasApiKey: boolean;
}

export default function AudioItemRow({ asset, onUpdate, onGenerate, hasApiKey }: AudioItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(asset.text_to_speak);
  const [editFileName, setEditFileName] = useState(asset.file_name);
  const [editDifficulty, setEditDifficulty] = useState(asset.difficulty);
  
  // Customization states
  const [editVoiceName, setEditVoiceName] = useState<AudioAsset["voiceName"]>(asset.voiceName || "Kore");
  const [editSpeed, setEditSpeed] = useState<AudioAsset["speed"]>(asset.speed || "lento");
  const [editToneStyle, setEditToneStyle] = useState<AudioAsset["toneStyle"]>(asset.toneStyle || "didático");
  const [editPureSoundMode, setEditPureSoundMode] = useState<boolean>(asset.pureSoundMode || false);
  const [editPureSoundText, setEditPureSoundText] = useState<string>(asset.pureSoundText || "");

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handleSave = async () => {
    await onUpdate(asset.id, {
      text_to_speak: editText,
      file_name: editFileName,
      difficulty: editDifficulty,
      voiceName: editVoiceName,
      speed: editSpeed,
      toneStyle: editToneStyle,
      pureSoundMode: editPureSoundMode,
      pureSoundText: editPureSoundText,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(asset.text_to_speak);
    setEditFileName(asset.file_name);
    setEditDifficulty(asset.difficulty);
    setEditVoiceName(asset.voiceName || "Kore");
    setEditSpeed(asset.speed || "lento");
    setEditToneStyle(asset.toneStyle || "didático");
    setEditPureSoundMode(asset.pureSoundMode || false);
    setEditPureSoundText(asset.pureSoundText || "");
    setIsEditing(false);
  };

  const playLocalSpeech = (text: string) => {
    const cleanText = text.replace(/\[.*?\]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    
    // Convert slow speed for browser speech
    if (editSpeed === "lento") {
      utterance.rate = 0.65;
    } else if (editSpeed === "rápido") {
      utterance.rate = 1.2;
    } else {
      utterance.rate = 0.95;
    }

    utterance.pitch = editToneStyle === "animado" ? 1.3 : editToneStyle === "suave" ? 0.9 : 1.1;

    const voices = window.speechSynthesis.getVoices();
    const brVoice = voices.find(
      (v) => v.lang === "pt-BR" || v.lang.includes("Brazil") || v.lang.startsWith("pt")
    );
    if (brVoice) {
      utterance.voice = brVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = () => {
    if (isPlaying) {
      if (audioElement) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      }
      return;
    }

    if (asset.audioUrl) {
      if (asset.audioUrl.startsWith("fallback://")) {
        const text = decodeURIComponent(asset.audioUrl.replace("fallback://", ""));
        playLocalSpeech(text);
      } else {
        const urlWithCacheBuster = `${asset.audioUrl}?t=${Date.now()}`;
        const audio = new Audio(urlWithCacheBuster);
        setAudioElement(audio);
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.error("Audio playback failed, attempting fallback speech synthesis:", err);
          const speakText = asset.pureSoundMode ? (asset.pureSoundText || asset.text_to_speak) : asset.text_to_speak;
          playLocalSpeech(speakText);
        });

        audio.onended = () => {
          setIsPlaying(false);
          setAudioElement(null);
        };
      }
    } else {
      const speakText = asset.pureSoundMode ? (asset.pureSoundText || asset.text_to_speak) : asset.text_to_speak;
      playLocalSpeech(speakText);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "fácil":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "médio":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "difícil":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: "Gerado",
          classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "generating":
        return {
          label: "Gerando...",
          classes: "bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse",
        };
      case "failed":
        return {
          label: "Falhou",
          classes: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "pending":
      default:
        return {
          label: "Pendente",
          classes: "bg-[#18181b] text-[#71717a] border-[#27272a]",
        };
    }
  };

  const statusConfig = getStatusConfig(asset.status);

  return (
    <div
      id={`audio-item-${asset.id}`}
      className="bg-[#0c0c0c] border border-[#27272a] rounded-xl p-5 hover:border-[#c5a059]/40 transition-all shadow-sm text-[#d4d4d8]"
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <span className="text-xs font-mono text-[#c5a059] font-bold uppercase">{asset.id}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded bg-[#c5a059] hover:bg-[#e2c28a] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] border border-[#27272a] text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Nome do Arquivo (.wav)</label>
              <input
                type="text"
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] font-mono focus:border-[#c5a059] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Dificuldade</label>
              <select
                value={editDifficulty}
                onChange={(e) => setEditDifficulty(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
              >
                <option value="fácil">Fácil</option>
                <option value="médio">Médio</option>
                <option value="difícil">Difícil</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Modelo de Voz (Persona)</label>
              <select
                value={editVoiceName}
                onChange={(e) => setEditVoiceName(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
              >
                <option value="Kore">Luna (Feminino - Caloroso / Padrão)</option>
                <option value="Aoede">Suave (Feminino - Calmo / Acolhedor)</option>
                <option value="Puck">Jovial (Feminino/Infantil - Alegre)</option>
                <option value="Charon">Professor (Masculino - Maduro)</option>
                <option value="Fenrir">Instrutor (Masculino - Jovem)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Velocidade da Voz</label>
              <select
                value={editSpeed}
                onChange={(e) => setEditSpeed(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
              >
                <option value="lento">Lento (Alfabetização)</option>
                <option value="normal">Normal (Natural)</option>
                <option value="rápido">Rápido (Dinâmico)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Tom & Entonação</label>
              <select
                value={editToneStyle}
                onChange={(e) => setEditToneStyle(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
              >
                <option value="didático">Didático / Pedagógico</option>
                <option value="animado">Animado / Alegre (Feedbacks)</option>
                <option value="suave">Suave / Tranquilo</option>
                <option value="fônico">Pronúncia Fônica (Foco no Som)</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 bg-[#0a0a0a] border border-[#27272a] rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c5a059] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" /> Modo de Saída Sonora
              </span>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPureSoundMode}
                  onChange={(e) => setEditPureSoundMode(e.target.checked)}
                  className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#18181b] cursor-pointer"
                />
                <span className="text-xs font-bold text-[#f4f4f5]">Habilitar Apenas Som Puro</span>
              </label>
            </div>
            <p className="text-[10px] text-[#71717a] leading-relaxed">
              *Habilite "Apenas Som Puro" para gerar apenas a pronúncia isolada do fonema/sílaba para o app Matemágica, removendo a frase didática introdutória.
            </p>

            {editPureSoundMode ? (
              <div className="pt-2 animate-fadeIn">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#c5a059] mb-1">Som Puro Isolado a Pronunciar</label>
                <input
                  type="text"
                  value={editPureSoundText}
                  onChange={(e) => setEditPureSoundText(e.target.value)}
                  placeholder="Ex: aaa! ou BA!"
                  className="w-full bg-[#18181b] border border-[#c5a059]/40 rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                />
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Frase Explicativa Completa (Luna Script)</label>
                <textarea
                  rows={2}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a]/50 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-[#c5a059] font-bold uppercase">{asset.id}</span>
              <span className="text-[#27272a] text-xs">•</span>
              <span className="text-[10px] font-mono text-[#a1a1aa] bg-[#0a0a0a] px-2.5 py-0.5 rounded border border-[#27272a]">
                {asset.file_name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {asset.pureSoundMode && (
                <span className="text-[9px] px-2 py-0.5 bg-[#c5a059]/10 text-[#c5a059] border border-[#c5a059]/20 rounded font-bold uppercase tracking-wider">
                  Som Puro
                </span>
              )}
              <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getDifficultyColor(asset.difficulty)}`}>
                {asset.difficulty}
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${statusConfig.classes}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>

          <div className="relative text-sm text-[#a1a1aa] bg-[#0a0a0a] p-4 rounded-lg border border-[#27272a]/50 leading-relaxed font-sans min-h-[50px] flex flex-col justify-between gap-3">
            <div className="font-medium text-[#e4e4e7]">
              {asset.pureSoundMode ? (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#71717a] block">Som Puro:</span>
                  <span className="text-[#c5a059] text-base font-serif italic">"{asset.pureSoundText || asset.id}"</span>
                </div>
              ) : (
                asset.text_to_speak
              )}
            </div>

            {/* Config indicator badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#27272a]/20 text-[9px] font-mono text-[#71717a]">
              <span className="uppercase font-bold text-[#a1a1aa]">Voz:</span>
              <span className="bg-[#18181b] px-1.5 py-0.5 rounded text-[#d4d4d8]">{asset.voiceName || "Luna (Kore)"}</span>
              <span className="uppercase font-bold text-[#a1a1aa] ml-2">Velocidade:</span>
              <span className="bg-[#18181b] px-1.5 py-0.5 rounded text-[#d4d4d8]">{asset.speed || "lenta"}</span>
              <span className="uppercase font-bold text-[#a1a1aa] ml-2">Estilo:</span>
              <span className="bg-[#18181b] px-1.5 py-0.5 rounded text-[#d4d4d8]">{asset.toneStyle || "didático"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlay}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isPlaying
                    ? "bg-[#c5a059] text-black shadow-lg shadow-[#c5a059]/20"
                    : "bg-[#f4f4f5] hover:bg-white text-black shadow-sm"
                }`}
                title={isPlaying ? "Pausar Áudio" : asset.status === "completed" ? "Ouvir Áudio" : "Preview com Síntese do Navegador"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
              </button>

              {asset.status === "completed" && !asset.audioUrl?.startsWith("fallback://") && (
                <a
                  href={asset.audioUrl}
                  download={asset.file_name}
                  className="w-9 h-9 rounded-full bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center justify-center transition-all cursor-pointer"
                  title="Baixar arquivo de áudio"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}

              <button
                onClick={() => setIsEditing(true)}
                className="w-9 h-9 rounded-full bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center justify-center transition-all cursor-pointer"
                title="Personalizar Áudio e Voz"
                disabled={asset.status === "generating"}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => onGenerate(asset.id)}
              disabled={asset.status === "generating"}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                asset.status === "completed"
                  ? "bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] border-[#27272a]"
                  : "bg-[#f4f4f5] hover:bg-white text-black border-transparent"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${asset.status === "generating" ? "animate-spin" : ""}`} />
              <span>{asset.status === "completed" ? "Regerar" : "Gerar com IA"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
