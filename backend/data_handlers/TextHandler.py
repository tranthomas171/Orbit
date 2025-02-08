import os
import hashlib
import json
from datetime import datetime
from sentence_transformers import SentenceTransformer
from data_handlers import *
from chromadb import PersistentClient
import torch
import numpy as np

class MPNetEmbedding:
    def __init__(self):
        from sentence_transformers import SentenceTransformer
        self.embedding_model = SentenceTransformer("all-mpnet-base-v2")

    def __call__(self, input):
        """
        Encodes input text using the MPNet model and normalizes the embedding.
        
        Args:
            input (str or List[str]): Text or list of texts to encode.
            
        Returns:
            List[List[float]]: List of normalized embedding vectors
        """
        if not input:
            print("Input is empty!")
            return []  # Return empty list for empty input

        # Ensure input is a list
        if isinstance(input, str):
            input = [input]

        if torch.cuda.is_available():
            self.embedding_model.to('cuda')
        
        # Get embeddings
        embeddings = self.embedding_model.encode(input, convert_to_numpy=True)
        print(f"Raw embedding shape: {embeddings.shape}")
        
        # Normalize each embedding and convert to list
        normalized = []
        for emb in embeddings:
            norm = np.linalg.norm(emb)
            if norm > 0:
                normalized.append((emb / norm).tolist())
            else:
                normalized.append(emb.tolist())
            
        return normalized

