#!/bin/bash
# Corre el safety net automático sobre el invariante (Vitest) y muestra el resultado.
cd "$(dirname "$0")/../estoca" || { echo "No encuentro la carpeta estoca/"; exit 1; }

if [ ! -d node_modules ]; then
  echo "Primera vez: instalando dependencias..."
  npm install || { echo "Falló npm install"; read -n 1 -s; exit 1; }
fi

npm test

echo ""
echo "Listo. Presioná una tecla para cerrar esta ventana..."
read -n 1 -s
