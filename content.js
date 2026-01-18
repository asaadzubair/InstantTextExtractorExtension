
// Content script for Instant Text Extractor

let isSelecting = false;
let startX, startY;
let overlay, selectionBox;

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_SELECTION') {
        initSelection();
    } else if (request.action === 'SHOW_RESULT') {
        showMiniNotification(request.text, false, request.debugImage);
    } else if (request.action === 'SHOW_ERROR') {
        showMiniNotification(request.message, true, request.debugImage);
    }
});

function initSelection() {
    if (isSelecting) return;
    isSelecting = true;

    // Create overlay
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2147483647';
    overlay.style.cursor = 'crosshair';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.3)';
    overlay.id = 'ite-selection-overlay';

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.style.border = '2px dashed #FFF';
    selectionBox.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    selectionBox.style.position = 'absolute';
    selectionBox.style.display = 'none';
    overlay.appendChild(selectionBox);

    // Add event listeners
    overlay.addEventListener('mousedown', onMouseDown);
    document.body.appendChild(overlay);

    document.body.style.userSelect = 'none';
}

function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';

    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
    e.preventDefault();
    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
}

function onMouseUp(e) {
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mouseup', onMouseUp);

    const rect = selectionBox.getBoundingClientRect();

    // Cleanup
    document.body.removeChild(overlay);
    document.body.style.userSelect = '';
    isSelecting = false;

    // If selection is too small, ignore
    if (rect.width < 10 || rect.height < 10) {
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const area = {
        x: rect.left * pixelRatio,
        y: rect.top * pixelRatio,
        width: rect.width * pixelRatio,
        height: rect.height * pixelRatio
    };

    chrome.runtime.sendMessage({
        action: 'CAPTURE_AND_EXTRACT',
        area: area
    });

    showLoadingIndicator();
}

function showLoadingIndicator() {
    const loader = document.createElement('div');
    loader.id = 'ite-loader';
    loader.style.position = 'fixed';
    loader.style.top = '20px';
    loader.style.right = '20px';
    loader.style.padding = '12px 20px';
    loader.style.background = '#222';
    loader.style.color = '#fff';
    loader.style.borderRadius = '50px';
    loader.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    loader.style.zIndex = '2147483647';
    loader.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    loader.style.fontSize = '14px';
    loader.style.fontWeight = '500';
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.gap = '10px';

    loader.innerHTML = `
    <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: ite-spin 1s linear infinite;"></div>
    <span>Extracting...</span>
    <style>
      @keyframes ite-spin { to { transform: rotate(360deg); } }
    </style>
  `;

    document.body.appendChild(loader);
}

function showMiniNotification(text, isError = false, debugImage = null) {
    // Remove loader
    const existingLoader = document.getElementById('ite-loader');
    if (existingLoader) existingLoader.remove();

    // Remove existing notification
    const existingNotify = document.getElementById('ite-notification');
    if (existingNotify) existingNotify.remove();

    const container = document.createElement('div');
    container.id = 'ite-notification';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.width = '300px';
    container.style.background = '#fff';
    container.style.boxShadow = '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)';
    container.style.borderRadius = '12px';
    container.style.zIndex = '2147483647';
    container.style.padding = '16px';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.animation = 'ite-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    // Header section
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'flex-start';
    header.style.marginBottom = '12px';

    // Title & Preview
    const titleGroup = document.createElement('div');

    const title = document.createElement('div');
    title.innerText = isError ? 'Extraction Failed' : 'Text Extracted';
    title.style.fontWeight = '600';
    title.style.fontSize = '14px';
    title.style.color = isError ? '#ef4444' : '#111';
    title.style.marginBottom = '4px';

    const preview = document.createElement('div');
    preview.innerText = text.length > 60 ? text.substring(0, 60) + '...' : text;
    preview.style.fontSize = '13px';
    preview.style.color = '#666';
    preview.style.lineHeight = '1.4';

    titleGroup.appendChild(title);
    titleGroup.appendChild(preview);
    header.appendChild(titleGroup);

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#999';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.lineHeight = '0.5';
    closeBtn.onclick = () => container.remove();

    header.appendChild(closeBtn);
    container.appendChild(header);

    // Action Buttons
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'grid';
    btnGroup.style.gridTemplateColumns = '1fr 1fr';
    btnGroup.style.gap = '8px';

    // Copy Button
    if (!isError) {
        const copyBtn = document.createElement('button');
        copyBtn.innerText = 'Copy Text';
        copyBtn.style.padding = '8px 12px';
        copyBtn.style.background = '#3b82f6';
        copyBtn.style.color = '#fff';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '6px';
        copyBtn.style.fontWeight = '500';
        copyBtn.style.fontSize = '13px';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.transition = 'background 0.2s';

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                copyBtn.style.background = '#22c55e';
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.style.background = '#3b82f6';
                }, 2000);
            });
        };
        btnGroup.appendChild(copyBtn);
    }

    // View Details Button
    const detailsBtn = document.createElement('button');
    detailsBtn.innerText = 'View Details';
    detailsBtn.style.padding = '8px 12px';
    detailsBtn.style.background = '#f3f4f6';
    detailsBtn.style.color = '#374151';
    detailsBtn.style.border = '1px solid #e5e7eb';
    detailsBtn.style.borderRadius = '6px';
    detailsBtn.style.fontWeight = '500';
    detailsBtn.style.fontSize = '13px';
    detailsBtn.style.cursor = 'pointer';
    detailsBtn.style.transition = 'background 0.2s';
    detailsBtn.onmouseover = () => detailsBtn.style.background = '#e5e7eb';
    detailsBtn.onmouseout = () => detailsBtn.style.background = '#f3f4f6';

    detailsBtn.onclick = () => {
        container.remove();
        showResultModal(text, isError, debugImage);
    };

    btnGroup.appendChild(detailsBtn);

    // If error, details button takes full width
    if (isError) {
        detailsBtn.style.gridColumn = '1 / -1';
    }

    container.appendChild(btnGroup);

    // Add animation styles
    const style = document.createElement('style');
    style.innerHTML = `
    @keyframes ite-slide-in {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
  `;
    container.appendChild(style);

    document.body.appendChild(container);
}

