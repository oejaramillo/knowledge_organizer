# Research Knowledge Management System

#### Video Demo:  https://www.youtube.com/watch?v=GJJy3LNGHzE

## Description

A comprehensive personal bibliography and research management platform that integrates Zotero synchronization, AI-powered content enrichment, and an interactive web dashboard for managing academic papers, research projects, ideas, tasks, meetings, books and general personal track of literature and insights.

## Project Overview and history

I'm involved in academic research specially in economics and social sciences and one of the problems we had me and my team is that is very difficult to track everything related to a research project. Zotero is an incredible tool that helps keep bibliography organized in different folders and topics, is also usefull as a centralized files administration that classifies bibliography, but is still not enough for a complete research project, that is why I decided to improve zotero adding more functionalities related to project administration such as a binnacle, ideas tracking, meeting records with contributors and why not ai enrichment that makes easier to detect key information when is needed.

So I used Zotero local API to synchronize the data in a structured database, it uses zotero folders as projects keeping the nested folder struchture, the papers and authors, we added to the database ideas, tasks, binnacle and meetings that are related to a specific project. Given that I also use zotero as my personal bibliography and reading list, I added a reading track flag for papers in each project and a reading recommendation that selects at random from a given project not yet read articles and books. Each synchronization just deals with new additions, new, papers, projects or annotations but I also have a force option in case I need to sync everything again.

Each paper in zotero has a lot of information but given that one of the best uses of AI is literally process data, I added a AI enrichment capacity that reads my annotations and highlights of the paper in zotero or reads the entire paper file in the case it is available in my local computer and the paper has no annotations and enrich the database with discipline, theoretical framework, citation intent some flags for replication or code availability and one of the most important and interesting enrichments: claims, concepts and datasets if available all of this is built with deepseek API but it can also use other providers such as openai. The main goal is to organize knowledge in a better way so it is useful to me when I need it.

Given that I also use it as a personal reading list I also added more information about the authors that in the future will help me have an idea of what im reading the most, from where, and insights, also added a coll optional picture of the author that improves the experience specially when reading philosophy or history.

There is also other tables in the database that implements embeddings where in the future I can process the files of each paper and save its vector so I can even improve the level of knowledge extraction, this is not yet implemented and honetly not sure how to start yet, but is considered, same with some other tables that I still didnt implemented such as research questions.

Now I can finally not just have all the information I need in the same place, but also it is a dashboard for managing my team and my tasks in research projects, I had all of this information in Obsidian before, it worked but it was not that easy to access the data, with the dashboard is far easier, I have plans to add other pages with stats of pages read, stats of meetings and tasks and more things, I've been currently using the app and each time I used it I discovered a new bug that I continously solved, the app is intended to be used just for me at least right now, it is connected to my personal ZOtero local API and it works just in my computer I dont need it to be in the cloud so I think I will just leave it like this I basically use it almost every day and is very usefull.

The design and options are mine, I researched some architecture designs, the styles are almost entirely AI recommendations and they are very good, some code algorithms are also AI recommended to solve specific problems that turn out to be very difficult to solve speccially in the frontend implementation, with which I still dont have many experience.

The architecture follows a three-layer approach: data ingestion and synchronization, intelligent content processing, and interactive visualization and management.

## System Architecture

### Core Database Schema (`schema_v2.sql`)

The heart of the system is a PostgreSQL database schema that models the full spectrum of research activities I do. Key entities include:

- **Papers**: Central repository for all academic literature with rich metadata
- **Authors**: Comprehensive author management with institutional affiliations, country and optional picture  
- **Projects**: Hierarchical project organization mirroring Zotero collections
- **Claims**: Multi-type assertions (empirical, theoretical, normative, historical)
- **Concepts**: Theoretical constructs with disciplinary context
- **Methods**: Research methodology taxonomy across paradigms
- **Annotations**: Synchronized highlights and notes from Zotero
- **Ideas**: My research insights linked to projects and papers
- **BInnacle**: Annotations of the overall status of a project that I add to keep track in time of what is going on, specially useful when projects dilates in time
- **Meeting**: A simple way to keep track of who attend and what was discussed project realted meetings
- **Tasks**: A simple way to keep track of what I have to do and what I have to encourage in contributors

The schema includes features like vector embeddings for semantic search, evidence linking between claims across paradigms, and comprehensive audit trails (not yet implemented).

### Database Initialization (`app.py`)

The main application entry point handles database schema initialization. This loads environment variables, establishes database connections, and executes the schema SQL file. In production it uses a NEON personal database.

### Zotero Synchronization Layer (`zotero_sync/`)

This module provides comprehensive two-way synchronization with Zotero libraries through the Local API:

- **`zotero_client.py`**: Handles communication with Zotero's Local API, managing library versions, change detection, and data retrieval. Implements intelligent fallback mechanisms for timestamp-based synchronization when version tracking is unavailable.

- **`sync.py`**: Orchestrates the complete synchronization workflow, determining whether to perform full or incremental syncs based on library version changes. Coordinates parallel synchronization of projects, papers, authors, attachments, and annotations.

