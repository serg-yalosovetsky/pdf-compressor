#!/bin/bash

# Скрипт для запуска PDF Compressor

echo "🚀 Запуск PDF Compressor..."
echo ""

# Проверка установки Ghostscript
if ! command -v gs &> /dev/null
then
    echo "❌ Ghostscript не установлен!"
    echo "Установите его:"
    echo "  macOS: brew install ghostscript"
    echo "  Ubuntu/Debian: sudo apt-get install ghostscript"
    exit 1
fi

echo "✅ Ghostscript установлен: $(gs --version)"
echo ""

# Проверка Python
if ! command -v python3 &> /dev/null
then
    echo "❌ Python 3 не установлен!"
    exit 1
fi

echo "✅ Python установлен: $(python3 --version)"
echo ""

# Установка зависимостей если нужно
if [ ! -d "venv" ]; then
    echo "📦 Создание виртуального окружения..."
    python3 -m venv venv
fi

echo "📦 Активация виртуального окружения..."
source venv/bin/activate

echo "📦 Установка зависимостей..."
pip install -q -r requirements.txt

echo ""
echo "✨ Запуск сервера..."
echo "🌐 Откройте в браузере: http://localhost:8000"
echo ""
echo "Нажмите Ctrl+C для остановки сервера"
echo ""

python3 main.py

