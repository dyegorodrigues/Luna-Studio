# 📋 Checklist de Mapeamento de Locuções e Sons • Luna Studio

Este checklist documenta todos os áudios padrão do **Luna Studio** projetados para o jogo educativo **Matemágica**. Os áudios são salvos na pasta `/data/audio/` no formato **WAV (16-bit, 24kHz Mono)**, ideal para clareza e aprendizado de fonemas puros e sílabas para crianças.

---

## 📂 Visão Geral do Armazenamento

- **Configurações dos Assets (Metadata):** Salvo em `/data/db.json` (banco de dados leve e portátil).
- **Arquivos Físicos WAV Gerados:** Salvos na pasta `/data/audio/` (ex: `/data/audio/fon_a_aberto.wav`).
- **Geração Dinâmica:** Cache automático em `/data/audio/` baseado em hash do texto.

---

## 🎯 Categorias & Conteúdo Mapeado

### 1. 🔤 Fonemas (Vogais e Consoantes)
Utilizados no módulo de alfabetização do Matemágica para pronunciar os sons das letras de forma analítica e isolada.

*   [ ] **fon_a_aberto** (`luna_fon_a.wav`) - Som aberto da letra A: "Ah!"
*   [ ] **fon_e_aberto** (`luna_fon_e_aberto.wav`) - Som aberto da letra E: "Éh!"
*   [ ] **fon_e_fechado** (`luna_fon_e_fechado.wav`) - Som fechado da letra E: "Êh!"
*   [ ] **fon_i** (`luna_fon_i.wav`) - Som da letra I: "Ih!"
*   [ ] **fon_o_aberto** (`luna_fon_o_aberto.wav`) - Som aberto da letra O: "Óh!"
*   [ ] **fon_o_fechado** (`luna_fon_o_fechado.wav`) - Som fechado da letra O: "Ôh!"
*   [ ] **fon_u** (`luna_fon_u.wav`) - Som da letra U: "Uh!"
*   [ ] **fon_b** (`luna_fon_b.wav`) - Som isolado fônico da consoante B: "b..."
*   [ ] **fon_p** (`luna_fon_p.wav`) - Som isolado fônico da consoante P: "p..."
*   [ ] **fon_t** (`luna_fon_t.wav`) - Som isolado fônico da consoante T: "t..."
*   [ ] **fon_d** (`luna_fon_d.wav`) - Som isolado fônico da consoante D: "d..."

---

### 2. 🧩 Sílabas (Estruturas Silábicas CV)
Utilizadas no jogo para ensinar a junção de consoantes e vogais.

*   [ ] **sil_ba** (`luna_sil_ba.wav`) - Sílaba BA: "B com A faz BA"
*   [ ] **sil_be** (`luna_sil_be.wav`) - Sílaba BE: "B com E faz BE"
*   [ ] **sil_bi** (`luna_sil_bi.wav`) - Sílaba BI: "B com I faz BI"
*   [ ] **sil_bo** (`luna_sil_bo.wav`) - Sílaba BO: "B com O faz BO"
*   [ ] **sil_bu** (`luna_sil_bu.wav`) - Sílaba BU: "B com U faz BU"
*   [ ] **sil_pa** (`luna_sil_pa.wav`) - Sílaba PA: "P com A faz PA"
*   [ ] **sil_pe** (`luna_sil_pe.wav`) - Sílaba PE: "P com E faz PE"

---

### 3. 📝 Palavras de Alta Frequência (Foco no Jogo)
Palavras de exemplos ilustrativos para as crianças associarem as letras e sílabas.

*   [ ] **pal_bola** (`luna_pal_bola.wav`) - Palavra: "Bola! B-O-L-A."
*   [ ] **pal_pato** (`luna_pal_pato.wav`) - Palavra: "Pato! P-A-T-O."
*   [ ] **pal_dado** (`luna_pal_dado.wav`) - Palavra: "Dado! D-A-D-O."
*   [ ] **pal_casa** (`luna_pal_casa.wav`) - Palavra: "Casa! C-A-S-A."

---

### 4. 📢 Instruções & Feedbacks do Jogo
Frases faladas pela mascote Luna para guiar a criança pela trilha de aprendizagem.

*   [ ] **inst_boas_vindas** (`luna_inst_boas_vindas.wav`) - Boas-vindas calorosas ao jogo.
*   [ ] **inst_toque_fonema** (`luna_inst_toque_fonema.wav`) - Instrução: "Toque na letra que faz o som indicado..."
*   [ ] **feed_acerto_feliz** (`luna_feed_acerto.wav`) - Feedback de acerto alegre e entusiasmado.
*   [ ] **feed_erro_suave** (`luna_feed_erro.wav`) - Feedback reconfortante de incentivo para tentar novamente.

---

## 🛠️ Como usar o Luna Studio no GitHub

Para subir este projeto para o GitHub e mantê-lo organizado, siga os passos recomendados:

1.  **Inicialize o Repositório:**
    ```bash
    git init
    git remote add origin https://github.com/SEU_USUARIO/luna-studio.git
    ```
2.  **Adicione os Arquivos Necessários:**
    -   Certifique-se de manter `/data/db.json` com suas customizações.
    -   Os arquivos gerados WAV estão em `/data/audio/`.
3.  **Compromisso de Autorização:**
    -   *Conforme combinado:* Atualizações no repositório remoto do GitHub devem ser feitas **exclusivamente com a sua autorização explícita**.
    -   Você pode baixar o projeto como arquivo ZIP pelo menu de configurações para fazer o upload manual ou me solicitar a execução de comandos git quando desejar atualizar!

---

*Manual gerado de forma consistente pelo assistente de IA Luna Studio.*
