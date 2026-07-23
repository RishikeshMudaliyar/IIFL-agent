"""
Configuration module for Gemini Live Chat application.
Supports both environment variables and hardcoded fallbacks for backward compatibility.
"""

import os
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

def parse_model_config(models_env_var: Optional[str]) -> Dict[str, Any]:
    """
    Parse model configuration from environment variable or return default hardcoded values.
    
    Format: model_id|display_name|supports_video|supports_text|description
    """
    # Fallback to hardcoded models if env var not present
    default_models = {
        "gemini-live-2.5-flash-preview-native-audio": {
            "name": "Gemini Live 2.5 Flash (Native Audio)",
            "supports_video": True,
            "supports_text_output": False,
            "supports_native_audio": True,
            "description": "Best for audio-only conversations"
        },
        "gemini-2.0-flash-live-preview-04-09": {
            "name": "Gemini 2.0 Flash Live Preview",
            "supports_video": True,
            "supports_text_output": True,
            "supports_native_audio": True,
            "description": "Supports all modes: audio, text, video"
        },
        "gemini-live-2.5-flash": {
            "name": "Gemini Live 2.5 Flash",
            "supports_video": True,
            "supports_text_output": True,
            "supports_native_audio": True,
            "description": "Latest 2.5 model with video + text support"
        }
    }
    
    if not models_env_var:
        logger.info("Using default hardcoded model configuration")
        return default_models
    
    try:
        models = {}
        for model_def in models_env_var.split(','):
            parts = model_def.strip().split('|')
            if len(parts) >= 5:
                model_id, name, supports_video, supports_text, description = parts[:5]
                models[model_id.strip()] = {
                    "name": name.strip(),
                    "supports_video": supports_video.strip().lower() == 'true',
                    "supports_text_output": supports_text.strip().lower() == 'true',
                    "supports_native_audio": True,  # Assume all Live models support native audio
                    "description": description.strip()
                }
        
        logger.info(f"Loaded {len(models)} models from environment configuration")
        return models if models else default_models
        
    except Exception as e:
        logger.warning(f"Failed to parse model configuration from env: {e}. Using defaults.")
        return default_models

def parse_voice_config(voices_env_var: Optional[str]) -> Dict[str, str]:
    """
    Parse voice configuration from environment variable or return default hardcoded values.
    
    Format: voice_id|display_name|description
    """
    # Fallback to hardcoded voices if env var not present
    default_voices = {
        "Puck": "Puck",
        "Charon": "Charon", 
        "Kore": "Kore",
        "Fenrir": "Fenrir",
        "Aoede": "Aoede",
        "Leda": "Leda"
    }
    
    if not voices_env_var:
        logger.info("Using default hardcoded voice configuration")
        return default_voices
    
    try:
        voices = {}
        for voice_def in voices_env_var.split(','):
            parts = voice_def.strip().split('|')
            if len(parts) >= 2:
                voice_id, display_name = parts[:2]
                voices[voice_id.strip()] = display_name.strip()
        
        logger.info(f"Loaded {len(voices)} voices from environment configuration")
        return voices if voices else default_voices
        
    except Exception as e:
        logger.warning(f"Failed to parse voice configuration from env: {e}. Using defaults.")
        return default_voices

