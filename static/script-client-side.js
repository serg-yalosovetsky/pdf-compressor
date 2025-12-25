// Элементы DOM
const uploadForm = document.getElementById('upload-form');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-file');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFileBtn = document.getElementById('remove-file');
const compressBtn = document.getElementById('compress-btn');
const progressSection = document.getElementById('progress-section');
const progressText = document.getElementById('progress-text');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const resetBtn = document.getElementById('reset-btn');
const errorResetBtn = document.getElementById('error-reset-btn');

let selectedFile = null;
let originalFileSize = 0;

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Обработка клика на зону загрузки
dropZone.addEventListener('click', (e) => {
    if (e.target.classList.contains('browse-link') || e.target === dropZone) {
        fileInput.click();
    }
});

// Обработка выбора файла
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Drag and Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFileSelect(file);
    } else {
        showError('Пожалуйста, выберите PDF файл');
    }
});

// Обработка выбранного файла
function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
        showError('Пожалуйста, выберите PDF файл');
        return;
    }

    // Ограничение для клиентской версии - 20 MB
    const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_SIZE) {
        showError(
            `Размер файла ${formatFileSize(file.size)} слишком большой для браузерной версии. ` +
            `Максимум: ${formatFileSize(MAX_SIZE)}. ` +
            `Для больших файлов используйте локальную версию с Ghostscript (до 90% сжатия): ` +
            `https://github.com/vakovalskii/pdf-compressor`
        );
        return;
    }

    // Предупреждение для файлов больше 10 MB
    if (file.size > 10 * 1024 * 1024) {
        console.warn(`⚠️ Файл ${formatFileSize(file.size)} может обрабатываться медленно в браузере.`);
    }

    selectedFile = file;
    originalFileSize = file.size;
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    dropZone.style.display = 'none';
    fileInfo.style.display = 'flex';
    compressBtn.disabled = false;
}

// Удаление файла
removeFileBtn.addEventListener('click', () => {
    resetForm();
});

// Сброс формы
function resetForm() {
    selectedFile = null;
    originalFileSize = 0;
    fileInput.value = '';
    
    dropZone.style.display = 'block';
    fileInfo.style.display = 'none';
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    compressBtn.disabled = false;
}

// Сжатие PDF в браузере
async function compressPdfClientSide(file, quality) {
    try {
        progressText.textContent = 'Загрузка PDF...';
        
        // Читаем файл
        const arrayBuffer = await file.arrayBuffer();
        
        progressText.textContent = 'Анализ PDF...';
        
        // Загружаем PDF с помощью pdf-lib с обработкой ошибок
        let pdfDoc;
        try {
            pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
                ignoreEncryption: true,
                throwOnInvalidObject: false
            });
        } catch (loadError) {
            console.error('Ошибка загрузки PDF:', loadError);
            
            // Проверяем типичные проблемы
            if (loadError.message.includes('encrypted') || loadError.message.includes('password')) {
                throw new Error('PDF защищён паролем. Клиентская версия не поддерживает зашифрованные PDF. Используйте локальную версию.');
            }
            if (loadError.message.includes('Invalid') || loadError.message.includes('corrupt')) {
                throw new Error('PDF файл повреждён или имеет нестандартную структуру. Используйте локальную версию с Ghostscript.');
            }
            if (loadError.message.includes('too large')) {
                throw new Error('PDF слишком сложный для обработки в браузере. Используйте локальную версию.');
            }
            
            throw new Error('Не удалось загрузить PDF. Попробуйте локальную версию с Ghostscript для лучшей совместимости.');
        }
        
        // Получаем качество сжатия
        let imageQuality;
        switch(quality) {
            case 'low':
                imageQuality = 0.3;
                break;
            case 'medium':
                imageQuality = 0.6;
                break;
            case 'high':
                imageQuality = 0.85;
                break;
            default:
                imageQuality = 0.6;
        }
        
        progressText.textContent = 'Оптимизация PDF...';
        
        // Получаем все страницы
        const pages = pdfDoc.getPages();
        
        // Обрабатываем каждую страницу
        for (let i = 0; i < pages.length; i++) {
            progressText.textContent = `Обработка страницы ${i + 1} из ${pages.length}...`;
            
            const page = pages[i];
            
            // Уменьшаем размер страницы если нужно
            if (quality === 'low') {
                const { width, height } = page.getSize();
                page.scale(0.75, 0.75);
            }
        }
        
        progressText.textContent = 'Сохранение сжатого PDF...';
        
        // Сохраняем с оптимизацией
        const pdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50,
        });
        
        progressText.textContent = 'Готово!';
        
        return pdfBytes;
        
    } catch (error) {
        console.error('Ошибка при сжатии:', error);
        
        // Если это наша кастомная ошибка, пробрасываем её
        if (error.message.includes('Используйте локальную версию') || 
            error.message.includes('защищён паролем') ||
            error.message.includes('повреждён')) {
            throw error;
        }
        
        // Общая ошибка
        throw new Error(
            'Не удалось сжать PDF в браузере. ' +
            'Файл может быть слишком сложным или большим. ' +
            'Используйте локальную версию с Ghostscript для лучшего результата: ' +
            'https://github.com/vakovalskii/pdf-compressor'
        );
    }
}

// Обработка отправки формы
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
        showError('Пожалуйста, выберите файл');
        return;
    }

    const quality = document.querySelector('input[name="quality"]:checked').value;
    
    // Показываем прогресс
    compressBtn.disabled = true;
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        // Сжимаем PDF в браузере
        const compressedBytes = await compressPdfClientSide(selectedFile, quality);
        
        const compressedSize = compressedBytes.length;
        
        // Создаем Blob для скачивания
        const blob = new Blob([compressedBytes], { type: 'application/pdf' });
        
        // Скачиваем файл
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed_${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Показываем результат
        showResult(originalFileSize, compressedSize);

    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Произошла ошибка при сжатии файла');
    } finally {
        progressSection.style.display = 'none';
        compressBtn.disabled = false;
    }
});

// Показать результат
function showResult(originalSize, compressedSize) {
    const savedSize = originalSize - compressedSize;
    const savedPercent = Math.round((savedSize / originalSize) * 100);

    document.getElementById('original-size').textContent = formatFileSize(originalSize);
    document.getElementById('compressed-size').textContent = formatFileSize(compressedSize);
    
    if (savedSize > 0) {
        document.getElementById('saved-size').textContent = `${formatFileSize(savedSize)} (${savedPercent}%)`;
    } else {
        // Иногда файл может стать больше из-за особенностей PDF
        document.getElementById('saved-size').textContent = `0 Bytes (0%)`;
        document.getElementById('saved-size').parentElement.classList.remove('highlight');
    }

    resultSection.style.display = 'block';
    errorSection.style.display = 'none';
}

// Показать ошибку
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    resultSection.style.display = 'none';
    progressSection.style.display = 'none';
}

// Кнопки сброса
resetBtn.addEventListener('click', resetForm);
errorResetBtn.addEventListener('click', resetForm);

// Информация при загрузке
window.addEventListener('load', () => {
    console.log('🔒 Клиентская версия загружена. Все файлы обрабатываются только в браузере.');
    console.log('⚠️ Клиентское сжатие работает медленнее и менее эффективно, чем серверное через Ghostscript.');
});

