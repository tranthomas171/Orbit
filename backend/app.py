# main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import chromadb
from chromadb.config import Settings
import torch
import numpy as np
from PIL import Image
import io
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ORBIT Backend")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path="./data")

# Initialize collections for different types of data
text_collection = chroma_client.get_or_create_collection(name="text_data")
image_collection = chroma_client.get_or_create_collection(name="image_data")
video_collection = chroma_client.get_or_create_collection(name="video_data")

# Initialize CLIP model
device = "cuda" if torch.cuda.is_available() else "cpu"
model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
model = model.to(device)

class Item(BaseModel):
    type: str
    content: str
    url: str
    title: str
    timestamp: str

class SearchQuery(BaseModel):
    query: str
    type: Optional[str] = None
    limit: int = 10

def get_text_embedding(text: str) -> List[float]:
    """Generate text embedding using CLIP"""
    with torch.no_grad():
        text_tokens = open_clip.tokenize([text]).to(device)
        text_features = model.encode_text(text_tokens)
        return text_features.cpu().numpy()[0].tolist()

def get_image_embedding(image_url: str) -> List[float]:
    """Generate image embedding using CLIP"""
    try:
        response = requests.get(image_url)
        image = Image.open(io.BytesIO(response.content))
        image = preprocess(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            image_features = model.encode_image(image)
            return image_features.cpu().numpy()[0].tolist()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

def extract_text_from_html(html_content: str) -> str:
    """Extract readable text from HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    return " ".join(soup.stripped_strings)

@app.post("/api/save")
async def save_item(item: Item):
    try:
        item_id = f"{item.type}_{datetime.now().timestamp()}"
        metadata = {
            "url": item.url,
            "title": item.title,
            "timestamp": item.timestamp,
            "type": item.type
        }

        if item.type == "text":
            embedding = get_text_embedding(item.content)
            text_collection.add(
                embeddings=[embedding],
                documents=[item.content],
                metadatas=[metadata],
                ids=[item_id]
            )
        
        elif item.type == "image":
            embedding = get_image_embedding(item.content)
            image_collection.add(
                embeddings=[embedding],
                documents=[item.content],  # Store image URL
                metadatas=[metadata],
                ids=[item_id]
            )
        
        elif item.type == "page":
            text_content = extract_text_from_html(item.content)
            embedding = get_text_embedding(text_content)
            text_collection.add(
                embeddings=[embedding],
                documents=[text_content],
                metadatas=[metadata],
                ids=[item_id]
            )
        
        elif item.type in ["video", "link"]:
            embedding = get_text_embedding(item.title + " " + item.content)
            text_collection.add(
                embeddings=[embedding],
                documents=[item.content],
                metadatas=[metadata],
                ids=[item_id]
            )

        return {"status": "success", "id": item_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search")
async def search_items(query: SearchQuery):
    try:
        search_embedding = get_text_embedding(query.query)
        
        results = []
        if query.type in [None, "text", "page", "link", "video"]:
            text_results = text_collection.query(
                query_embeddings=[search_embedding],
                n_results=query.limit
            )
            results.extend([{
                "id": id,
                "content": doc,
                "metadata": meta,
                "distance": dist
            } for id, doc, meta, dist in zip(
                text_results['ids'][0],
                text_results['documents'][0],
                text_results['metadatas'][0],
                text_results['distances'][0]
            )])
            
        if query.type in [None, "image"]:
            image_results = image_collection.query(
                query_embeddings=[search_embedding],
                n_results=query.limit
            )
            results.extend([{
                "id": id,
                "content": doc,
                "metadata": meta,
                "distance": dist
            } for id, doc, meta, dist in zip(
                image_results['ids'][0],
                image_results['documents'][0],
                image_results['metadatas'][0],
                image_results['distances'][0]
            )])
            
        # Sort results by distance
        results.sort(key=lambda x: x['distance'])
        return {"results": results[:query.limit]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/items/{item_id}")
async def delete_item(item_id: str):
    try:
        # Determine collection based on item_id prefix
        collection_type = item_id.split('_')[0]
        if collection_type in ["text", "page", "link", "video"]:
            text_collection.delete(ids=[item_id])
        elif collection_type == "image":
            image_collection.delete(ids=[item_id])
            
        return {"status": "success", "message": f"Item {item_id} deleted"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

# .env
CHROMA_DB_PATH="./data"
MODEL_DEVICE="cuda"  # or "cpu"
CORS_ORIGINS=["http://localhost:3000", "chrome-extension://your-extension-id"]