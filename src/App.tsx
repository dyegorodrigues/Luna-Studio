import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  Layers, 
  Music, 
  MessageCircle, 
  Heart, 
  Filter,
  CheckCircle2,
  FileDown,
  X,
  Clock,
  Activity,
  Info
} from "lucide-react";
import { motion } from "motion/react";
import { AudioAsset } from "./types";
import LunaConfigCard from "./components/LunaConfigCard";
import JSONViewer from "./components/JSONViewer";
import AudioItemRow from "./components/AudioItemRow";
import BatchGenerator from "./components/BatchGenerator";

export default function App() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Search states
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [speedFilter, setSpeedFilter] = useState("all");
  const [toneFilter, setToneFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  // New custom asset form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState("");
  const [newCategory, setNewCategory] = useState<AudioAsset["category"]>("palavras");
  const [newText, setNewText] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<AudioAsset["difficulty"]>("fácil");

  // Advanced voice states for new custom asset creation
  const [newVoiceName, setNewVoiceName] = useState<AudioAsset["voiceName"]>("Kore");
  const [newSpeed, setNewSpeed] = useState<AudioAsset["speed"]>("lento");
  const [newToneStyle, setNewToneStyle] = useState<AudioAsset["toneStyle"]>("didático");
  const [newPureSoundMode, setNewPureSoundMode] = useState<boolean>(false);
  const [newPureSoundText, setNewPureSoundText] = useState<string>("");
  const [quotaExceededMsg, setQuotaExceededMsg] = useState<string | null>(null);
  const [quotaCountdown, setQuotaCountdown] = useState<number | null>(null);
  const [quotaResetTime, setQuotaResetTime] = useState<string | null>(null);

  // Countdown timer for quota reset
  useEffect(() => {
    if (quotaCountdown === null) return;
    if (quotaCountdown <= 0) {
      setQuotaCountdown(null);
      setQuotaResetTime(null);
      setQuotaExceededMsg(null);
      return;
    }

    const timer = setInterval(() => {
      setQuotaCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [quotaCountdown]);

  // Fetch initial assets list from full-stack backend
  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/assets");
      const data = await res.json();
      setAssets(data.assets || []);
      setHasApiKey(data.hasApiKey);
    } catch (err) {
      console.error("Erro ao carregar lista de áudios:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // Update a single asset (editing script or filename)
  const handleUpdateAsset = async (id: string, updatedFields: Partial<AudioAsset>) => {
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      const data = await res.json();
      if (data.success) {
        setAssets((prev) =>
          prev.map((asset) => (asset.id === id ? data.asset : asset))
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar item:", err);
    }
  };

  // Trigger individual audio generation
  const handleGenerateAudio = async (id: string, overrides?: Partial<AudioAsset>) => {
    // Optimistic status update
    setAssets((prev) =>
      prev.map((asset) => (asset.id === id ? { ...asset, status: "generating" } : asset))
    );

    try {
      const res = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...overrides }),
      });

      if (res.status === 429) {
        const data = await res.json();
        const errorText = data.error || "Limite de cota de áudio excedido no Gemini TTS. Por favor, aguarde cerca de 1 minuto.";
        setQuotaExceededMsg(errorText);
        
        const delay = data.retryDelaySec || 60;
        setQuotaCountdown(delay);
        const resetDate = new Date(Date.now() + delay * 1000);
        setQuotaResetTime(resetDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        setAssets((prev) =>
          prev.map((asset) => (asset.id === id ? { ...asset, status: "failed" } : asset))
        );
        throw new Error(errorText);
      }

      const data = await res.json();
      if (data.success) {
        setQuotaExceededMsg(null); // Clear error on success
        setQuotaCountdown(null);
        setQuotaResetTime(null);
        setAssets((prev) =>
          prev.map((asset) => (asset.id === id ? data.asset : asset))
        );
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error(`Erro ao gerar áudio para o ID ${id}:`, err);
      const errMsg = err?.message || "";
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        setQuotaExceededMsg("Limite de cota de áudio do Gemini excedido temporariamente. Aguarde 1 minuto ou use reprodução local.");
        setQuotaCountdown(60);
        const resetDate = new Date(Date.now() + 60 * 1000);
        setQuotaResetTime(resetDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
      setAssets((prev) =>
        prev.map((asset) => (asset.id === id ? { ...asset, status: "failed" } : asset))
      );
      throw err;
    }
  };

  // Reset all assets to pending
  const handleResetAssets = async () => {
    if (!confirm("Tem certeza de que deseja redefinir todos os áudios? Isso excluirá todas as gravações geradas.")) return;
    try {
      const res = await fetch("/api/assets/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error("Erro ao redefinir áudios:", err);
    }
  };

  // Bulk update all or selected assets
  const handleBulkUpdateAssets = (updatedAssets: AudioAsset[]) => {
    setAssets(updatedAssets);
  };

  // Add custom asset to the persistent list on the full-stack server
  const handleAddCustomAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newText || !newFileName) {
      alert("Por favor, preencha todos os campos do novo áudio.");
      return;
    }

    const sanitizedId = newId.toLowerCase().trim().replace(/\s+/g, "_");
    const sanitizedFileName = newFileName.endsWith(".wav") ? newFileName : `${newFileName}.wav`;

    // Verify uniqueness
    if (assets.some((a) => a.id === sanitizedId)) {
      alert("Já existe um áudio com este ID único.");
      return;
    }

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sanitizedId,
          category: newCategory,
          text_to_speak: newPureSoundMode ? newText : `[warm, clear, slow, child-friendly, educational] ${newText}`,
          file_name: sanitizedFileName,
          difficulty: newDifficulty,
          voiceName: newVoiceName,
          speed: newSpeed,
          toneStyle: newToneStyle,
          pureSoundMode: newPureSoundMode,
          pureSoundText: newPureSoundText || newText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssets((prev) => [data.asset, ...prev]);

        // Reset form states
        setNewId("");
        setNewText("");
        setNewFileName("");
        setNewDifficulty("fácil");
        setNewVoiceName("Kore");
        setNewSpeed("lento");
        setNewToneStyle("didático");
        setNewPureSoundMode(false);
        setNewPureSoundText("");
        setShowAddForm(false);
      } else {
        alert("Erro ao adicionar áudio no servidor: " + (data.error || "Desconhecido"));
      }
    } catch (err) {
      console.error("Erro ao salvar áudio customizado:", err);
      alert("Falha de conexão com o servidor ao adicionar áudio.");
    }
  };

  // Filtered Assets list logic
  const filteredAssets = assets.filter((asset) => {
    const matchesTab = activeTab === "all" || asset.category === activeTab;
    const matchesSearch =
      asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.text_to_speak.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.voiceName && asset.voiceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.speed && asset.speed.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.toneStyle && asset.toneStyle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDifficulty = difficultyFilter === "all" || asset.difficulty === difficultyFilter;
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    
    // Custom fine-grained attributes filters
    const matchesVoice = voiceFilter === "all" || (asset.voiceName || "Kore") === voiceFilter;
    const matchesSpeed = speedFilter === "all" || (asset.speed || "lento") === speedFilter;
    const matchesTone = toneFilter === "all" || (asset.toneStyle || "didático") === toneFilter;
    const matchesMode =
      modeFilter === "all" ||
      (modeFilter === "pure" && asset.pureSoundMode) ||
      (modeFilter === "complete" && !asset.pureSoundMode);

    return (
      matchesTab &&
      matchesSearch &&
      matchesDifficulty &&
      matchesStatus &&
      matchesVoice &&
      matchesSpeed &&
      matchesTone &&
      matchesMode
    );
  });

  // Calculate category stats
  const getCategoryCount = (category: string) => {
    if (category === "all") return assets.length;
    return assets.filter((a) => a.category === category).length;
  };

  const completedCount = assets.filter((a) => a.status === "completed").length;
  const totalCount = assets.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#d4d4d8] font-sans selection:bg-[#c5a059]/20 selection:text-white">
      {/* Header section */}
      <header className="h-20 border-b border-[#27272a] bg-[#0c0c0c] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#c5a059] rounded-lg flex items-center justify-center">
              <div className="w-6 h-4 flex gap-1 items-end">
                <div className="w-1 h-3 bg-black"></div>
                <div className="w-1 h-4 bg-black"></div>
                <div className="w-1 h-2 bg-black"></div>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-serif italic tracking-wide text-[#f4f4f5]">Luna Studio</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#c5a059] font-bold">Vocal Asset Management • pt-BR</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] uppercase text-[#71717a] font-bold tracking-widest">Active Voice</span>
              <span className="text-xs text-[#f4f4f5]">Luna (28, Friendly/Educational)</span>
            </div>
            <div className="hidden md:block w-px h-10 bg-[#27272a]"></div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase text-[#71717a] font-bold tracking-widest">Progress</span>
              <span className="text-xs text-[#f4f4f5] font-mono">{completedCount} / {totalCount} áudios</span>
            </div>
            <div className="w-px h-10 bg-[#27272a]"></div>
            <button
              onClick={handleResetAssets}
              className="px-4 py-2 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1.5"
              title="Redefinir áudios"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {quotaExceededMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-[#c5a059]/10 border border-[#c5a059]/20 rounded-2xl text-xs text-[#e5c583] flex flex-col md:flex-row items-stretch md:items-center gap-4 relative overflow-hidden"
          >
            {/* Pulsing indicator & Countdown circle */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#c5a059]/30 bg-[#c5a059]/5 font-mono text-base font-bold text-[#c5a059]">
                {quotaCountdown !== null ? `${quotaCountdown}s` : "60s"}
                <span className="absolute inset-0 rounded-full border-2 border-t-transparent border-[#c5a059] animate-spin opacity-50" />
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-[10px] text-[#c5a059]">Próxima Liberação</p>
                <p className="text-xs text-[#f4f4f5] font-mono">{quotaResetTime || "--:--:--"}</p>
              </div>
            </div>

            <div className="hidden md:block w-px self-stretch bg-[#c5a059]/20" />

            <div className="flex-1 space-y-1.5">
              <p className="font-bold uppercase tracking-wider text-[10px] text-[#c5a059]">Informativo de Cota de Voz (Gemini TTS)</p>
              <p className="text-[#e2e2e9]">
                <strong>Boa notícia:</strong> A cota gratuita do Gemini TTS é redefinida <strong>a cada minuto (limite de 10 requisições por minuto)</strong>, e não por dia! Você não precisa esperar até amanhã. Basta aguardar o cronômetro zerar para continuar gerando áudios.
              </p>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                💡 <strong>Dica de Fallback:</strong> Enquanto aguarda, você pode continuar testando os áudios e fonemas normalmente! O Luna Studio possui um motor de fala inteligente integrado do próprio navegador (Web Speech API) que reproduz os sons de forma suave e instantânea.
              </p>
            </div>

            <button
              onClick={() => {
                setQuotaExceededMsg(null);
                setQuotaCountdown(null);
                setQuotaResetTime(null);
              }}
              className="absolute top-3 right-3 text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Luna config card */}
        <LunaConfigCard hasApiKey={hasApiKey} assets={assets} onBulkUpdate={handleBulkUpdateAssets} />

        {/* Batch Generator Panel */}
        <BatchGenerator assets={assets} onGenerate={handleGenerateAudio} hasApiKey={hasApiKey} onImportSuccess={handleBulkUpdateAssets} />

        {/* Dashboard Grid split into filters + list & sidebar JSON export */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main asset view list (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Filter and search card */}
            <div className="bg-[#0c0c0c] border border-[#27272a] rounded-2xl p-5 shadow-xl space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="w-4.5 h-4.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar áudio por ID, palavra ou script..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-xl pl-10 pr-4 py-2 text-sm text-[#f4f4f5] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]/30 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-4 py-2 rounded bg-[#f4f4f5] text-black hover:bg-white font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Áudio</span>
                  </button>
                </div>
              </div>

              {/* Advanced Filter Pills */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#27272a]">
                <div className="flex items-center gap-1 text-xs text-[#71717a] mr-2">
                  <Filter className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Filtrar por:</span>
                </div>

                {/* Difficulty Filter */}
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todas Dificuldades</option>
                  <option value="fácil">Dificuldade: Fácil</option>
                  <option value="médio">Dificuldade: Médio</option>
                  <option value="difícil">Dificuldade: Difícil</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todos Status</option>
                  <option value="pending">Status: Pendente</option>
                  <option value="generating">Status: Gerando</option>
                  <option value="completed">Status: Gerado</option>
                  <option value="failed">Status: Falhou</option>
                </select>

                {/* Voice Model Filter */}
                <select
                  value={voiceFilter}
                  onChange={(e) => setVoiceFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todas as Vozes</option>
                  <option value="Kore">Voz: Luna (Feminino - Caloroso)</option>
                  <option value="Aoede">Voz: Suave (Feminino - Calmo)</option>
                  <option value="Puck">Voz: Jovial (Alerta/Algre)</option>
                  <option value="Charon">Voz: Professor (Masculino)</option>
                  <option value="Fenrir">Voz: Instrutor (Jovem)</option>
                </select>

                {/* Speed Filter */}
                <select
                  value={speedFilter}
                  onChange={(e) => setSpeedFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todas Velocidades</option>
                  <option value="lento">Velocidade: Lento</option>
                  <option value="normal">Velocidade: Normal</option>
                  <option value="rápido">Velocidade: Rápido</option>
                </select>

                {/* Tone/Style Filter */}
                <select
                  value={toneFilter}
                  onChange={(e) => setToneFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todos os Tons</option>
                  <option value="didático">Tom: Didático</option>
                  <option value="animado">Tom: Animado</option>
                  <option value="suave">Tom: Suave</option>
                  <option value="fônico">Tom: Fônico</option>
                </select>

                {/* Format Mode Filter */}
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded px-3 py-1 text-xs text-[#a1a1aa] outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="all">Todos os Formatos</option>
                  <option value="pure">Formato: Som Puro</option>
                  <option value="complete">Formato: Frase Didática</option>
                </select>
              </div>

              {/* Form to add custom asset */}
              {showAddForm && (
                <form
                  onSubmit={handleAddCustomAsset}
                  className="bg-[#0a0a0a] border border-[#27272a] rounded-xl p-5 space-y-4 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#c5a059]">Adicionar Novo Asset Customizado</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[#71717a] hover:text-[#f4f4f5] text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">ID Único</label>
                      <input
                        type="text"
                        placeholder="Ex: custom_pal_pao"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Categoria</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                      >
                        <option value="fonemas">Fonema</option>
                        <option value="silabas">Sílaba</option>
                        <option value="palavras">Palavra</option>
                        <option value="instrucoes_e_feedbacks">Instrução / Feedback</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Nome do Arquivo (.wav)</label>
                      <input
                        type="text"
                        placeholder="Ex: luna_custom_pao.wav"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Texto a Falar</label>
                      <input
                        type="text"
                        placeholder="Ex: Pão! P... ão! Hum, pãozinho quentinho!"
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Dificuldade</label>
                      <select
                        value={newDifficulty}
                        onChange={(e) => setNewDifficulty(e.target.value as any)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                      >
                        <option value="fácil">Fácil</option>
                        <option value="médio">Médio</option>
                        <option value="difícil">Difícil</option>
                      </select>
                    </div>
                  </div>

                  {/* Advanced Custom Voice fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#27272a]/40 pt-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Modelo de Voz</label>
                      <select
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value as any)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
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
                        value={newSpeed}
                        onChange={(e) => setNewSpeed(e.target.value as any)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                      >
                        <option value="lento">Lento (Pedagógico)</option>
                        <option value="normal">Normal</option>
                        <option value="rápido">Rápido</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#71717a] mb-1">Tom & Entonação</label>
                      <select
                        value={newToneStyle}
                        onChange={(e) => setNewToneStyle(e.target.value as any)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-[#c5a059]"
                      >
                        <option value="didático">Didático / Pedagógico</option>
                        <option value="animado">Animado (Feedbacks)</option>
                        <option value="suave">Suave / Calmo</option>
                        <option value="fônico">Fônico Analítico</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-[#18181b]/30 border border-[#27272a]/60 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#c5a059]">Modo de Saída de Som</span>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPureSoundMode}
                          onChange={(e) => setNewPureSoundMode(e.target.checked)}
                          className="rounded border-[#27272a] text-[#c5a059] focus:ring-0 bg-[#18181b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-[#f4f4f5]">Habilitar Apenas Som Puro</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-[#71717a] leading-tight">
                      *Ideal para o módulo de Português no Matemágica: gera apenas o fonema/sílaba puro sem a frase explicativa completa.
                    </p>
                    {newPureSoundMode && (
                      <div className="pt-1 animate-fadeIn">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#c5a059] mb-1">Som Puro Isolado a Pronunciar</label>
                        <input
                          type="text"
                          value={newPureSoundText}
                          onChange={(e) => setNewPureSoundText(e.target.value)}
                          placeholder="Ex: b... b... ou BA!"
                          className="w-full bg-[#18181b] border border-[#c5a059]/40 rounded px-3 py-1.5 text-xs text-[#f4f4f5] focus:border-[#c5a059] outline-none"
                          required={newPureSoundMode}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-white text-black font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar ao Estúdio</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Navigation Tabs (Category) */}
            <div className="flex overflow-x-auto pb-2 gap-1.5 border-b border-[#27272a] no-scrollbar">
              {[
                { id: "all", label: "Todos os Áudios" },
                { id: "fonemas", label: "Fonemas" },
                { id: "silabas", label: "Sílabas" },
                { id: "palavras", label: "Palavras" },
                { id: "instrucoes_e_feedbacks", label: "Instruções & Feedbacks" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[#c5a059] text-black shadow-md shadow-[#c5a059]/10"
                      : "bg-[#0d0d0d] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      activeTab === tab.id ? "bg-[#997838] text-white" : "bg-[#0a0a0a] text-[#71717a]"
                    }`}
                  >
                    {getCategoryCount(tab.id)}
                  </span>
                </button>
              ))}
            </div>

            {/* Main assets list */}
            {isLoading ? (
              <div className="py-20 text-center text-[#a1a1aa] text-sm font-medium animate-pulse">
                Carregando estúdio de áudio da Luna...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="bg-[#0c0c0c] border border-[#27272a] border-dashed rounded-2xl py-16 px-6 text-center text-[#a1a1aa] space-y-2">
                <p className="font-semibold text-[#f4f4f5]">Nenhum asset de áudio encontrado.</p>
                <p className="text-xs">Tente reajustar seus filtros de busca ou adicione um novo asset customizado!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAssets.map((asset) => (
                  <AudioItemRow
                    key={asset.id}
                    asset={asset}
                    onUpdate={handleUpdateAsset}
                    onGenerate={handleGenerateAudio}
                    hasApiKey={hasApiKey}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Section: JSON Export (4 columns) */}
          <div className="lg:col-span-4 sticky top-24 space-y-6">
            {/* Monitor de Cota Gemini TTS */}
            <div className="bg-[#0c0c0c] border border-[#27272a] rounded-2xl p-6 shadow-xl relative overflow-hidden text-[#d4d4d8] space-y-4">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                <h4 className="font-serif italic text-[#f4f4f5] text-base flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-[#c5a059]" />
                  <span>Monitor de Cotas Gemini</span>
                </h4>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  quotaCountdown !== null 
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${quotaCountdown !== null ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                  {quotaCountdown !== null ? "Em Espera" : "Ativo"}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a]">Cota do Modelo (Free Tier)</span>
                  <p className="text-xs text-[#f4f4f5] font-semibold mt-0.5">10 requisições por minuto (RPM)</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#71717a]">Tempo de Renovação</span>
                  <p className="text-xs text-[#e2e2e9] mt-0.5 leading-relaxed">
                    A cota gratuita do Gemini TTS é baseada em <strong className="text-[#c5a059]">minutos</strong>, não por dia! Se exceder o limite, basta aguardar <strong className="text-white">60 segundos</strong> e tentar novamente.
                  </p>
                </div>

                {quotaCountdown !== null ? (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-500/80">Aguarde a liberação</span>
                      <p className="text-xs text-white font-mono font-bold mt-0.5">Renovação às: {quotaResetTime}</p>
                    </div>
                    <div className="text-lg font-mono font-black text-[#c5a059] bg-[#c5a059]/10 w-10 h-10 rounded-full flex items-center justify-center border border-[#c5a059]/30">
                      {quotaCountdown}s
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[9px] uppercase font-bold text-emerald-400/80">Canal Livre</span>
                      <p className="text-[11px] text-[#a1a1aa]">Pronto para sintetizar novos áudios.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] bg-[#18181b]/40 border border-[#27272a]/40 rounded-xl p-3 text-[#71717a] leading-normal flex items-start gap-2">
                <Info className="w-4.5 h-4.5 text-[#c5a059] shrink-0 mt-0.5" />
                <span>
                  <strong>Repositório & Código:</strong> Todo o estúdio e o módulo de geração fônica analítica de áudio da Luna estão sincronizados localmente e prontos no repositório.
                </span>
              </div>
            </div>

            <JSONViewer assets={assets} />

            <div className="bg-[#0c0c0c] border border-[#27272a] rounded-2xl p-6 shadow-xl relative overflow-hidden text-[#d4d4d8]">
              <h4 className="font-serif italic text-[#f4f4f5] text-base mb-3 flex items-center gap-2">
                <Heart className="w-4.5 h-4.5 text-[#c5a059] fill-[#c5a059]" />
                <span>Sobre a Luna</span>
              </h4>
              <p className="text-xs leading-relaxed text-[#a1a1aa] mb-3">
                Luna foi idealizada para apoiar educadores e desenvolvedores na criação de experiências sonoras imersivas de alta qualidade voltadas para o público infantil.
              </p>
              <div className="space-y-2 pt-2 border-t border-[#27272a] text-xs">
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Totalmente Modular:</span>
                  <span className="font-semibold text-[#f4f4f5]">Sim</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Aceleração com Gemini:</span>
                  <span className="font-semibold text-[#f4f4f5]">Ativa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Idioma Principal:</span>
                  <span className="font-semibold text-[#f4f4f5]">Português (BR)</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <footer className="border-t border-[#27272a] mt-16 py-8 text-center text-xs text-[#71717a] font-medium">
        <p>Luna Studio — Desenvolvido com Google Gemini & React</p>
      </footer>
    </div>
  );
}
