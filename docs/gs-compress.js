/**
 * Ghostscript WASM Wrapper
 * Based on: https://github.com/krmanik/local-pdf-tools
 */

export async function compressPDF(pdfFile, quality = 'ebook', onProgress) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./background-worker.js', import.meta.url), { type: 'module' });
        
        // Create object URL from file
        const fileURL = URL.createObjectURL(pdfFile);
        
        // Map quality to Ghostscript settings
        const qualityMap = {
            'screen': '/screen',    // 72 DPI
            'ebook': '/ebook',      // 150 DPI
            'printer': '/printer'   // 300 DPI
        };
        
        const pdfSetting = qualityMap[quality] || '/ebook';
        
        // Send message to worker
        worker.postMessage({
            target: 'wasm',
            operation: 'compress',
            psDataURL: fileURL,
            pdfSetting: pdfSetting,
            showProgressBar: true
        });
        
        // Set timeout (5 minutes)
        const timeout = setTimeout(() => {
            worker.terminate();
            URL.revokeObjectURL(fileURL);
            reject(new Error('Превышено время ожидания (5 минут)'));
        }, 300000);
        
        // Handle messages from worker
        const messageHandler = (e) => {
            // Progress updates
            if (e.data.type === 'progress') {
                if (onProgress) {
                    onProgress(e.data.data);
                }
                return;
            }
            
            // Final result
            if (e.data.type === 'result') {
                clearTimeout(timeout);
                
                if (e.data.data.error) {
                    URL.revokeObjectURL(fileURL);
                    reject(new Error(e.data.data.error));
                } else {
                    // Convert blob URL to actual blob
                    fetch(e.data.data.pdfDataURL)
                        .then(res => res.blob())
                        .then(blob => {
                            URL.revokeObjectURL(fileURL);
                            URL.revokeObjectURL(e.data.data.pdfDataURL);
                            resolve(blob);
                        })
                        .catch(err => {
                            URL.revokeObjectURL(fileURL);
                            reject(err);
                        });
                }
                
                worker.removeEventListener('message', messageHandler);
                worker.removeEventListener('error', errorHandler);
                setTimeout(() => worker.terminate(), 0);
            }
        };
        
        const errorHandler = (error) => {
            clearTimeout(timeout);
            URL.revokeObjectURL(fileURL);
            reject(error);
            worker.removeEventListener('message', messageHandler);
            worker.removeEventListener('error', errorHandler);
            setTimeout(() => worker.terminate(), 0);
        };
        
        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', errorHandler);
    });
}

