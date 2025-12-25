from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import uuid
from pathlib import Path
import shutil

app = FastAPI(title="PDF Compressor Service")

# CORS middleware для работы с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем директории для временных файлов
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

# Настройки качества для Ghostscript
QUALITY_SETTINGS = {
    "low": "/screen",      # 72 dpi - минимальный размер файла
    "medium": "/ebook",    # 150 dpi - хороший баланс
    "high": "/printer"     # 300 dpi - высокое качество
}


def compress_pdf_ghostscript(input_path: str, output_path: str, quality: str) -> bool:
    """
    Сжимает PDF используя Ghostscript
    """
    gs_command = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={QUALITY_SETTINGS[quality]}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={output_path}",
        input_path
    ]
    
    try:
        result = subprocess.run(gs_command, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ghostscript error: {e.stderr.decode()}")
        return False
    except FileNotFoundError:
        print("Ghostscript не установлен. Установите его: brew install ghostscript (macOS)")
        return False


@app.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = Form(...)
):
    """
    Эндпоинт для сжатия PDF файлов
    """
    # Проверка типа файла
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате PDF")
    
    # Проверка качества
    if quality not in QUALITY_SETTINGS:
        raise HTTPException(status_code=400, detail="Неверный уровень качества")
    
    # Генерируем уникальные имена файлов
    unique_id = str(uuid.uuid4())
    input_filename = f"{unique_id}_input.pdf"
    output_filename = f"{unique_id}_output.pdf"
    input_path = TEMP_DIR / input_filename
    output_path = TEMP_DIR / output_filename
    
    try:
        # Сохраняем загруженный файл
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Получаем размер исходного файла
        original_size = os.path.getsize(input_path)
        
        # Сжимаем PDF
        success = compress_pdf_ghostscript(str(input_path), str(output_path), quality)
        
        if not success:
            raise HTTPException(status_code=500, detail="Ошибка при сжатии PDF")
        
        # Получаем размер сжатого файла
        compressed_size = os.path.getsize(output_path)
        compression_ratio = (1 - compressed_size / original_size) * 100
        
        print(f"Оригинальный размер: {original_size / 1024:.2f} KB")
        print(f"Сжатый размер: {compressed_size / 1024:.2f} KB")
        print(f"Сжатие: {compression_ratio:.1f}%")
        
        # Возвращаем сжатый файл
        return FileResponse(
            path=output_path,
            filename=f"compressed_{file.filename}",
            media_type="application/pdf",
            background=None
        )
        
    except Exception as e:
        # Очистка в случае ошибки
        if input_path.exists():
            input_path.unlink()
        if output_path.exists():
            output_path.unlink()
        raise HTTPException(status_code=500, detail=f"Ошибка: {str(e)}")
    
    finally:
        # Удаляем входной файл сразу
        if input_path.exists():
            input_path.unlink()


@app.get("/health")
async def health_check():
    """Проверка работоспособности сервиса"""
    # Проверяем наличие Ghostscript
    try:
        subprocess.run(["gs", "--version"], check=True, capture_output=True)
        gs_available = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        gs_available = False
    
    return {
        "status": "ok",
        "ghostscript_available": gs_available
    }


# Монтируем статические файлы (HTML, CSS, JS)
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

