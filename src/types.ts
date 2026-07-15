export interface AudioAsset {
  id: string;
  category: "fonemas" | "silabas" | "palavras" | "instrucoes_e_feedbacks";
  text_to_speak: string;
  file_name: string;
  difficulty: "fácil" | "médio" | "difícil";
  status: "pending" | "generating" | "completed" | "failed";
  audioUrl?: string;
  voiceName?: "Kore" | "Aoede" | "Puck" | "Charon" | "Fenrir";
  speed?: "lento" | "normal" | "rápido";
  toneStyle?: "didático" | "animado" | "suave" | "fônico";
  pureSoundMode?: boolean;
  pureSoundText?: string;
}
