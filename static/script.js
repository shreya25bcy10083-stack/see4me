/**
 * See4Me - AI Visual Accessibility Assistant
 * Client-side script handling Image Upload, Camera Capture, API Requests, 
 * Web Speech API Text-to-Speech, and Screen Reader ARIA Announcements.
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const body = document.body;
    const contrastToggle = document.getElementById('contrastToggle');
    const contrastToggleText = document.getElementById('contrastToggleText');
    const liveAnnouncer = document.getElementById('liveAnnouncer');

    // Error Alert
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const dismissErrorBtn = document.getElementById('dismissErrorBtn');

    // Action Controls
    const imageInput = document.getElementById('imageInput');
    const uploadLabel = document.getElementById('uploadLabel');
    const cameraBtn = document.getElementById('cameraBtn');
    
    // Camera Modal Controls
    const cameraModal = document.getElementById('cameraModal');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const switchCameraBtn = document.getElementById('switchCameraBtn');

    // Preview & Analysis Controls
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Result & Speech Controls
    const resultSection = document.getElementById('resultSection');
    const descriptionText = document.getElementById('descriptionText');
    const speakBtn = document.getElementById('speakBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const speechStatus = document.getElementById('speechStatus');

    // State Variables
    let selectedFile = null;
    let cameraStream = null;
    let currentFacingMode = 'environment'; // Prefer rear camera on mobile
    let currentUtterance = null;

    /* ==========================================================================
       1. Screen Reader Live Announcements & Accessibility Utilities
       ========================================================================== */
    function announce(message, isAssertive = false) {
        if (!liveAnnouncer) return;
        liveAnnouncer.setAttribute('aria-live', isAssertive ? 'assertive' : 'polite');
        // Clear momentarily to trigger DOM change event for screen reader engine
        liveAnnouncer.textContent = '';
        setTimeout(() => {
            liveAnnouncer.textContent = message;
        }, 50);
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorAlert.classList.remove('hidden');
        errorAlert.focus();
        announce(`Error: ${msg}`, true);
    }

    function clearError() {
        errorAlert.classList.add('hidden');
        errorMessage.textContent = '';
    }

    dismissErrorBtn.addEventListener('click', clearError);

    /* ==========================================================================
       2. High Contrast Theme Toggle
       ========================================================================== */
    const isHighContrastSaved = localStorage.getItem('see4me_high_contrast') === 'true';
    if (isHighContrastSaved) {
        enableHighContrast(true);
    }

    contrastToggle.addEventListener('click', () => {
        const isCurrentlyActive = body.classList.contains('high-contrast');
        enableHighContrast(!isCurrentlyActive);
    });

    function enableHighContrast(enable) {
        if (enable) {
            body.classList.add('high-contrast');
            contrastToggle.setAttribute('aria-pressed', 'true');
            contrastToggleText.textContent = 'Standard Mode';
            localStorage.setItem('see4me_high_contrast', 'true');
            announce('High contrast mode enabled.');
        } else {
            body.classList.remove('high-contrast');
            contrastToggle.setAttribute('aria-pressed', 'false');
            contrastToggleText.textContent = 'High Contrast Mode';
            localStorage.setItem('see4me_high_contrast', 'false');
            announce('Standard mode enabled.');
        }
    }

    /* ==========================================================================
       3. Keyboard Navigation Support for Custom Controls
       ========================================================================== */
    // Ensure file upload button activates on Enter or Space key
    uploadLabel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            imageInput.click();
        }
    });

    /* ==========================================================================
       4. File Upload Handling
       ========================================================================== */
    imageInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileSelected(files[0]);
        }
    });

    function handleFileSelected(file) {
        clearError();
        stopSpeaking();

        // Validate image file type
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
        if (!validTypes.includes(file.type)) {
            showError('Please select a valid image file (PNG, JPG, JPEG, or WEBP).');
            return;
        }

        // Validate image size (10 MB max)
        if (file.size > 10 * 1024 * 1024) {
            showError('File is too large. Please select an image under 10 MB.');
            return;
        }

        selectedFile = file;

        // Render preview image
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            previewSection.classList.remove('hidden');
            resultSection.classList.add('hidden');
            analyzeBtn.disabled = false;
            
            // Scroll preview into view smoothly
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            analyzeBtn.focus();

            announce(`Image selected: ${file.name}. Press Analyze Image to proceed.`);
        };
        reader.onerror = () => {
            showError('Failed to read selected image file.');
        };
        reader.readAsDataURL(file);
    }

    /* ==========================================================================
       5. Camera Support & Stream Management
       ========================================================================== */
    cameraBtn.addEventListener('click', startCamera);
    closeCameraBtn.addEventListener('click', stopCamera);

    async function startCamera() {
        clearError();
        stopSpeaking();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Camera access is unavailable on this browser or device. You can upload an image instead.');
            return;
        }

        try {
            const constraints = {
                video: {
                    facingMode: currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraVideo.srcObject = cameraStream;
            cameraModal.classList.remove('hidden');
            
            // Trap keyboard focus inside camera modal
            captureBtn.focus();
            announce('Camera active. Point your device and press Capture Photo when ready.');

            // Check if multiple camera devices exist to show switch camera button
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputCount = devices.filter(d => d.kind === 'videoinput').length;
            if (videoInputCount > 1) {
                switchCameraBtn.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Camera access error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showError('Camera access was denied. You can upload an image instead.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                showError('No camera device was found. You can upload an image instead.');
            } else {
                showError('Camera access is unavailable. You can upload an image instead.');
            }
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraModal.classList.add('hidden');
        cameraBtn.focus();
        announce('Camera closed.');
    }

    switchCameraBtn.addEventListener('click', () => {
        currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
        stopCamera();
        startCamera();
    });

    captureBtn.addEventListener('click', capturePhoto);

    function capturePhoto() {
        if (!cameraStream || !cameraVideo.videoWidth) {
            showError('Camera preview is not ready. Please try again.');
            return;
        }

        // Draw frame to hidden canvas
        cameraCanvas.width = cameraVideo.videoWidth;
        cameraCanvas.height = cameraVideo.videoHeight;
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

        // Convert canvas snapshot to JPEG blob
        cameraCanvas.toBlob((blob) => {
            if (!blob) {
                showError('Failed to capture photo frame.');
                return;
            }
            const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera();
            handleFileSelected(file);
            announce('Photo captured successfully.');
        }, 'image/jpeg', 0.9);
    }

    // Allow Esc key to close camera overlay
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !cameraModal.classList.contains('hidden')) {
            stopCamera();
        }
    });

    /* ==========================================================================
       6. Image Analysis Workflow (API Call)
       ========================================================================== */
    analyzeBtn.addEventListener('click', analyzeImage);

    async function analyzeImage() {
        if (!selectedFile) {
            showError('Please upload or capture an image first.');
            return;
        }

        clearError();
        stopSpeaking();

        // UI Transition to Loading State
        analyzeBtn.disabled = true;
        previewSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');

        announce('Analyzing image with AI. Please wait...');

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            loadingIndicator.classList.add('hidden');

            if (data.success) {
                renderDescription(data.description);
                announce('Analysis complete. AI description is ready below. Press Read Aloud to hear description.');
            } else {
                previewSection.classList.remove('hidden');
                analyzeBtn.disabled = false;
                showError(data.error || 'We couldn\'t analyze the image right now. Please try again.');
            }
        } catch (err) {
            console.error('Fetch API error:', err);
            loadingIndicator.classList.add('hidden');
            previewSection.classList.remove('hidden');
            analyzeBtn.disabled = false;
            showError('Network error. We couldn\'t connect to the See4Me backend server.');
        }
    }

    function renderDescription(text) {
        // Clear previous text
        descriptionText.innerHTML = '';

        // Format paragraphs nicely
        const paragraphs = text.split('\n\n').filter(p => p.strip !== '');
        if (paragraphs.length > 0) {
            paragraphs.forEach(p => {
                const para = document.createElement('p');
                para.textContent = p.trim();
                descriptionText.appendChild(para);
            });
        } else {
            const para = document.createElement('p');
            para.textContent = text;
            descriptionText.appendChild(para);
        }

        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Focus results for keyboard/screen reader users
        resultSection.focus();
    }

    /* ==========================================================================
       7. Web Speech API - Text-To-Speech Implementation
       ========================================================================== */
    const isSpeechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

    if (!isSpeechSupported) {
        speechStatus.textContent = 'Text-to-speech is not supported by this browser. You can still read the description on screen.';
        speakBtn.disabled = true;
        stopBtn.disabled = true;
    }

    speakBtn.addEventListener('click', speakDescription);
    stopBtn.addEventListener('click', stopSpeaking);
    resetBtn.addEventListener('click', resetAll);

    function speakDescription() {
        if (!isSpeechSupported) return;

        // Stop any active speech
        stopSpeaking();

        const textToRead = descriptionText.innerText || descriptionText.textContent;
        if (!textToRead || textToRead.trim() === '') {
            showError('No description available to read aloud.');
            return;
        }

        currentUtterance = new SpeechSynthesisUtterance(textToRead);
        
        // Configure clear speech parameters
        currentUtterance.rate = 0.95; // Slightly deliberate speed for clarity
        currentUtterance.pitch = 1.0;

        // Select a standard English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (preferredVoice) {
            currentUtterance.voice = preferredVoice;
        }

        currentUtterance.onstart = () => {
            speakBtn.disabled = true;
            stopBtn.disabled = false;
            speechStatus.textContent = '🔊 Reading description aloud...';
            announce('Reading description aloud.');
        };

        currentUtterance.onend = () => {
            speakBtn.disabled = false;
            stopBtn.disabled = true;
            speechStatus.textContent = 'Finished reading aloud.';
            announce('Finished reading description aloud.');
        };

        currentUtterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            speakBtn.disabled = false;
            stopBtn.disabled = true;
            speechStatus.textContent = 'Speech playback stopped.';
        };

        window.speechSynthesis.speak(currentUtterance);
    }

    function stopSpeaking() {
        if (isSpeechSupported && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        speakBtn.disabled = false;
        stopBtn.disabled = true;
        speechStatus.textContent = '';
    }

    /* ==========================================================================
       8. Reset Application State
       ========================================================================== */
    function resetAll() {
        stopSpeaking();
        clearError();

        selectedFile = null;
        imageInput.value = '';
        imagePreview.src = '';
        descriptionText.innerHTML = '';

        previewSection.classList.add('hidden');
        loadingIndicator.classList.add('hidden');
        resultSection.classList.add('hidden');
        analyzeBtn.disabled = true;

        uploadLabel.focus();
        announce('Reset complete. Select or capture a new image.');
    }
});