class Config:
    """Centralized configuration class with environment variable support and fallbacks."""
    
    def __init__(self):
        # Google Cloud Configuration
        self.PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        
        # Authentication Configuration
        self.USE_VERTEX_AI = os.getenv("USE_VERTEX_AI", "true").lower() == "true"
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        
        # Model Configuration
        self.MODELS = parse_model_config(os.getenv("GEMINI_MODELS"))
        self.DEFAULT_MODEL = os.getenv("GEMINI_DEFAULT_MODEL", "gemini-live-2.5-flash-native-audio")  # For talk mode (audio)
        self.CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash-live-preview-04-09")  # For chat mode (Live API, unused now)
        self.TEXT_CHAT_MODEL = os.getenv("GEMINI_TEXT_CHAT_MODEL", "gemini-2.0-flash")  # For chat mode (regular API)
        self.FALLBACK_TEXT_MODEL = os.getenv("GEMINI_FALLBACK_TEXT_MODEL", "gemini-2.0-flash-live-preview-04-09")
        
        # Voice Configuration
        self.VOICES = parse_voice_config(os.getenv("GEMINI_VOICES"))
        self.DEFAULT_VOICE = os.getenv("GEMINI_DEFAULT_VOICE", "Leda")
        
        # Server Configuration
        self.BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
        self.BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
        
        # Feature Defaults
        self.DEFAULT_ENABLE_VAD = os.getenv("DEFAULT_ENABLE_VAD", "true").lower() == "true"
        self.DEFAULT_ENABLE_INTERRUPTION = os.getenv("DEFAULT_ENABLE_INTERRUPTION", "true").lower() == "true"
        self.DEFAULT_INPUT_TRANSCRIPTION = os.getenv("DEFAULT_INPUT_TRANSCRIPTION", "true").lower() == "true"
        self.DEFAULT_OUTPUT_TRANSCRIPTION = os.getenv("DEFAULT_OUTPUT_TRANSCRIPTION", "true").lower() == "true"
        self.DEFAULT_ENABLE_VIDEO = os.getenv("DEFAULT_ENABLE_VIDEO", "true").lower() == "true"
        self.DEFAULT_OUTPUT_MODE = os.getenv("DEFAULT_OUTPUT_MODE", "audio")
        
        # Logging Configuration
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
        self.LOG_FILE = os.getenv("LOG_FILE", "gemini_live.log")
        
        # Development Settings
        self.SHOW_MODEL_ENDPOINTS = os.getenv("SHOW_MODEL_ENDPOINTS", "false").lower() == "true"
        self.DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
        
        # Database Configuration (PostgreSQL)
        self.DB_HOST = os.getenv("DB_HOST", "")
        self.DB_PORT = os.getenv("DB_PORT", "5432")
        self.DB_USER = os.getenv("DB_USER", "postgres")
        self.DB_PASSWORD = os.getenv("DB_PASSWORD", "")
        self.DB_NAME = os.getenv("DB_NAME", "loan_db")
        
        # SMS Configuration
        self.SMS_PROVIDER = os.getenv("SMS_PROVIDER", "smslocal")  # mock, smslocal
        
        # Validate required configurations
        self._validate_config()
        
    def _validate_config(self):
        """Validate critical configuration values."""
        if self.USE_VERTEX_AI:
            if not self.PROJECT:
                logger.error("GOOGLE_CLOUD_PROJECT is required when USE_VERTEX_AI=true")
        else:
            if not self.GEMINI_API_KEY:
                logger.error("GEMINI_API_KEY is required when USE_VERTEX_AI=false")
            
        if self.DEFAULT_MODEL not in self.MODELS:
            logger.warning(f"Default model '{self.DEFAULT_MODEL}' not found in available models")
            
        if self.FALLBACK_TEXT_MODEL not in self.MODELS:
            logger.warning(f"Fallback text model '{self.FALLBACK_TEXT_MODEL}' not found in available models")
            
        if self.DEFAULT_VOICE not in self.VOICES:
            logger.warning(f"Default voice '{self.DEFAULT_VOICE}' not found in available voices")
    
    def get_compatible_text_model(self, enable_video: bool = False) -> str:
        """
        Get the best compatible model for text output.
        
        Args:
            enable_video: Whether video input is enabled
            
        Returns:
            Model ID that supports text output
        """
        # Use configured fallback model
        fallback_model = self.FALLBACK_TEXT_MODEL
        
        # Validate the fallback model supports text output
        if fallback_model in self.MODELS and self.MODELS[fallback_model].get('supports_text_output', False):
            return fallback_model
            
        # If fallback model doesn't work, find any model that supports text
        for model_id, model_info in self.MODELS.items():
            if model_info.get('supports_text_output', False):
                logger.warning(f"Using {model_id} as fallback since configured fallback model doesn't support text")
                return model_id
                
        # Last resort - return the configured fallback anyway
        logger.error("No text-compatible models found! Using configured fallback anyway.")
        return fallback_model

# Global configuration instance
config = Config()