import os
import hashlib
from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction

class ImageHandler:
    def __init__(self, client, base_folder='data/images'):
        """
        Initialize the ImageHandler with ChromaDB client and a base folder for storing images.
        Each user will have a separate subdirectory in this folder.
        """
        self.client = client
        self.base_folder = base_folder
        os.makedirs(self.base_folder, exist_ok=True)

    def _generate_id(self, file_path):
        """
        Generate a unique ID for the image using its content hash.

        Args:
            file_path (str): Path to the image file.

        Returns:
            str: Unique ID.
        """
        with open(file_path, 'rb') as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()
        return file_hash

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
            name=f'image_collection_{user_id}',
            embedding_function=OpenCLIPEmbeddingFunction()
        )

    def add_image(self, user_id, image_path):
        """
        Add an image for a specific user to the ChromaDB collection.

        Args:
            user_id (str): Unique identifier for the user.
            image_path (str): Path to the image file.
        """
        try:
            # Generate a unique ID for the image
            unique_id = self._generate_id(image_path)

            # Copy the image to the user's folder
            user_folder = self._get_user_folder(user_id)
            file_name = os.path.basename(image_path)
            destination = os.path.join(user_folder, unique_id + os.path.splitext(file_name)[1])
            if not os.path.exists(destination):
                with open(image_path, 'rb') as source_file:
                    with open(destination, 'wb') as dest_file:
                        dest_file.write(source_file.read())

            # Add the image to the user's collection
            user_collection = self._get_user_collection(user_id)
            user_collection.add(
                ids=[unique_id],
                embeddings=[],  # The embedding function handles embedding
                metadatas=[{'uri': destination, 'user_id': user_id}],
                documents=[open(destination, 'rb').read()]
            )

            print(f"Image {unique_id} added successfully for user {user_id}.")
        except Exception as e:
            print(f"Failed to add image for user {user_id}: {e}")

    def retrieve_images(self, user_id, query, n_results=5):
        """
        Retrieve images for a specific user using a query.

        Args:
            user_id (str): Unique identifier for the user.
            query (str): Query text to search the user's images.
            n_results (int): Number of results to return (default: 5).

        Returns:
            List[Dict]: Matching images with metadata.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            results = user_collection.query(
                query_texts=[query],
                n_results=n_results
            )
            return results
        except Exception as e:
            print(f"Failed to retrieve images for user {user_id}: {e}")
            return []

    def delete_image(self, user_id, image_id):
        """
        Delete an image for a specific user.

        Args:
            user_id (str): Unique identifier for the user.
            image_id (str): Unique ID of the image to delete.
        """
        try:
            user_collection = self._get_user_collection(user_id)
            metadata = user_collection.get(ids=[image_id])
            if metadata:
                file_path = metadata[0].get('uri')
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)

            # Delete from the user's collection
            user_collection.delete(ids=[image_id])
            print(f"Image {image_id} deleted successfully for user {user_id}.")
        except Exception as e:
            print(f"Failed to delete image {image_id} for user {user_id}: {e}")
