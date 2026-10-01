import os
import io
import base64
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from PIL import Image, ImageOps
import requests
from huggingface_hub import InferenceClient

# Load environment variables from .env file (override=True ensures latest .env changes are read)
load_dotenv(override=True)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Maximum upload size: 10 MB
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

def get_hf_config():
    """
    Helper function to dynamically read Hugging Face configuration from environment variables.
    Sanitizes accidental duplicate prefixes or surrounding quotes.
    """
    load_dotenv(override=True)
    token = os.getenv("HF_TOKEN", "").strip()
    # Strip any accidental duplicate 'HF_TOKEN=' prefix if pasted into .env
    while token.startswith("HF_TOKEN="):
        token = token[len("HF_TOKEN="):].strip()
    if (token.startswith('"') and token.endswith('"')) or (token.startswith("'") and token.endswith("'")):
        token = token[1:-1].strip()
        
    model = os.getenv("HF_MODEL", "Qwen/Qwen2.5-VL-3B-Instruct").strip()
    return token, model

# Log startup warning if HF_TOKEN is initially missing
_initial_token, _initial_model = get_hf_config()
if not _initial_token:
    logger.warning("=" * 60)
    logger.warning("WARNING: HF_TOKEN is not set in environment variables or .env!")
    logger.warning("Please add your Hugging Face API token to .env to enable AI image analysis.")
    logger.warning("Example: HF_TOKEN=hf_your_actual_token_here")
    logger.warning("=" * 60)

# Accessibility-focused system instruction prompt
ACCESSIBILITY_PROMPT = """You are See4Me, an AI visual accessibility assistant.

Describe the provided image for a person with visual impairment.
Prioritize information that would be practically useful to someone who cannot see the image.

Focus on:
1. Important objects
2. Their approximate positions and spatial relationships
3. Potential obstacles or hazards
4. Doors, stairs, pathways and entrances when visible
5. Signs and other clearly visible text
6. Important environmental information
7. People only as general presence/count or relevant activity, never as identity
8. Objects that may require attention

Be concise, factual and easy to understand.
Do not invent information that cannot reasonably be determined from the image.
Clearly distinguish uncertainty when the image is unclear.
Do not identify or guess a person's identity.
Do not make medical, legal or safety-critical claims based solely on the image.
Use simple natural language.
Avoid unnecessary visual details.
Return a concise description that can be comfortably read aloud."""

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_image(file_storage):
    """
    Validates, auto-orients, and resizes image in memory without storing to disk.
    Returns (base64_str, mime_type).
    """
    try:
        image_bytes = file_storage.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Handle EXIF orientation if present
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        # Determine mime type
        fmt = (image.format or 'JPEG').upper()
        if fmt not in ['PNG', 'JPEG', 'WEBP']:
            fmt = 'JPEG'
            image = image.convert('RGB')
        mime_type = f"image/{fmt.lower()}"
        if mime_type == "image/jpg":
            mime_type = "image/jpeg"

        # Resize if dimensions exceed 800px to maintain maximum speed and efficiency
        max_size = (800, 800)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)

        output_buffer = io.BytesIO()
        if fmt == 'PNG':
            image.save(output_buffer, format='PNG', optimize=True)
        elif fmt == 'WEBP':
            image.save(output_buffer, format='WEBP', quality=75)
        else:
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image.save(output_buffer, format='JPEG', quality=75)
            
        output_buffer.seek(0)
        encoded_string = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        return encoded_string, mime_type
    except Exception as e:
        logger.error(f"Error processing image in PIL: {e}")
        raise ValueError("Invalid or corrupted image file.")

def query_huggingface_vlm(base64_image, mime_type):
    """
    Sends base64 image and accessibility prompt to Hugging Face Inference API.
    Uses Hugging Face InferenceClient configured with router base_url https://router.huggingface.co/v1.
    """
    hf_token, configured_model = get_hf_config()
    
    if not hf_token:
        raise ValueError("Hugging Face API token is missing. Please set HF_TOKEN in your .env file.")

    image_data_uri = f"data:{mime_type};base64,{base64_image}"
    
    # Standard OpenAI-style message payload for Vision Models
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_uri
                    }
                },
                {
                    "type": "text",
                    "text": ACCESSIBILITY_PROMPT
                }
            ]
        }
    ]

    # Models list to try in priority order (Qwen2.5-VL-72B-Instruct is hosted on HF Serverless Router)
    models_to_try = ["Qwen/Qwen2.5-VL-72B-Instruct", configured_model]
    models_to_try = list(dict.fromkeys(models_to_try))

    # Attempt 1: Hugging Face InferenceClient with router base_url
    for model_name in models_to_try:
        try:
            logger.info(f"Sending image to model {model_name} via InferenceClient (router.huggingface.co/v1)...")
            client = InferenceClient(base_url="https://router.huggingface.co/v1", api_key=hf_token, timeout=35)
            
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=300,
                temperature=0.3
            )
            
            if response and response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                if content and content.strip():
                    logger.info(f"Successfully received AI description from model {model_name}.")
                    return content.strip()
        except Exception as e:
            logger.warning(f"InferenceClient call for {model_name} failed: {e}. Trying next option...")

    # Attempt 2: Direct HTTP Request to HF Router OpenAI-compatible chat endpoint
    for model_name in models_to_try:
        try:
            logger.info(f"Attempting direct HTTP request to HF Router for {model_name}...")
            url = "https://router.huggingface.co/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "max_tokens": 300,
                "temperature": 0.3
            }
            
            resp = requests.post(url, headers=headers, json=payload, timeout=35)
            if resp.status_code == 200:
                result = resp.json()
                if "choices" in result and len(result["choices"]) > 0:
                    content = result["choices"][0]["message"]["content"]
                    if content and content.strip():
                        return content.strip()
            else:
                logger.warning(f"Router API for {model_name} returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"HTTP request for {model_name} failed: {e}")

    raise RuntimeError("Unable to analyze image. Please check your Hugging Face token permissions or try again in a moment.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    API Endpoint to receive uploaded image and return AI accessibility description.
    """
    if 'image' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No image file provided. Please upload or capture an image first.'
        }), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No file selected. Please choose a valid image file.'
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': 'Invalid file format. Please upload a PNG, JPG, JPEG, or WEBP image.'
        }), 400

    try:
        base64_img, mime_type = process_image(file)
        _, hf_model = get_hf_config()
        logger.info(f"Image successfully processed. Calling Hugging Face model {hf_model}...")
        
        description = query_huggingface_vlm(base64_img, mime_type)
        
        return jsonify({
            'success': True,
            'description': description,
            'model': hf_model
        })
    except ValueError as ve:
        logger.warning(f"Validation error: {ve}")
        return jsonify({
            'success': False,
            'error': str(ve)
        }), 400
    except Exception as e:
        logger.error(f"Server error during analysis: {e}")
        return jsonify({
            'success': False,
            'error': 'We couldn\'t analyze the image right now. Please check your network connection or API token and try again.'
        }), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'success': False,
        'error': 'The image file is too large. Maximum allowed file size is 10 MB.'
    }), 413

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting See4Me Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
