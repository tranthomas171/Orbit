from __future__ import annotations

import os
import hashlib
from pathlib import Path
from typing import List, Optional, Dict, Any, Sequence, Union
from dataclasses import dataclass

import torch
import torchaudio
from chromadb.api.types import Document, Embedding, EmbeddingFunction, URI
from transformers import ClapModel, ClapProcessor

class AudioProcessingError(Exception):
    """Custom exception for audio processing errors."""
    pass

class FileOperationError(Exception):
    """Custom exception for file operation errors."""
    pass

@dataclass
class AudioMetadata:
    """Data class for audio file metadata."""
    uri: str
    user_id: str
    original_sample_rate: int
    target_sample_rate: int
    duration: float

class AudioLoader:
    """Loads and processes audio files to a standardized format."""
    
    def __init__(self, target_sample_rate: int = 48000) -> None:
        """
        Initialize the audio loader.

        Args:
            target_sample_rate: The desired sample rate for all audio files.
        """
        self.target_sample_rate = target_sample_rate

    def _load_audio(self, uri: Optional[URI]) -> Optional[Dict[str, Any]]:
        """
        Load and process a single audio file.

        Args:
            uri: Path to the audio file.

        Returns:
            Dict containing processed waveform and metadata, or None if loading fails.

        Raises:
            AudioProcessingError: If audio processing fails.
        """
        if uri is None:
            return None

        try:
            waveform, sample_rate = torchaudio.load(uri)
            
            # Process audio to standard format
            processed_waveform = self._standardize_audio(waveform, sample_rate)
            
            return {
                "waveform": processed_waveform,
                "uri": uri,
                "original_sample_rate": sample_rate,
                "duration": len(processed_waveform) / self.target_sample_rate
            }
            
        except Exception as e:
            raise AudioProcessingError(f"Error loading audio file {uri}: {str(e)}")

    def _standardize_audio(self, waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
        """
        Standardize audio to target sample rate and mono channel.

        Args:
            waveform: The input audio waveform.
            sample_rate: The original sample rate.

        Returns:
            Standardized audio waveform.
        """
        # Resample if necessary
        if sample_rate != self.target_sample_rate:
            resampler = torchaudio.transforms.Resample(sample_rate, self.target_sample_rate)
            waveform = resampler(waveform)

        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)

        return waveform.squeeze()

    def __call__(self, uris: Sequence[Optional[URI]]) -> List[Optional[Dict[str, Any]]]:
        """
        Process multiple audio files.

        Args:
            uris: Sequence of file paths to process.

        Returns:
            List of processed audio data dictionaries.
        """
        results = []
        for uri in uris:
            try:
                results.append(self._load_audio(uri))
            except AudioProcessingError as e:
                print(f"Warning: {str(e)}")
                results.append(None)
        return results

