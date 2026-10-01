# See4Me - AI Visual Accessibility Assistant

See4Me is an open-source, AI-powered visual accessibility assistant designed specifically for people with visual impairments. Users can upload or capture an image, receive a concise, structured visual description powered by an open vision-language model, and listen to the description using text-to-speech.

---

## 1. Problem

Navigating physical environments or interpreting visual content can present significant challenges for visually impaired individuals. Standard image captioning systems often provide generic or aesthetic descriptions (e.g. "A photo of a dog outside") rather than practical accessibility information, such as spatial relationships, potential obstacles, entrances, signs, or environmental hazard warnings.

---

## 2. Solution

See4Me addresses this challenge by combining WCAG-focused web accessibility design with an open vision-language model (`Qwen/Qwen2.5-VL-3B-Instruct`). 

When an image is submitted, See4Me passes it through a carefully structured accessibility system prompt that prioritizes:
- Important objects and spatial relationships
- Pathways, entrances, stairs, and doors
- Obstacles or potential hazards
- Text on signs or labels
- Environmental context

The description is rendered on screen with screen reader support (`aria-live="polite"`) and can be read aloud immediately using the browser's native Web Speech API.

---

## 3. Features

* 📁 **Image Upload**: Upload images (PNG, JPG, JPEG, WEBP) directly from your device.
* 📷 **Camera Capture**: Live camera preview and snapshot capture using browser media APIs.
* ⚡ **AI Visual Description**: Real-time analysis using `Qwen/Qwen2.5-VL-3B-Instruct` via Hugging Face Inference Providers.
* 🎯 **Accessibility-Focused Prompting**: Specialized prompts designed to deliver actionable spatial and safety-aware descriptions.
* 🔊 **Text-to-Speech**: Built-in speech synthesis (`window.speechSynthesis`) with **Read Aloud** and **Stop Speaking** controls.
* ♿ **Keyboard Navigation**: Full keyboard navigation support (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`) with high-visibility focus indicators.
* 📢 **Screen Reader Support**: Semantic HTML5 elements (`<header>`, `<main>`, `<section>`, `<button>`) and ARIA live regions (`aria-live="polite"`).
* 🌗 **High Contrast Mode**: Built-in theme toggle offering ultra-high contrast styling for users with low vision.
* 🔒 **Privacy First**: Images are processed strictly in memory and are never permanently stored in a database or on disk.

---

## 4. Technology Stack

* **Backend**: Python 3.10+, Flask
* **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript
* **AI Provider**: Hugging Face Inference Providers (`huggingface_hub` `InferenceClient`)
* **Vision Model**: `Qwen/Qwen2.5-VL-3B-Instruct`
* **Text-to-Speech**: Browser Web Speech API (`window.speechSynthesis`)
* **Image Processing**: Pillow (PIL)
* **Configuration**: `python-dotenv`

---

## 5. Installation & Setup

### Prerequisites

* Python 3.10 or higher installed.
* A free Hugging Face API token from [Hugging Face Settings](https://huggingface.co/settings/tokens).

### Step-by-Step Setup

1. **Clone or navigate to the repository directory**:
   ```bash
   cd See4Me
   ```

2. **Create a virtual environment**:
   * **Windows**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   * **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` in a text editor and add your Hugging Face API token:
   ```env
   HF_TOKEN=hf_your_actual_token_here
   HF_MODEL=Qwen/Qwen2.5-VL-3B-Instruct
   ```

5. **Run the Application**:
   ```bash
   python app.py
   ```

6. **Access See4Me**:
   Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

---

## 6. Testing & Accessibility Guidelines

### Testing Keyboard Navigation
1. Press `Tab` to navigate through controls (`Skip to content`, `High Contrast Mode`, `Upload Image`, `Use Camera`).
2. Press `Enter` or `Space` to activate buttons or upload labels.
3. Open the camera view and press `Escape` to close the overlay.

### Testing Screen Reader Support
1. Enable NVDA, JAWS, or macOS VoiceOver.
2. Select an image. Hear the automatic status announcement: *"Image selected... Press Analyze Image to proceed."*
3. Activate **Analyze Image**. Hear the live status update: *"Analyzing image with AI. Please wait..."* followed by completion confirmation.

### Testing the Image → AI → Speech Workflow
1. Upload or capture an image.
2. Click **⚡ Analyze Image**.
3. Confirm the AI description is displayed on screen.
4. Click **🔊 Read Aloud** to listen to the description. Click **⏹ Stop Speaking** to pause playback.

---

## 7. Open Source & Model Licensing

* **See4Me Application**: Distributed under the [MIT License](LICENSE).
* **AI Model**: Uses `Qwen/Qwen2.5-VL-3B-Instruct` developed by the Qwen team at Alibaba Cloud under the Apache 2.0 license. See the [Qwen2.5-VL-3B-Instruct Model Card](https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct) for full model terms and details.

---

## 8. Disclaimer

AI-generated descriptions may be inaccurate, incomplete, or contain errors. See4Me is an assistive tool and must **NOT** be relied upon alone for navigation, obstacle avoidance, or safety-critical decisions.