function showResultModal(text, isError = false, debugImage = null) {
    // Classic Large Modal implementation
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(2px)';

    const container = document.createElement('div');
    container.style.width = '500px';
    container.style.maxWidth = '90%';
    container.style.maxHeight = '90vh';
    container.style.background = '#fff';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    container.style.transition = 'all 0.2s ease-out';

    // Animate in
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1)';
    }, 10);

    // Header
    const header = document.createElement('div');
    header.style.padding = '16px 20px';
    header.style.borderBottom = '1px solid #e5e7eb';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h3');
    title.innerText = isError ? 'Error Details' : 'Extraction Details';
    title.style.margin = '0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    title.style.color = '#111';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = '#666';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => overlay.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // Content Scroll Area
    const content = document.createElement('div');
    content.style.padding = '20px';
    content.style.overflowY = 'auto';
    content.style.maxHeight = 'calc(80vh - 120px)';

    if (debugImage) {
        const imgLabel = document.createElement('div');
        imgLabel.innerText = "Captured Area";
        imgLabel.style.fontSize = '11px';
        imgLabel.style.fontWeight = '600';
        imgLabel.style.textTransform = 'uppercase';
        imgLabel.style.letterSpacing = '0.5px';
        imgLabel.style.color = '#6b7280';
        imgLabel.style.marginBottom = '8px';
        content.appendChild(imgLabel);

        const imgContainer = document.createElement('div');
        imgContainer.style.background = '#f9fafb';
        imgContainer.style.border = '1px solid #e5e7eb';
        imgContainer.style.borderRadius = '8px';
        imgContainer.style.padding = '10px';
        imgContainer.style.marginBottom = '20px';
        imgContainer.style.display = 'flex';
        imgContainer.style.justifyContent = 'center';

        const img = document.createElement('img');
        img.src = debugImage;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        img.style.objectFit = 'contain';
        imgContainer.appendChild(img);
        content.appendChild(imgContainer);
    }

    const textLabel = document.createElement('div');
    textLabel.innerText = "Extracted Text";
    textLabel.style.fontSize = '11px';
    textLabel.style.fontWeight = '600';
    textLabel.style.textTransform = 'uppercase';
    textLabel.style.letterSpacing = '0.5px';
    textLabel.style.color = '#6b7280';
    textLabel.style.marginBottom = '8px';
    content.appendChild(textLabel);

    const textArea = document.createElement('textarea');
    textArea.style.width = '100%';
    textArea.style.height = '200px';
    textArea.style.padding = '12px';
    textArea.style.border = '1px solid #d1d5db';
    textArea.style.borderRadius = '8px';
    textArea.style.fontSize = '14px';
    textArea.style.lineHeight = '1.5';
    textArea.style.color = '#374151';
    textArea.style.fontFamily = 'monospace';
    textArea.style.resize = 'vertical';
    textArea.value = text;
    // Auto select
    setTimeout(() => textArea.select(), 100);

    content.appendChild(textArea);
    container.appendChild(content);

    // Footer Actions
    const footer = document.createElement('div');
    footer.style.padding = '16px 20px';
    footer.style.background = '#f9fafb';
    footer.style.borderTop = '1px solid #e5e7eb';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '12px';

    const copyBtn = document.createElement('button');
    copyBtn.innerText = 'Copy to Clipboard';
    copyBtn.style.padding = '8px 16px';
    copyBtn.style.background = '#2563eb';
    copyBtn.style.color = '#fff';
    copyBtn.style.border = 'none';
    copyBtn.style.borderRadius = '6px';
    copyBtn.style.fontWeight = '500';
    copyBtn.style.cursor = 'pointer';
    copyBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';

    copyBtn.onclick = () => {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            copyBtn.style.background = '#16a34a';
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.background = '#2563eb';
            }, 2000);
        });
    };

    footer.appendChild(copyBtn);
    container.appendChild(footer);

    overlay.appendChild(container);

    // Close on background click
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
}
