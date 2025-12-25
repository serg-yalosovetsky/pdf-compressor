# Ghostscript WASM Integration

## Что это?

Это **настоящее** сжатие PDF через Ghostscript, работающее прямо в браузере благодаря WebAssembly!

## Откуда взяли?

Мы адаптировали рабочую реализацию из проекта [local-pdf-tools](https://github.com/krmanik/local-pdf-tools), который успешно использует Ghostscript WASM для сжатия PDF в браузере.

## Что скопировали?

Из `local-pdf-tools/src/lib/` мы взяли:

1. **`gs-worker.wasm`** (13 MB) - Ghostscript скомпилированный в WebAssembly с полным Emscripten runtime
2. **`gs-worker.js`** (184 KB) - Emscripten glue code для работы с WASM
3. **`background-worker.js`** (18 KB) - Web Worker для выполнения сжатия в отдельном потоке
4. **`worker-init.js`** (1.5 KB) - Инициализация и управление worker'ом

## Наша обёртка

Мы создали упрощённую обёртку `gs-compress.js`, которая:
- Создаёт Web Worker
- Передаёт PDF файл и настройки качества
- Получает сжатый результат
- Обрабатывает ошибки и таймауты

## Как это работает?

1. **Пользователь загружает PDF** → создаётся blob URL
2. **Вызывается `compressPDF()`** → создаётся Web Worker
3. **Worker загружает `gs-worker.js`** → который загружает `gs-worker.wasm`
4. **Emscripten создаёт виртуальную файловую систему** в памяти
5. **PDF записывается в виртуальный `input.pdf`**
6. **Ghostscript выполняется с аргументами** (например: `-sDEVICE=pdfwrite -dPDFSETTINGS=/ebook`)
7. **Результат читается из виртуального `output.pdf`**
8. **Blob возвращается в основной поток** → скачивается пользователем

## Преимущества

✅ **Настоящее сжатие** - 70-90% как в локальной версии  
✅ **Приватность** - всё в браузере, файлы не уходят на сервер  
✅ **Не требует установки** - работает на любом устройстве  
✅ **GitHub Pages** - можно хостить бесплатно  

## Недостатки

⚠️ **Медленно** - в 5-10 раз медленнее нативного Ghostscript  
⚠️ **Большой размер** - первая загрузка ~15 MB  
⚠️ **Требует много RAM** - лимит 100 MB (может крашнуть на очень сложных файлах)  
⚠️ **Не работает в старых браузерах** - требует WebAssembly и Web Workers  

## Файлы

```
docs/
├── compress-wasm.html      # HTML страница с UI
├── gs-compress.js          # Наша обёртка для удобного использования
├── background-worker.js    # Web Worker (из local-pdf-tools)
├── gs-worker.js            # Emscripten glue code (из local-pdf-tools)
├── gs-worker.wasm          # Ghostscript WASM (из local-pdf-tools)
└── worker-init.js          # Инициализация worker (из local-pdf-tools)
```

## Использование

```javascript
import { compressPDF } from './gs-compress.js';

const pdfFile = /* File object */;
const quality = 'ebook'; // 'screen', 'ebook', 'printer'

try {
    const compressedBlob = await compressPDF(
        pdfFile, 
        quality,
        (progress) => console.log(progress)
    );
    
    // Скачать результат
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed.pdf';
    a.click();
} catch (error) {
    console.error('Compression failed:', error);
}
```

## Настройки качества

- **`screen`** → `-dPDFSETTINGS=/screen` (72 DPI, максимальное сжатие)
- **`ebook`** → `-dPDFSETTINGS=/ebook` (150 DPI, рекомендуется)
- **`printer`** → `-dPDFSETTINGS=/printer` (300 DPI, минимальная потеря качества)

## Технические детали

### Emscripten Runtime

`gs-worker.js` содержит полный Emscripten runtime, который предоставляет:
- Виртуальную файловую систему (FS)
- Эмуляцию POSIX функций
- Управление памятью
- Сотни функций окружения (invoke_vi, invoke_vii, и т.д.)

### Web Worker

Сжатие выполняется в отдельном потоке, чтобы не блокировать UI:
- Основной поток создаёт Worker
- Worker загружает и выполняет Ghostscript
- Результат передаётся обратно через `postMessage`

### Таймауты

- **5 минут** для сжатия (можно изменить в `gs-compress.js`)
- При превышении Worker принудительно завершается

## Отладка

Откройте консоль браузера для просмотра:
- Логов Ghostscript (префикс `GS:`)
- Ошибок (префикс `GS Error:`)
- Прогресса обработки

## Благодарности

Спасибо проекту [local-pdf-tools](https://github.com/krmanik/local-pdf-tools) за рабочую реализацию Ghostscript WASM!

## Лицензия

Ghostscript распространяется под GPL-3.0 лицензией.

