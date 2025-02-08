import os
import hashlib
import json
import base64
import tempfile
import shutil
from datetime import datetime
from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction
from chromadb.utils.data_loaders import ImageLoader

class ImageHandler:
    def __init__(self, client, base_folder='data/images'):
        """
        Initialize the ImageHandler with a ChromaDB client and a base folder for storing images.
        Each user will have a separate subdirectory in this folder.
        """
        self.client = client
        self.base_folder = base_folder
        os.makedirs(self.base_folder, exist_ok=True)
        self.embedding_function = OpenCLIPEmbeddingFunction()
        self.data_loader = ImageLoader()

    def _generate_id(self, image_bytes):
        """
        Generate a unique ID for the image based on its content hash.

        Args:
            image_bytes (bytes): Raw image data.

        Returns:
            str: Unique ID.
        """
        return hashlib.sha256(image_bytes).hexdigest()

    def _get_user_folder(self, user_id):
        """
        Get (and create if needed) the folder path for a specific user.

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
            The user's ChromaDB collection.
        """
        return self.client.get_or_create_collection(
            name=f'image_collection_{user_id}',
            embedding_function=self.embedding_function,
            data_loader=self.data_loader
        )

    def _sanitize_metadata(self, metadata):
        """
        Sanitize metadata by replacing None values with empty strings and serializing unsupported types.

        Args:
            metadata (dict): The metadata dictionary.

        Returns:
            dict: Sanitized metadata.
        """
        sanitized = {}
        for key, value in metadata.items():
            if value is None:
                sanitized[key] = ""
            elif isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            else:
                try:
                    sanitized[key] = json.dumps(value, ensure_ascii=False)
                except Exception as e:
                    print(f"Failed to serialize metadata key '{key}': {e}")
                    sanitized[key] = ""
        return sanitized

    def add_image(self, user_id, image_data, meta=None, source_url=None, title=None):
        """
        Add an image (provided as a data URI) for a specific user to the ChromaDB collection.

        This method decodes the data URI, writes the image bytes to a temporary file,
        moves the file to a user-specific permanent folder, builds metadata, and then adds
        the image to the ChromaDB collection using the file's permanent path.

        Args:
            user_id (str): Unique identifier for the user.
            image_data (str): The image data as a data URI.
            meta (dict, optional): Additional metadata to include.
            source_url (str, optional): URL from where the image originated.
            title (str, optional): Title for the image.

        Returns:
            str: The unique ID of the added image, or None if an error occurs.
        """
        try:
            # Verify that the image_data is a valid data URI.
            if not image_data.startswith("data:image"):
                raise ValueError("Provided image data is not a valid data URI.")

            # Split the data URI into header and base64-encoded data.
            try:
                header, encoded = image_data.split(',', 1)
            except ValueError:
                raise ValueError("Invalid data URI format. Expected a comma separator.")

            # Decode the base64-encoded image data.
            try:
                image_bytes = base64.b64decode(encoded)
            except Exception as e:
                raise ValueError("Error decoding base64 image data.") from e

            # Extract the file format (e.g., 'png') from the header (e.g., "data:image/png;base64").
            try:
                file_format = header.split(';')[0].split('/')[1]
            except IndexError:
                raise ValueError("Could not determine image format from data URI header.")

            # Generate a unique ID for the image based on its bytes.
            unique_id = self._generate_id(image_bytes)

            # Write the image bytes to a temporary file.
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_format}") as temp_file:
                temp_file.write(image_bytes)
                temp_file_path = temp_file.name

            # Prepare the permanent destination path.
            user_folder = self._get_user_folder(user_id)
            permanent_file_name = f"{unique_id}.{file_format}"
            permanent_path = os.path.join(user_folder, permanent_file_name)

            # Move the temporary file to the permanent location.
            if not os.path.exists(permanent_path):
                shutil.move(temp_file_path, permanent_path)
            else:
                # If the file already exists, remove the temporary file.
                os.remove(temp_file_path)

            # Build the metadata dictionary.
            metadata = {
                'user_id': user_id,
                'timestamp': datetime.now().isoformat(),
                'file_path': permanent_path,
                'source': 'data_uri',
                'source_url': source_url,
                'title': title,
            }
            if meta:
                metadata.update(meta)

            metadata = self._sanitize_metadata(metadata)
            print(metadata)

            # Add the image to the user's ChromaDB collection.
            user_collection = self._get_user_collection(user_id)
            user_collection.add(
                ids=[unique_id],
                uris=[permanent_path],  # Use the permanent file path as the URI.
                metadatas=[metadata]
            )

            print(f"Image {unique_id} added successfully for user {user_id}.")
            return unique_id
        except Exception as e:
            print(f"Failed to add image for user {user_id}: {e}")
            return None

    def search_images(self, user_id, query, n_results=5):
        """
        Retrieve images for a specific user using a query.

        Args:
            user_id (str): Unique identifier for the user.
            query (str): Query text to search the user's images.
            n_results (int, optional): Number of results to return (default: 5).

        Returns:
            dict: Query results containing matching images and metadata.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            results = user_collection.query(
                query_texts=[query],
                n_results=n_results,
                include=['uris', 'metadatas', 'distances']
            )
            return results
        except Exception as e:
            print(f"Failed to search images for user {user_id}: {e}")
            return {}

    def delete_image(self, user_id, image_id):
        """
        Delete an image for a specific user.

        Args:
            user_id (str): Unique identifier for the user.
            image_id (str): Unique ID of the image to delete.

        Returns:
            bool: True if deletion was successful, False otherwise.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            # Retrieve the metadata for the image.
            result = user_collection.get(ids=[image_id])
            if result and 'metadatas' in result and result['metadatas']:
                metadata = result['metadatas'][0]
                file_path = metadata.get('file_path')
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)

            # Delete the image from the ChromaDB collection.
            user_collection.delete(ids=[image_id])
            print(f"Image {image_id} deleted successfully for user {user_id}.")
            return True
        except Exception as e:
            print(f"Failed to delete image {image_id} for user {user_id}: {e}")
            return False