class TextHandler:
    client: PersistentClient

    def __init__(self, client, base_folder='data/texts'):
        """
        Initialize the TextHandler with ChromaDB client and a base folder for storing text data.
        Each user will have a separate subdirectory in this folder.
        """
        self.client: PersistentClient = client
        self.base_folder = base_folder
        self.embedding_model = MPNetEmbedding()
        os.makedirs(self.base_folder, exist_ok=True)

    def _generate_id(self, text_content):
        """
        Generate a unique ID for the text using its content hash.

        Args:
            text_content (str): The text content to hash.

        Returns:
            str: Unique ID.
        """
        return hashlib.sha256(text_content.encode('utf-8')).hexdigest()

    def _get_user_folder(self, user_id):
        """
        Get the folder path for a specific user.

        Args:
            user_id (str): Unique identifier for the user.

        Returns:
            str: Path to the user's folder.
        """
        user_folder = os.path.join(self.base_folder, user_id)
        os.makedirs(user_folder, exist_ok=True)
        return user_folder

    def _get_user_collection(self, user_id):
        """
        Get or create a ChromaDB collection for a specific user.

        Args:
            user_id (str): Unique identifier for the user.

        Returns:
            ChromaDB collection for the user.
        """
        return self.client.get_or_create_collection(
            name=f'text_collection_{user_id}',
            embedding_function=self.embedding_model
        )
    def add_text(self, user_id, content, source_url=None, title=None, meta=None):
        """
        Add text content for a specific user to the ChromaDB collection.

        Args:
            user_id (str): Unique identifier for the user.
            content (str): The text content to store.
            source_url (str, optional): URL where the text was sourced from.
            title (str, optional): Title for the text content.
            meta (dict, optional): Additional metadata to include.
        """

        try:
            # Generate a unique ID for the text
            unique_id = self._generate_id(content)

            # Save text metadata and content to file
            user_folder = self._get_user_folder(user_id)
            file_path = os.path.join(user_folder, f"{unique_id}.json")
            
            metadata = {
                'user_id': user_id,
                'source_url': source_url,
                'title': title or 'Untitled',
                'timestamp': datetime.now().isoformat(),
                'file_path': file_path
            }

            # Merge additional metadata
            if meta:
                metadata.update(meta)

            # Sanitize metadata to replace None values
            metadata = self._sanitize_metadata(metadata)

            print(metadata)
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        'content': content,
                        'metadata': metadata
                    }, f, ensure_ascii=False, indent=2)

            # Add the text to the user's collection
            user_collection = self._get_user_collection(user_id)
            user_collection.add(
                ids=[unique_id],
                documents=[content],
                metadatas=metadata
            )

            print(f"Text {unique_id} added successfully for user {user_id}.")
            return unique_id
        except Exception as e:
            print(f"Failed to add text for user {user_id}: {e}")
            return None

    def _sanitize_metadata(self, metadata):
        """
        Sanitize metadata by:
        - Replacing None values with an empty string.
        - Serializing unsupported types (e.g., lists, dicts, objects) into JSON strings.

        Args:
            metadata (dict): Metadata dictionary to sanitize.

        Returns:
            dict: Sanitized metadata dictionary.
        """
        sanitized_metadata = {}
        for key, value in metadata.items():
            if value is None:
                sanitized_metadata[key] = ""  # Replace None with an empty string
            elif isinstance(value, (str, int, float, bool)):
                sanitized_metadata[key] = value  # Keep valid types as-is
            else:
                try:
                    # Serialize unsupported types to JSON strings
                    sanitized_metadata[key] = json.dumps(value, ensure_ascii=False)
                except Exception as e:
                    print(f"Failed to serialize metadata key '{key}' with value '{value}': {e}")
                    sanitized_metadata[key] = ""  # Fallback to empty string if serialization fails
        return sanitized_metadata

    def search_texts(self, user_id, query, n_results=5):
        """
        Retrieve texts for a specific user using a query.

        Args:
            user_id (str): Unique identifier for the user.
            query (str): Query text to search the user's texts.
            n_results (int): Number of results to return (default: 5).

        Returns:
            List[Dict]: Matching texts with metadata.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            results = user_collection.query(
                query_texts=[query],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )
            return results
        except Exception as e:
            print(f"Failed to retrieve texts for user {user_id}: {e}")
            return []

    def delete_text(self, user_id, text_id):
        """
        Delete a text entry for a specific user.

        Args:
            user_id (str): Unique identifier for the user.
            text_id (str): Unique ID of the text to delete.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            metadata = user_collection.get(ids=[text_id])
            
            if metadata and metadata['metadatas']:
                file_path = metadata['metadatas'][0].get('file_path')
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)

            # Delete from the user's collection
            user_collection.delete(ids=[text_id])
            print(f"Text {text_id} deleted successfully for user {user_id}.")
        except Exception as e:
            print(f"Failed to delete text {text_id} for user {user_id}: {e}")

    def update_text(self, user_id, text_id, new_content=None, new_metadata=None):
        """
        Update a text entry for a specific user.

        Args:
            user_id (str): Unique identifier for the user.
            text_id (str): Unique ID of the text to update.
            new_content (str, optional): New text content.
            new_metadata (dict, optional): New metadata to merge with existing.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            existing = user_collection.get(ids=[text_id])
            
            if not existing or not existing['metadatas']:
                raise ValueError(f"Text {text_id} not found for user {user_id}")

            current_metadata = existing['metadatas'][0]
            file_path = current_metadata.get('file_path')

            if new_metadata:
                current_metadata.update(new_metadata)

            if new_content or new_metadata:
                # Update the stored file
                if file_path and os.path.exists(file_path):
                    with open(file_path, 'r+', encoding='utf-8') as f:
                        data = json.load(f)
                        if new_content:
                            data['content'] = new_content
                        if new_metadata:
                            data['metadata'].update(new_metadata)
                        f.seek(0)
                        json.dump(data, f, ensure_ascii=False, indent=2)
                        f.truncate()

                # Update the collection
                user_collection.update(
                    ids=[text_id],
                    documents=[new_content] if new_content else None,
                    metadatas=[current_metadata] if new_metadata else None
                )

            print(f"Text {text_id} updated successfully for user {user_id}.")
        except Exception as e:
            print(f"Failed to update text {text_id} for user {user_id}: {e}")