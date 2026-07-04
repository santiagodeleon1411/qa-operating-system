#!/bin/bash
# Abre la web de Estoca en el navegador. Cerrá esta ventana para apagar el servidor.
cd "$(dirname "$0")/../estoca" || { echo "No encuentro la carpeta estoca/"; exit 1; }

if [ ! -d node_modules ]; then
  echo "Primera vez: instalando dependencias..."
  npm install || { echo "Falló npm install"; read -n 1 -s; exit 1; }
fi

echo "Levantando Estoca... el navegador se abre solo en unos segundos."
echo "Para apagar el servidor, cerrá esta ventana (Ctrl+C)."
( sleep 2 && open "http://localhost:5173/" ) &
npm run dev
