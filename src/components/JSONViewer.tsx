import React, { useState } from "react";
import { FileCode, Copy, Check, Download, Info, CheckCircle } from "lucide-react";
import { AudioAsset } from "../types";

interface JSONViewerProps {
  assets: AudioAsset[];
}

export default function JSONViewer({ assets }: JSONViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Map state assets to the clean format specified by the user, including new features
  const cleanJSONList = assets.map((asset) => ({
    id: asset.id,
    category: asset.category,
    text_to_speak: asset.text_to_speak,
    file_name: asset.file_name,
    difficulty: asset.difficulty,
    voiceName: asset.voiceName || "Kore",
    speed: asset.speed || "lento",
    toneStyle: asset.toneStyle || "didático",
    pureSoundMode: asset.pureSoundMode || false,
    pureSoundText: asset.pureSoundText || "",
    status: asset.status,
  }));

  const jsonString = JSON.stringify(cleanJSONList, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "luna_audio_assets_manifest.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0c0c0c] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl text-[#d4d4d8] space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-[#27272a] bg-[#0d0d0d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c5a059]/10 flex items-center justify-center border border-[#c5a059]/20">
            <FileCode className="w-4 h-4 text-[#c5a059]" />
          </div>
          <div>
            <h3 className="font-serif italic text-sm text-[#f4f4f5]">JSON do Módulo</h3>
            <p className="text-[10px] uppercase text-[#71717a] font-bold tracking-widest">Exportação em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-xs font-semibold transition-all cursor-pointer"
            title="Mostrar Guia de Integração para Matemágica"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Guia</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-xs font-semibold transition-all cursor-pointer"
            title="Copiar para a área de transferência"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#f4f4f5] hover:bg-white text-black text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            title="Baixar arquivo JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar JSON</span>
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="p-5 bg-[#121214]/60 border-b border-[#27272a] text-xs text-[#a1a1aa] space-y-3 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-[#c5a059] font-bold uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#c5a059]" />
            <span>Guia de Integração • Matemágica (Português)</span>
          </div>
          <p className="leading-relaxed">
            Este arquivo JSON funciona como o **Script de Mapeamento oficial** para integrar os áudios gerados no seu aplicativo principal:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
            <li>
              <strong>Nomenclatura Limpa:</strong> Cada áudio possui o campo <code className="bg-[#0a0a0a] px-1 py-0.5 rounded text-[#c5a059] font-mono">file_name</code> exatamente correspondente à sua respectiva chave de ID.
            </li>
            <li>
              <strong>Exportação Fácil:</strong> Baixe este JSON e salve-o na pasta de assets do seu outro app como <code className="bg-[#0a0a0a] px-1 py-0.5 rounded text-[#c5a059] font-mono">audio-manifest.json</code>.
            </li>
            <li>
              <strong>Conexão 1:1:</strong> No código do seu jogo de alfabetização (Matemágica), use o ID correspondente ao fonema ou sílaba ativa na tela para reproduzir diretamente o arquivo de áudio correto (ex: <code className="bg-[#0a0a0a] px-1 py-0.5 rounded text-[#c5a059] font-mono">playAudio(manifest["fon_a"].file_name)</code>).
            </li>
          </ul>
        </div>
      )}

      <div className="p-6 bg-[#0a0a0a] font-mono text-xs overflow-auto max-h-[350px] text-[#e2c28a]">
        <pre className="whitespace-pre-wrap select-all">{jsonString}</pre>
      </div>
    </div>
  );
}
