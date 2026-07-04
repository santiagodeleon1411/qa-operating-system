#!/bin/bash
# Abre el registro de ejecución de pruebas manuales de la etapa actual.
cd "$(dirname "$0")/.." || exit 1
open "docs/qa/genesis-manual-test-execution.md"