class CLAPEmbedder(EmbeddingFunction):
    """Generates embeddings for audio and text using the CLAP model."""
    
    def __init__(
        self,
        model_name: str = "laion/larger_clap_general",
        device: Optional[str] = None
    ) -> None:
        """
        Initialize the CLAP embedder.

        Args:
            model_name: Name of the CLAP model to use.
            device: Device to run the model on (cuda/cpu).
        """
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ClapModel.from_pretrained(model_name).to(self.device)
        self.processor = ClapProcessor.from_pretrained(model_name)

    def _encode_audio(self, audio: torch.Tensor) -> Embedding:
        """
        Generate embedding for audio input.

        Args:
            audio: Audio waveform tensor.

        Returns:
            Audio embedding.
        """
        inputs = self.processor(
            audios=audio.numpy(), 
            sampling_rate=48000, 
            return_tensors="pt"
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            embedding = self.model.get_audio_features(**inputs)
        
        return embedding.squeeze().cpu().numpy().tolist()

    def _encode_text(self, text: str) -> Embedding:
        """
        Generate embedding for text input.

        Args:
            text: Input text.

        Returns:
            Text embedding.
        """
        inputs = self.processor(text=text, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            embedding = self.model.get_text_features(**inputs)
        
        return embedding.squeeze().cpu().numpy().tolist()

    def __call__(
        self, 
        inputs: Union[List[str], List[Optional[Dict[str, Any]]]]
    ) -> List[Optional[Embedding]]:
        """
        Generate embeddings for a batch of inputs.

        Args:
            inputs: List of text strings or audio data dictionaries.

        Returns:
            List of embeddings.
        """
        embeddings = []
        for item in inputs:
            if isinstance(item, dict) and 'waveform' in item:
                embeddings.append(self._encode_audio(item['waveform']))
            elif isinstance(item, str):
                embeddings.append(self._encode_text(item))
            elif item is None:
                embeddings.append(None)
            else:
                raise ValueError(f"Unsupported input type: {type(item)}")
        return embeddings

class AudioHandler:
    """Manages audio file storage and retrieval using ChromaDB."""
    
    def __init__(
        self, 
        client: Any,
        base_folder: Union[str, Path] = 'data/audio',
        target_sample_rate: int = 48000
    ) -> None:
        """
        Initialize the audio library.

        Args:
            client: ChromaDB client instance.
            base_folder: Base directory for storing audio files.
            target_sample_rate: Target sample rate for audio processing.
        """
        self.client = client
        self.base_folder = Path(base_folder)
        self.target_sample_rate = target_sample_rate
        
        self._ensure_base_folder()
        
        self.audio_loader = AudioLoader(target_sample_rate=target_sample_rate)
        self.embedder = CLAPEmbedder()

    def _ensure_base_folder(self) -> None:
        """Create base folder if it doesn't exist."""
        self.base_folder.mkdir(parents=True, exist_ok=True)

    def _generate_file_id(self, file_path: Union[str, Path]) -> str:
        """
        Generate a unique ID for an audio file using its content hash.

        Args:
            file_path: Path to the audio file.

        Returns:
            Unique file ID.
        """
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()

    def _get_user_folder(self, user_id: str) -> Path:
        """
        Get or create folder for a specific user.

        Args:
            user_id: User identifier.

        Returns:
            Path to user's folder.
        """
        user_folder = self.base_folder / user_id
        user_folder.mkdir(exist_ok=True)
        return user_folder

    def _get_user_collection(self, user_id: str) -> Any:
        """
        Get or create ChromaDB collection for a user.

        Args:
            user_id: User identifier.

        Returns:
            ChromaDB collection.
        """
        return self.client.get_or_create_collection(
            name=f'audio_collection_{user_id}',
            embedding_function=self.embedder,
            data_loader=self.audio_loader
        )

    def add_audio(self, user_id: str, audio_path: Union[str, Path]) -> Optional[str]:
        """
        Add an audio file to a user's collection.

        Args:
            user_id: User identifier.
            audio_path: Path to the audio file.

        Returns:
            File ID if successful, None otherwise.
        """
        try:
            audio_path = Path(audio_path)
            file_id = self._generate_file_id(audio_path)
            user_folder = self._get_user_folder(user_id)
            
            # Create destination path with original extension
            destination = user_folder / f"{file_id}{audio_path.suffix}"
            
            if not destination.exists():
                destination.write_bytes(audio_path.read_bytes())

            # Process audio file
            waveform, sample_rate = torchaudio.load(str(destination))
            processed_audio = self.audio_loader._standardize_audio(waveform, sample_rate)
            
            # Create metadata
            metadata = AudioMetadata(
                uri=str(destination),
                user_id=user_id,
                original_sample_rate=sample_rate,
                target_sample_rate=self.target_sample_rate,
                duration=len(processed_audio) / self.target_sample_rate
            )

            # Add to collection
            collection = self._get_user_collection(user_id)
            collection.add(
                ids=[file_id],
                uris=[str(destination)],
                metadatas=[metadata.__dict__]
            )

            return file_id
            
        except Exception as e:
            raise FileOperationError(f"Failed to add audio file: {str(e)}")

    def retrieve_audio(
        self, 
        user_id: str, 
        query: str, 
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for audio files using text query.

        Args:
            user_id: User identifier.
            query: Text query.
            n_results: Maximum number of results.

        Returns:
            List of matching audio files with metadata.
        """
        try:
            collection = self._get_user_collection(user_id)
            return collection.query(
                query_texts=[query],
                n_results=n_results
            )
        except Exception as e:
            raise AudioProcessingError(f"Failed to retrieve audio files: {str(e)}")

    def delete_audio(self, user_id: str, file_id: str) -> None:
        """
        Delete an audio file from a user's collection.

        Args:
            user_id: User identifier.
            file_id: File identifier to delete.
        """
        try:
            collection = self._get_user_collection(user_id)
            metadata = collection.get(ids=[file_id])
            
            if metadata:
                file_path = Path(metadata[0].get('uri'))
                if file_path.exists():
                    file_path.unlink()

            collection.delete(ids=[file_id])
            
        except Exception as e:
            raise FileOperationError(f"Failed to delete audio file: {str(e)}")

    def search_by_audio(
        self, 
        user_id: str, 
        query_audio_path: Union[str, Path], 
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar audio files using an audio query.

        Args:
            user_id: User identifier.
            query_audio_path: Path to query audio file.
            n_results: Maximum number of results.

        Returns:
            List of matching audio files with metadata.
        """
        try:
            # Load and process query audio
            waveform, sample_rate = torchaudio.load(str(query_audio_path))
            processed_audio = self.audio_loader._standardize_audio(waveform, sample_rate)
            
            # Generate embedding and search
            collection = self._get_user_collection(user_id)
            query_embedding = self.embedder._encode_audio(processed_audio)
            
            return collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results
            )
            
        except Exception as e:
            raise AudioProcessingError(f"Failed to search by audio: {str(e)}")