- **`sync_papers.py`, `sync_authors.py`, `sync_projects.py`**: Specialized sync modules handling the mapping between Zotero's data structures and the database schema. Each module implements upsert logic to handle both new items and updates to existing records.

### AI Enrichment Pipeline (`ai_enrichments/`)

This content processing system tries to extracts structured knowledge from research papers using large language models:

- **`enrich.py`**: Main orchestrator providing flexible processing modes - annotation-driven for efficiency or full-text for comprehensiveness that uses the actual file, (still havent solved OCR). Supports multiple AI providers and includes robust error handling and retry mechanisms.

- **`extractor.py`**: Database interface and PDF text extraction utilities. Implements content prioritization, using annotations when available and falling back to full-text extraction for comprehensive analysis.

- **`prompts.py`**: Carefully crafted prompts designed to extract structured information across multiple research paradigms. Prompts are optimized for generating consistent parseable outputs.

- **`parser.py`**: Robust response parsing that handles structured AI outputs and converts them into database-ready formats. Includes validation and error recovery for malformed responses.

- **`writer.py`**: Database persistence layer that handles the task of inserting enriched content while maintaining referential integrity and avoiding duplicates.

- **`providers/`**: Abstracted AI provider implementations supporting OpenAI (not implemented in production) and DeepSeek APIs, enabling easy switching between models and cost optimization.

### Web Dashboard (`board/`)

A modern full-stack web application providing interactive access to the research knowledge base:

#### Backend (`board/backend/`)

Built with FastAPI, the backend provides a comprehensive REST API:

- **`main.py`**: Application configuration and routing setup with CORS support for frontend integration
- **`api/`**: Modular API endpoints for each major entity (papers, projects, tasks, ideas, etc.)
- **`models/`**: SQLAlchemy ORM models providing type-safe database interactions
- **`schemas/`**: Pydantic models for request/response validation and serialization
- **`core/`**: Database configuration and dependency injection setup

#### Frontend (`board/frontend/`)

A React-based single-page application with modern UI components:

- **React Router**: Client-side routing for smooth navigation
- **Tailwind CSS**: Utility-first styling for responsive design (fully AI)
- **Axios**: HTTP client for API communication

The frontend provides intuitive interfaces for browsing papers, managing projects, tracking tasks, and visualizing research insights.

## Key Features and Design Choices

### Hierarchical Project Organization

Projects mirror Zotero collection hierarchies while extending functionality for active research management. This design maintains familiar organizational patterns while adding capabilities for task tracking, team collaboration, and idea development.

### Vector Embeddings for Semantic Search

Integration of pgvector wants to enable semantic similarity searches across papers and concepts, supporting discovery of related work that might not share keywords but addresses similar theoretical or empirical questions specially for future explorations and reasearch and assisted writting but is no yet implemented.

### Comprehensive Audit Trail

The change log system ensures reproducibility and accountability in research workflows, tracking how insights and annotations evolve over time (just thougth not implemented).

### Local-First Architecture

The system is designed for local deployment.

## Installation and Setup

### Prerequisites

- Python 3.12+
- PostgreSQL with pgvector extension
- Node.js 18+
- UV/UVX for Python package management

### Environment Configuration

Create a `.env` file with:

```
DATABASE_URL=NEON_database_link_in_production
ZOTERO_URL=http://localhost:23119/api
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
```

### Database Setup

```bash
# Initialize database schema
python app.py
```

### Running the System

Recommended by AI in my Linux system, a Justfile that runs the virtual environment, the backend and the frontend for faster iniziatlization:

```bash
# Start both backend and frontend
just start

# Or individually:
# Backend: cd board/backend && uvicorn main:app --reload
# Frontend: cd board/frontend && npm run dev
```

### Synchronization and Enrichment

```bash
# Sync from Zotero
python -m zotero_sync.sync

# AI enrichment (annotation-based)
python -m ai_enrichments.enrich

# AI enrichment (full-text)
python -m ai_enrichments.enrich --full-text
```

## Usage Workflow

1. **Import**: Organize papers in Zotero collections, then sync to populate the database
2. **Annotate**: Highlight and annotate papers in Zotero; annotations sync automatically
3. **Enrich**: Run AI enrichment to extract structured insights from papers
4. **Manage**: Use the web dashboard to organize projects, track tasks, and develop ideas
5. **Discover**: Leverage semantic search and evidence linking to find connections across your research (**stay tuned**)

## Technical Decisions and Rationale

### PostgreSQL with Extensions

PostgreSQL was chosen for its mature ecosystem, ACID compliance, and extension capabilities. The pgvector extension enables efficient semantic search without requiring separate vector databases and I worked with it before.

### FastAPI Backend

FastAPI provides automatic API documentation, type safety, and high performance for the API layer while maintaining Python's ecosystem advantages, I think is easier than django and even flask.

### Modular Synchronization

Separate sync modules for each entity type enable targeted updates and easier maintenance while preventing data inconsistencies during partial sync failures but it gives me problems sometime managing routes.

### React Frontend

Have to research a lot, first time I use it, AI helped a lot specially with styles and some logic 