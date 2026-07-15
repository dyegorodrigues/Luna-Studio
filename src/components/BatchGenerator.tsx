import React, { useState, useRef } from "react";
import {
  Sparkles,
  Play,
  StopCircle,
  CheckCircle,
  AlertCircle,
  Info,
  Layers,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  FileText,
  HelpCircle,
  CheckSquare,
  Square,
  RefreshCw,
  Clock,
  Loader2,
  Sliders,
  Wand2
} from "lucide-react";
import { AudioAsset } from "../types";

interface BatchGeneratorProps {
  assets: AudioAsset[];
  onGenerate: (id: string, overrides?: Partial<AudioAsset>) => Promise<void>;
  hasApiKey: boolean;
  onImportSuccess?: (updatedAssets: AudioAsset[]) => void;
}

export default function BatchGenerator({
  assets,
  onGenerate,
  hasApiKey,
  onImportSuccess
}: BatchGeneratorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, activeId: "" });
  const [batchLog, setBatchLog] = useState<string[]>([]);
  
  // Custom states for consistent voice/speed options
  const [activeVoice, setActiveVoice] = useState<AudioAsset["voiceName"]>("Kore");
  const [activeSpeed, setActiveSpeed] = useState<AudioAsset["speed"]>("lento");
  const [activeTone, setActiveTone] = useState<AudioAsset["toneStyle"]>("didático");
  const [activePureSound, setActivePureSound] = useState<boolean>(false);
  const [forceActiveOptions, setForceActiveOptions] = useState<boolean>(false);
  
  // Custom interactive layout toggles
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Statistics calculations for the completion checklist
  const totalCount = assets.length;
  const completedCount = assets.filter((a) => a.status === "completed").length;
  const pendingCount = totalCount - completedCount;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filter assets based on "Show Only Pending" state
  const displayedAssets = showOnlyPending
    ? assets.filter((a) => a.status !== "completed")
    : assets;

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 25) {
        alert("Por questões de limites e estabilidade, recomendamos selecionar até 25 itens por lote.");
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAllDisplayed = () => {
    const listToSelect = displayedAssets.slice(0, 25).map((a) => a.id);
    setSelectedIds(listToSelect);
    setBatchLog([`Selecionados todos os ${listToSelect.length} áudios visíveis (limite de 25).`]);
  };

  const handleSelectByCategory = (category: string) => {
    const categoryAssetIds = assets
      .filter((a) => a.category === category && (!showOnlyPending || a.status !== "completed"))
      .map((a) => a.id)
      .slice(0, 25); // enforce limit of 25

    setSelectedIds(categoryAssetIds);
    setBatchLog([
      `Lote selecionado para categoria "${category}"${
        showOnlyPending ? " (somente pendentes)" : ""
      }: ${categoryAssetIds.length} itens.`
    ]);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setBatchLog([]);
  };

  const handleStartBatch = async () => {
    if (selectedIds.length === 0) return;
    setIsGenerating(true);
    setCurrentProgress({ current: 0, total: selectedIds.length, activeId: selectedIds[0] });
    setBatchLog([`Iniciando processamento em lote com ${selectedIds.length} áudios...`]);

    let successCount = 0;

    for (let i = 0; i < selectedIds.length; i++) {
      const activeId = selectedIds[i];
      const asset = assets.find((a) => a.id === activeId);
      if (!asset) continue;

      setCurrentProgress({ current: i + 1, total: selectedIds.length, activeId });
      setBatchLog((prev) => [
        ...prev,
        `[Lote ${i + 1}/${selectedIds.length}] Iniciando síntese para "${asset.file_name}"...`
      ]);

      let retryCountForThisAsset = 0;
      const maxRetriesForThisAsset = 2;
      let completedSuccessfully = false;

      while (retryCountForThisAsset <= maxRetriesForThisAsset && !completedSuccessfully) {
        try {
          const overrides = forceActiveOptions ? {
            voiceName: activeVoice,
            speed: activeSpeed,
            toneStyle: activeTone,
            pureSoundMode: activePureSound
          } : undefined;

          await onGenerate(activeId, overrides);
          successCount++;
          setBatchLog((prev) => [
            ...prev,
            `✓ Sucesso: "${asset.file_name}" sintetizado e salvo em /data/audio/`
          ]);
          completedSuccessfully = true;
        } catch (error: any) {
          const errorMsg = error?.message || "";
          const isQuotaError = 
            errorMsg.includes("429") || 
            errorMsg.includes("cota") || 
            errorMsg.includes("quota") || 
            errorMsg.includes("Limite") || 
            errorMsg.includes("RESOURCE_EXHAUSTED") ||
            errorMsg.includes("exceeded");

          if (isQuotaError && retryCountForThisAsset < maxRetriesForThisAsset) {
            retryCountForThisAsset++;
            setBatchLog((prev) => [
              ...prev,
              `⚠️ Limite de cota atingido. [Tentativa de Recuperação ${retryCountForThisAsset}/${maxRetriesForThisAsset}] Pausando o lote por 61 segundos para renovação da cota do Gemini...`
            ]);
            // Wait 61 seconds for quota renewal
            await new Promise((r) => setTimeout(r, 61000));
          } else {
            // Non-quota error, or max retries exceeded
            setBatchLog((prev) => [
              ...prev,
              `✗ Falha em "${asset.file_name}": ${errorMsg || "Erro desconhecido"}`
            ]);
            break; // exit retry loop and proceed to next asset
          }
        }
      }

      // Safe pacing delay to satisfy Gemini Free Tier rate limits (RPM)
      if (completedSuccessfully) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    setIsGenerating(false);
    setBatchLog((prev) => [
      ...prev,
      `🎉 Lote Concluído! Sucesso em ${successCount} de ${selectedIds.length} áudios de locuções.`
    ]);
    setSelectedIds([]);
  };

  // Export current configuration as JSON file
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(assets, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "luna_studio_assets_config.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setBatchLog((prev) => [...prev, "✓ Configuração exportada com sucesso como 'luna_studio_assets_config.json'."]);
    } catch (e: any) {
      alert("Erro ao exportar arquivo de configuração: " + e.message);
    }
  };

  // Handle uploaded JSON file configuration
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        await processImport(parsed);
      } catch (err: any) {
        setImportMessage({ type: "error", text: "Arquivo JSON inválido. Verifique o formato." });
      }
    };
    reader.readAsText(file);
  };

  // Paste raw text JSON
  const handlePasteImport = async () => {
    if (!jsonPasteText.trim()) {
      setImportMessage({ type: "error", text: "Cole um JSON válido antes de prosseguir." });
      return;
    }
    try {
      const parsed = JSON.parse(jsonPasteText);
      await processImport(parsed);
    } catch (err: any) {
      setImportMessage({ type: "error", text: "Estrutura JSON inválida. Certifique-se de que é um array válido." });
    }
  };

  // HTTP POST Call to backend for persistent import
  const processImport = async (jsonAssets: any) => {
    const targetArray = Array.isArray(jsonAssets) ? jsonAssets : jsonAssets.assets;
    if (!Array.isArray(targetArray)) {
      setImportMessage({ type: "error", text: "O JSON deve conter um array de áudios." });
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: targetArray })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportMessage({ type: "success", text: data.message });
        setJsonPasteText("");
        if (onImportSuccess) {
          onImportSuccess(data.assets);
        }
        setBatchLog((prev) => [...prev, `✓ Importação concluída: ${data.message}`]);
      } else {
        setImportMessage({ type: "error", text: data.error || "Ocorreu um erro ao importar no servidor." });
      }
    } catch (e: any) {
      setImportMessage({ type: "error", text: "Erro de conexão: " + e.message });
    } finally {
      setIsImporting(false);
    }
  };

  const progressPercent =
    currentProgress.total > 0 ? Math.round((currentProgress.current / currentProgress.total) * 100) : 0;

  const activeAsset = assets.find((a) => a.id === currentProgress.activeId);

  return (
    <div className="space-y-6">
      {/* 1. Complete Audio Checklist & Dashboard counter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Audio card */}
        <div className="bg-[#0c0c0c] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] uppercase font-bold text-[#71717a] tracking-widest block">Mapeamento Total</span>
            <p className="text-2xl font-serif italic font-medium text-white">{totalCount}</p>
            <span className="text-[10px] text-[#71717a]">Arquivos de áudio indexados</span>
          </div>
          <FileText className="w-10 h-10 text-[#c5a059]/10 absolute right-4 bottom-4" />
        </div>

        {/* Completed Audio card */}
        <div className="bg-[#0c0c0c] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] uppercase font-bold text-[#c5a059] tracking-widest block">Gerados & Prontos</span>
            <p className="text-2xl font-serif italic font-medium text-emerald-400 flex items-center gap-1.5">
              {completedCount}
              <span className="text-xs font-mono font-normal text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">WAV</span>
            </p>
            <span className="text-[10px] text-emerald-500/70">Arquivos físicos em /data/audio/</span>
          </div>
          <CheckCircle2 className="w-10 h-10 text-emerald-500/5 absolute right-4 bottom-4" />
        </div>

        {/* Pending Audio card */}
        <div className="bg-[#0c0c0c] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] uppercase font-bold text-amber-500 tracking-widest block">Pendentes de Geração</span>
            <p className="text-2xl font-serif italic font-medium text-amber-500">{pendingCount}</p>
            <span className="text-[10px] text-amber-500/70">Aguardando IA ou locução</span>
          </div>
          <Clock className="w-10 h-10 text-amber-500/5 absolute right-4 bottom-4" />
        </div>

        {/* Completion Progress Gauge */}
        <div className="bg-[#0c0c0c] border border-[#27272a] rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between z-10 mb-2">
            <span className="text-[10px] uppercase font-bold text-[#71717a] tracking-widest block">Percentual Concluído</span>
            <span className="text-xs font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded-full">{completionPercentage}%</span>
          </div>
          <div className="space-y-2 z-10">
            <div className="w-full bg-[#18181b] rounded-full h-2.5 overflow-hidden border border-[#27272a]">
              <div
                className="bg-gradient-to-r from-[#997838] to-[#c5a059] h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#71717a] block leading-tight">Proporção total de locuções prontas</span>
          </div>
        </div>
      </div>

      {/* Main interactive Batch Panel */}
      <div className="bg-[#0c0c0c] border border-[#27272a] rounded-2xl p-6 shadow-xl relative overflow-hidden text-[#d4d4d8]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-[#27272a]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#c5a059]/10 flex items-center justify-center border border-[#c5a059]/20">
              <Layers className="w-5 h-5 text-[#c5a059]" />
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-[#f4f4f5]">Processador e Checklist em Lote</h3>
              <p className="text-xs text-[#71717a] uppercase tracking-wider">Mapeamento sequencial de locuções com inteligência artificial</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Filter Toggle Checklist Mode */}
            <label className="inline-flex items-center gap-2 cursor-pointer bg-[#18181b] border border-[#27272a] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors select-none">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => {
                  setShowOnlyPending(e.target.checked);
                  setSelectedIds([]);
                }}
                className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#0c0c0c] cursor-pointer"
              />
              <span>Mostrar apenas Pendentes ({pendingCount})</span>
            </label>

            {/* Toggle JSON import export menu */}
            <button
              onClick={() => {
                setShowImportExport(!showImportExport);
                setImportMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                showImportExport
                  ? "bg-[#c5a059] text-black border-[#c5a059]"
                  : "bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              }`}
            >
              <FileJson className="w-4 h-4" />
              <span>Importar / Exportar JSON</span>
            </button>

            {/* Baixar Todos os Áudios (ZIP) */}
            {completedCount > 0 && (
              <a
                href="/api/assets/download-zip"
                download="luna_studio_audios.zip"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer decoration-none"
                title="Baixar pacote compactado ZIP com todos os áudios gerados com sucesso."
              >
                <Download className="w-4 h-4" />
                <span>Baixar Todos (ZIP)</span>
              </a>
            )}
          </div>
        </div>

        {/* JSON Import/Export expanded drawer */}
        {showImportExport && (
          <div className="mb-6 bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-[#c5a059]" />
                  Personalização de Templates / Importador Geral
                </h4>
                <p className="text-xs text-[#71717a]">
                  Importe novas listas de áudio ou faça edições nos templates JSON sem perder os padrões existentes de voz, velocidade ou entonação.
                </p>
              </div>

              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#f4f4f5] rounded flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                title="Exportar base de áudios como arquivo JSON"
              >
                <Download className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>Exportar Configuração (JSON)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#27272a]/50">
              {/* File Upload zone */}
              <div className="border border-dashed border-[#27272a] hover:border-[#c5a059]/40 bg-[#0d0d0d] p-5 rounded-lg text-center flex flex-col items-center justify-center space-y-3 transition-all relative">
                <Upload className="w-8 h-8 text-[#71717a]" />
                <div>
                  <span className="text-xs font-bold text-[#f4f4f5] block">Carregar arquivo de configuração</span>
                  <span className="text-[10px] text-[#71717a] block mt-0.5">Arraste ou clique para selecionar arquivo (.json)</span>
                </div>
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  disabled={isImporting}
                />
                <button
                  type="button"
                  className="px-3 py-1 bg-[#18181b] border border-[#27272a] text-[10px] font-bold uppercase rounded text-zinc-300 hover:text-white"
                >
                  Selecionar Arquivo
                </button>
              </div>

              {/* Paste Text Area zone */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a] block">Ou Cole a Estrutura JSON dos Áudios</span>
                <textarea
                  value={jsonPasteText}
                  onChange={(e) => setJsonPasteText(e.target.value)}
                  placeholder='[ { "id": "custom_sound", "category": "palavras", "text_to_speak": "Olha!", "file_name": "luna_olha.wav", "difficulty": "fácil" } ]'
                  className="w-full h-24 bg-[#0d0d0d] border border-[#27272a] rounded p-2.5 font-mono text-[10px] text-zinc-300 focus:border-[#c5a059] focus:ring-0 outline-none resize-none"
                  disabled={isImporting}
                />
                <div className="flex justify-end">
                  <button
                    disabled={isImporting}
                    onClick={handlePasteImport}
                    className="px-4 py-1.5 bg-[#f4f4f5] hover:bg-white text-black font-bold uppercase tracking-wider text-[10px] rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Confirmar Importação de Texto</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Import Feedback message status */}
            {importMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 animate-fadeIn border ${
                  importMessage.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}
              >
                {importMessage.type === "success" ? <CheckCircle className="w-4.5 h-4.5 shrink-0" /> : <AlertCircle className="w-4.5 h-4.5 shrink-0" />}
                <p className="leading-normal">{importMessage.text}</p>
              </div>
            )}
          </div>
        )}

        {/* Quick select buttons */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a]">Seleção Rápida por Categoria (máximo 25 por lote):</span>
            <button
              onClick={handleSelectAllDisplayed}
              className="text-[10px] uppercase font-bold tracking-widest text-[#c5a059] hover:text-[#e2c28a]"
              disabled={isGenerating || displayedAssets.length === 0}
            >
              Selecionar Primeiros 25 Visíveis
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSelectByCategory("fonemas")}
              className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer"
              disabled={isGenerating}
            >
              Vogais & Consoantes (Fonemas)
            </button>
            <button
              onClick={() => handleSelectByCategory("silabas")}
              className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer"
              disabled={isGenerating}
            >
              Sílabas (CV, CCV, CVC)
            </button>
            <button
              onClick={() => handleSelectByCategory("palavras")}
              className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer"
              disabled={isGenerating}
            >
              Palavras de Alta Frequência
            </button>
            <button
              onClick={() => handleSelectByCategory("instrucoes_e_feedbacks")}
              className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer"
              disabled={isGenerating}
            >
              Instruções & Feedbacks do Jogo
            </button>
          </div>
        </div>

        {/* Central Active Generation Configs panel */}
        <div className="mb-6 bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 font-serif italic">
                <Sliders className="w-4 h-4 text-[#c5a059]" />
                Opções Ativas para as Novas Gerações
              </h4>
              <p className="text-xs text-[#71717a]">
                Selecione as opções de voz e velocidade que deseja aplicar nas gerações individuais e do lote.
              </p>
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer bg-[#18181b] border border-[#c5a059]/30 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#e2c28a] select-none shadow-[#c5a059]/5 shadow-sm shrink-0">
              <input
                type="checkbox"
                checked={forceActiveOptions}
                onChange={(e) => setForceActiveOptions(e.target.checked)}
                className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#0c0c0c] cursor-pointer"
              />
              <span>Forçar Voz e Velocidade selecionadas ao Gerar</span>
            </label>
          </div>

          {forceActiveOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-[#27272a]/50 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Modelo de Voz (Persona)</label>
                <select
                  value={activeVoice}
                  onChange={(e) => setActiveVoice(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none cursor-pointer"
                >
                  <option value="Kore">Luna (Feminino - Padrão)</option>
                  <option value="Aoede">Suave (Feminino - Calmo)</option>
                  <option value="Puck">Jovial (Feminino/Infantil - Alegre)</option>
                  <option value="Charon">Professor (Masculino - Maduro)</option>
                  <option value="Fenrir">Instrutor (Masculino - Jovem)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Velocidade da Voz</label>
                <select
                  value={activeSpeed}
                  onChange={(e) => setActiveSpeed(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none cursor-pointer"
                >
                  <option value="lento">Lento (Alfabetização)</option>
                  <option value="normal">Normal (Natural)</option>
                  <option value="rápido">Rápido (Dinâmico)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Tom & Entonação</label>
                <select
                  value={activeTone}
                  onChange={(e) => setActiveTone(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none cursor-pointer"
                >
                  <option value="didático">Didático / Pedagógico</option>
                  <option value="animado">Animado / Alegre (Feedbacks)</option>
                  <option value="suave">Suave / Tranquilo</option>
                  <option value="fônico">Pronúncia Fônica (Foco no Som)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="inline-flex items-center gap-2 cursor-pointer bg-[#18181b]/50 p-2 border border-[#27272a] rounded h-[34px] w-full select-none">
                  <input
                    type="checkbox"
                    checked={activePureSound}
                    onChange={(e) => setActivePureSound(e.target.checked)}
                    className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#0c0c0c] cursor-pointer"
                  />
                  <div className="text-[10px] leading-none">
                    <span className="font-bold text-[#f4f4f5] block">Apenas Som Puro</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Audio checklist selection list */}
        <div className="mb-6 bg-[#0a0a0a] p-4 rounded-xl border border-[#27272a]">
          <div className="flex items-center justify-between mb-2.5 border-b border-[#27272a]/40 pb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a]">
              Lista de Mapeamento de Locuções ({selectedIds.length} selecionados para o lote):
            </span>
            {selectedIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-semibold"
                disabled={isGenerating}
              >
                Limpar Lote
              </button>
            )}
          </div>
          
          {displayedAssets.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#71717a]">
              Nenhum áudio encontrado nos filtros ativos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[170px] overflow-y-auto pr-1">
              {displayedAssets.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                const isCompleted = asset.status === "completed";
                const isFailed = asset.status === "failed";
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleToggleSelect(asset.id)}
                    disabled={isGenerating}
                    className={`px-2.5 py-1.5 rounded border text-left text-xs font-mono transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#c5a059]/15 border-[#c5a059] text-[#e2c28a] font-semibold shadow-[#c5a059]/5 shadow-inner"
                        : isCompleted
                        ? "bg-[#18181b]/30 border-[#27272a]/30 text-[#71717a]/80"
                        : isFailed
                        ? "bg-rose-950/10 border-rose-900/40 text-rose-400"
                        : "bg-[#0d0d0d] border-[#27272a] text-[#a1a1aa] hover:bg-[#18181b]"
                    }`}
                  >
                    <span className="truncate">{asset.id}</span>
                    <span className="shrink-0">
                      {isCompleted ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" title="Áudio WAV gravado"></span>
                      ) : isFailed ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" title="Erro na geração"></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 block" title="Pendente de geração"></span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress & Generation status panel */}
        {isGenerating && (
          <div className="mb-6 bg-[#18181b]/60 border border-[#27272a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="font-semibold text-[#c5a059] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="font-serif italic text-base">Sintetizando Lote com Luna TTS...</span>
              </span>
              <span className="text-xs text-[#71717a] font-mono">
                {currentProgress.current} de {currentProgress.total} ({progressPercent}%)
              </span>
            </div>

            <div className="w-full bg-[#27272a] rounded-full h-2.5 overflow-hidden mb-4 border border-[#27272a]">
              <div
                className="bg-gradient-to-r from-[#997838] to-[#c5a059] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {activeAsset && (
              <div className="text-xs text-[#a1a1aa] leading-relaxed bg-[#0a0a0a] p-3.5 rounded border border-[#27272a] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a] block">Locução Ativa:</span>
                <p className="font-mono text-xs text-[#c5a059]">{activeAsset.file_name}</p>
                <p className="italic text-[#f4f4f5]">"{activeAsset.text_to_speak}"</p>
                <div className="flex items-center gap-3 pt-1 text-[10px] text-[#71717a]">
                  <span>Voz: {activeAsset.voiceName}</span>
                  <span>Ritmo: {activeAsset.speed}</span>
                  <span>Tom: {activeAsset.toneStyle}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch Operations historical console logs */}
        {batchLog.length > 0 && (
          <div className="mb-6 bg-[#0d0d0d] border border-[#27272a] rounded-xl p-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a] block mb-2">Terminal de Execução:</span>
            <div className="font-mono text-[11px] space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {batchLog.map((log, index) => {
                let colorClass = "text-[#71717a]";
                if (log.includes("✓ Sucesso") || log.startsWith("✓")) colorClass = "text-emerald-500 font-medium";
                if (log.includes("✗ Falha") || log.startsWith("✗")) colorClass = "text-rose-400 font-medium";
                if (log.startsWith("🎉")) colorClass = "text-[#c5a059] font-bold";
                return (
                  <div key={index} className={colorClass}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Start button controls */}
        <div className="flex justify-end">
          <button
            onClick={handleStartBatch}
            disabled={selectedIds.length === 0 || isGenerating}
            className={`px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
              selectedIds.length === 0 || isGenerating
                ? "bg-[#18181b] text-[#71717a] border border-[#27272a] cursor-not-allowed"
                : "bg-[#f4f4f5] text-black hover:bg-white active:scale-98 shadow-lg hover:shadow-white/5"
            }`}
          >
            <Play className="w-4 h-4 text-[#c5a059]" />
            <span>Executar Lote ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
