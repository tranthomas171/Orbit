# Orbit: Simplify Your Digital World
## About Us
### Orbit is a tri-modal data storage and retrieval system designed for seamless organization and retrieval of your digital content. With Orbit, you can save text, images, URLs, videos, and entire webpages effortlessly, and retrieve them using powerful semantic and keyword-based searches.
## Technical Details
- **Frontend**: React-based web dashboard for managing and searching saved items.
- **Backend**: Python-powered API using a modified version of ChromaDB for vector storage.
- **Embeddings**: CLIP for text and images, CLAP for audio.
- **Chrome Extension**: Enables quick saving of digital content.
- **Deployment**: TBD
## Intended Use Cases
- **Students**: Save and organize research materials and class notes.
- **People with Memory Challenges**: Keep track of important links, images, and notes.
- **Researchers**: Store and search through academic papers, data, and media.
- **Industry Professionals**: Manage digital resources for projects and collaboration.
- **Casual Browsers**: Save and revisit interesting content effortlessly.

## Todo List
### Frontend
- [x] Set up React web dashboard.
- [x] Design a simple, user-friendly interface for search and data management.
- [x] Integrate semantic search functionality.
- [ ] Implement item deletion capabilities.

### Backend
- [x] Build a REST API with FastAPI or Flask.
- [x] Configure ChromaDB for persistent vector storage.
- [x] Integrate CLIP and CLAP embeddings for tri-modal search.
- [x] Implement semantic and keyword search endpoints.

### Chrome Extension
- [x] Develop a Manifest V3 extension.
- [x] Add functionality to save text, images, videos, URLs, and webpages.
- [x] Set up temporary storage using Chrome Storage API.

### Deployment
- [x] Select a deployment platform (e.g., Fly.io, Render).
- [ ] Deploy backend and frontend components.

### Future Enhancements
- [ ] Create an iOS app for mobile functionality.
- [ ] Add advanced filtering options for search.
- [ ] Implement data visualization features in the dashboard.

