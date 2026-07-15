#!/bin/bash

# ==============================================================================
# Script de Automação para Salvar o Luna Studio no GitHub
# ==============================================================================
# Este script inicializa e envia todo o seu projeto do Luna Studio, incluindo
# os arquivos de metadados (db.json) e as locuções de áudio geradas (WAV),
# para o seu repositório pessoal do GitHub de forma rápida e segura.
#
# COMO USAR:
# 1. Abra o terminal no seu computador na pasta do projeto.
# 2. Torne este script executável: chmod +x push_to_github.sh
# 3. Execute o script: ./push_to_github.sh
# ==============================================================================

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}        Luna Studio — Configuração do GitHub        ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Verificar se o Git está instalado
if ! command -v git &> /dev/null
then
    echo -e "${YELLOW}[!] O Git não foi encontrado no seu sistema.${NC}"
    echo "Por favor, instale o Git e tente novamente."
    exit 1
fi

# 2. Perguntar o nome de usuário e repositório do GitHub
echo -e "\n${YELLOW}Por favor, digite as informações do seu repositório do GitHub:${NC}"
read -p "Seu usuário do GitHub (ex: joaosilva): " GITHUB_USER
read -p "Nome do repositório (ex: luna-studio-matemagica): " REPO_NAME

if [ -z "$GITHUB_USER" ] || [ -z "$REPO_NAME" ]; then
    echo -e "${YELLOW}[!] Nome de usuário ou repositório não preenchidos. Abortando.${NC}"
    exit 1
fi

GITHUB_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

# 3. Inicializar repositório local se necessário
if [ ! -d ".git" ]; then
    echo -e "\n${BLUE}[*] Inicializando repositório Git local...${NC}"
    git init
else
    echo -e "\n${BLUE}[*] Repositório Git já inicializado localmente.${NC}"
fi

# 4. Configurar branch principal como 'main'
git checkout -b main 2>/dev/null || git branch -M main

# 5. Adicionar todos os arquivos ao controle de versão
echo -e "\n${BLUE}[*] Adicionando arquivos ao index do Git...${NC}"
echo "Nota: O banco de dados (data/db.json) e as gravações WAV (data/audio/) estão incluídos!"
git add .

# 6. Realizar o Commit inicial
echo -e "\n${BLUE}[*] Criando commit local...${NC}"
git commit -m "feat: setup completo do Luna Studio - banco de dados e locuções WAV inclusas"

# 7. Configurar o repositório remoto
echo -e "\n${BLUE}[*] Vinculando ao repositório remoto: ${GITHUB_URL}${NC}"
git remote remove origin 2>/dev/null
git remote add origin "$GITHUB_URL"

# 8. Tentar fazer o push
echo -e "\n${YELLOW}Deseja fazer o upload (push) para o GitHub agora? (s/n)${NC}"
read -p "Escolha: " CONFIRM

if [[ "$CONFIRM" =~ ^[Ss]$ ]]; then
    echo -e "\n${BLUE}[*] Enviando arquivos para o GitHub...${NC}"
    echo "Se solicitado, insira suas credenciais ou Token de Acesso Pessoal (PAT) do GitHub."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}====================================================${NC}"
        echo -e "${GREEN}✓ SUCESSO! Projeto enviado com êxito para o GitHub!${NC}"
        echo -e "${GREEN}Seu repositório está online em: https://github.com/${GITHUB_USER}/${REPO_NAME}${NC}"
        echo -e "${GREEN}Todos os seus arquivos de áudio e configurações estão seguros!${NC}"
        echo -e "${GREEN}====================================================${NC}"
    else
        echo -e "\n${YELLOW}[!] Ocorreu um problema ao enviar diretamente.${NC}"
        echo "Certifique-se de que:"
        echo "1. Você já criou o repositório '${REPO_NAME}' vazio no site do GitHub."
        echo "2. Suas credenciais/Token do GitHub estão configuradas corretamente."
        echo "Você pode tentar enviar manualmente mais tarde digitando o comando: git push -u origin main"
    fi
else
    echo -e "\n${BLUE}[*] Configuração concluída! Quando desejar enviar para o GitHub, digite:${NC}"
    echo -e "${GREEN}git push -u origin main${NC}"
fi
