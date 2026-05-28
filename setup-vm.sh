#!/bin/bash
# setup-vm.sh - Script para instalar todo en la VM de Oracle Cloud
# Ejecutar como: bash setup-vm.sh

set -e

echo "=========================================="
echo "  Instalando dependencias del sistema..."
echo "=========================================="

sudo apt-get update
sudo apt-get install -y \
  curl \
  git \
  docker.io \
  docker-compose-v2 \
  python3 \
  python3-pip

sudo pip3 install gkeepapi --break-system-packages --quiet

echo "=========================================="
echo "  Configurando Docker..."
echo "=========================================="
sudo usermod -aG docker $USER
sudo systemctl enable docker

echo "=========================================="
echo "  Clonando el proyecto..."
echo "=========================================="
git clone https://github.com/TU_USUARIO/whatsapp-cliente.git
cd whatsapp-cliente

echo "=========================================="
echo "  Creando archivo .env..."
echo "=========================================="
cat > .env << 'ENVEOF'
OPENAI_API_KEY=sk-or-v1-tu-api-key-de-openrouter
AI_MODEL=google/gemini-2.0-flash-001
API_BASE_URL=https://openrouter.ai/api/v1
AI_TEMPERATURE=0.7
BUSINESS_ROLE=asistente municipal de atención al público
BUSINESS_TYPE=municipalidad - gestión de turnos para HCD y CIC
GOOGLE_KEEP_EMAIL=completar@gmail.com
GOOGLE_KEEP_PASSWORD=completar
PORT=3000
TZ=America/Argentina/Buenos_Aires
ENVEOF

echo "=========================================="
echo "  Editá el .env con tus datos de Google Keep:"
echo "  nano .env"
echo ""
echo "  Luego construí y ejecutá:"
echo "  docker compose up -d --build"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANTE: Cerrá sesión y volvé a entrar"
echo "   para que los cambios de Docker surtan efecto."
echo "   O ejecutá: newgrp docker"
