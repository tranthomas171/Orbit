import chromadb
from data_handlers import *

import os

path = "OrbitDB"

client = chromadb.PersistentClient(path=path)

image_handler = ImageHandler(client)
audio_handler = AudioHandler(client)

# Takes a couple mins with GPU
def add_audio(audio_collection, folder_path='data/audio'):
    # List to store IDs and URIs
    ids = []
    uris = []

    # Iterate through all files in the folder
    for filename in os.listdir(folder_path):
        if filename.endswith('.wav'):
            file_id = os.path.splitext(filename)[0]
            file_uri = os.path.join(folder_path, filename)

            ids.append(file_id)
            uris.append(file_uri)

    # Add files to the collection
    audio_collection.add(ids=ids, uris=uris)
