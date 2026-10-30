<div align="center">

# 🧠 AI Study Assistant

### Turn your study materials into structured, interactive learning experiences.

A full-stack AI-powered learning platform that transforms documents into summaries, concepts, flashcards, quizzes, and evidence-grounded learning support.

[**Live Application**](https://ai-study-ass.vercel.app) · [**Telegram Bot**](https://t.me/aistudyassbot) · [**GitHub Repository**](https://github.com/ANG-KUNG-TANG/ai-study-ass)

</div>

---

## Product demo

<!--
Add your finished demo video here.

Recommended:
1. Upload the MP4 by editing this README on GitHub.
2. Wait for GitHub to generate a video attachment URL.
3. Replace this comment with the generated URL or embed the video using
   the Markdown link GitHub provides.

Do not invent a video URL or commit a large video file unless intended.
-->

**A short walkthrough should show the complete student journey:**

| Time | Scene | What to demonstrate |
|---|---|---|
| 0–5s | Opening | The challenge of turning course documents into useful study resources |
| 5–12s | Product introduction | Actual AI Study Assistant dashboard |
| 12–21s | Document upload | Upload a real sample PDF and show its processing status |
| 21–34s | Study generation | Generated summary, concepts, flashcards, and quiz |
| 34–44s | Knowledge intelligence | Concept map, knowledge tree, and learning path |
| 44–53s | Learning interaction | AI chat and its supporting evidence |
| 53–60s | Connected experience | Telegram integration, live application, and project identity |

*Use actual screen recordings for application interfaces. Use generated motion graphics only for transitions and supporting visuals. Do not expose personal information, API keys, or private account details.*

---

## Why I built this

Students often receive learning materials as PDFs, lecture notes, technical documents, and presentations. Although these materials contain valuable information, converting them into effective study resources requires considerable manual effort.

Students must read lengthy documents, identify important concepts, write summaries, create flashcards, prepare practice questions, and determine which topics they still need to understand.

I built AI Study Assistant to reduce this manual work and make learning materials more useful for active study.

The platform does more than send an uploaded document to an AI model for a summary. It uses a multi-stage processing pipeline to extract, structure, analyse, and reason about learning content before generating study resources.

## What it does

AI Study Assistant turns static learning materials into an interactive learning workflow:

1. **Upload** course documents and study materials.
2. **Process** documents through asynchronous ingestion and text extraction.
3. **Structure** the extracted learning content.
4. **Generate** summaries, concepts, flashcards, quizzes, and explanations.
5. **Explore** concepts and their relationships through knowledge visualisations.
6. **Interact** with study content through the web application and Telegram.

```mermaid
flowchart TD
    A[Study Material] --> B[Document Upload]
    B --> C[Document Processing]
    C --> D[Text Extraction]
    D --> E[Content Structuring]
    E --> F[Study Generation]
    E --> G[Intelligence Engine]
    F --> H[Summaries / Flashcards / Quizzes]
    G --> I[Concepts / Knowledge Graph / Reasoning]
    H --> J[Learning Experience]
    I --> J
    J --> K[Web Application]
    J --> L[Telegram]
```

## Core features

### Learning workspace

- **Document upload** — use course documents and study materials as the foundation for learning.
- **AI-generated summaries** — review condensed, structured learning content.
- **Key concepts** — identify important ideas from processed material.
- **Flashcards** — practise recall using question-and-answer cards.
- **Quizzes** — test understanding with practice questions.
- **Explanations and AI chat** — ask questions and explore learning content.
- **Learning visualisations** — inspect concept maps, knowledge trees, and learning paths.
- **Feedback** — provide feedback about the learning experience.

### Knowledge-based learning

The intelligence layer represents concepts and their relationships instead of treating all learning content as unstructured text.

For example, a Computer Networks document can be organised into a structure such as:

```text
Computer Networks
│
├── IP Address
│   └── Subnet
│
├── Router
│   └── Routing
│
├── Switch
│
└── Transport Layer
    ├── TCP
    └── UDP
```

The project combines concept extraction, ontology, knowledge graphs, and Prolog-based symbolic reasoning. The intelligence engine is an active area of development.

### Asynchronous processing

- Redis and BullMQ provide the job-processing layer.
- Dedicated workers handle PDF ingestion and study generation.
- Background jobs separate long-running workloads from normal web requests.
- Queue-based processing supports job lifecycle management, retries, and failure isolation.

### Administration and observability

The project includes administrative visibility into AI usage and application operations, including:

- Per-student and provider/model usage.
- Request latency and token usage.
- Failed requests and quota events.
- Worker, Redis, MongoDB, and Telegram health.
- Application uptime and memory usage.
- Audit activity and security events.
- Document-processing jobs.

### Security

Security is considered across the application, HTTP, and container layers.

- Authentication and authorization.
- Input validation and rate limiting.
- Audit logging and secure session handling.
- Environment-based secret management.
- HTTP security headers.
- Container hardening, including non-root execution and resource restrictions where configured.

---

## Application preview

The screenshots below are expected to be stored in `docs/screenshots/`. Ensure the files are committed and that their names match exactly; GitHub paths are case-sensitive.

### Student dashboard

<p align="center">
  <img src="./docs/screenshots/dashboard.png" alt="AI Study Assistant student dashboard" width="900" />
</p>

The main learning workspace for accessing study materials and generated resources.

### Document upload

<p align="center">
  <img src="./docs/screenshots/upload.png" alt="Document upload screen" width="900" />
</p>

Upload learning materials to begin the document-processing workflow.

### Generated study resources

| Summary | Summary notes |
|---|---|
| <img src="./docs/screenshots/summary.png" alt="Generated summary" width="100%" /> | <img src="./docs/screenshots/summary-note.png" alt="Summary notes" width="100%" /> |

| Key concepts | Flashcards |
|---|---|
| <img src="./docs/screenshots/concepts.png" alt="Extracted concepts" width="100%" /> | <img src="./docs/screenshots/flashcards.png" alt="Flashcards" width="100%" /> |

### Quiz

<p align="center">
  <img src="./docs/screenshots/quiz.png" alt="Generated quiz" width="900" />
</p>

### Knowledge and intelligence views

| Concept map | Knowledge tree |
|---|---|
| <img src="./docs/screenshots/concept-map.png" alt="Concept map" width="100%" /> | <img src="./docs/screenshots/knowledge-tree.png" alt="Knowledge tree" width="100%" /> |

<p align="center">
  <img src="./docs/screenshots/learning-path.png" alt="Learning path" width="900" />
</p>

<p align="center">
  <img src="./docs/screenshots/evidence.png" alt="Evidence view" width="900" />
</p>

### Learning interaction

| AI chat | Feedback |
|---|---|
| <img src="./docs/screenshots/chat.png" alt="AI chat" width="100%" /> | <img src="./docs/screenshots/feedback.png" alt="Student feedback" width="100%" /> |

### Administration

<p align="center">
  <img src="./docs/screenshots/ai-usage.png" alt="AI usage dashboard" width="900" />
</p>

---

## How the system works

The application separates document ingestion, AI study generation, and the student-facing learning experience.

### Document processing pipeline

```mermaid
flowchart TD
    A[Student Uploads PDF] --> B[Next.js API]
    B --> C[PDF Queue]
    C --> D[PDF Worker]
    D --> E[Text Extraction]
    E --> F{Extraction Quality}
    F -->|Acceptable| G[Store Extracted Content]
    F -->|Needs improvement| H[OCR Processing]
    H --> G
    G --> I[Study Generation Queue]
    I --> J[AI Worker]
    J --> K[Generate Study Materials]
    K --> L[(MongoDB)]
    L --> M[Student Dashboard]
    L --> N[Telegram Response / Notification]
```

### AI study generation

Study-generation jobs are processed asynchronously rather than keeping a browser request open for the entire generation process.

```mermaid
flowchart TD
    A[Study Generation Job] --> B[Load Processed Content]
    B --> C[Prepare AI Context]
    C --> D[Generate Learning Resources]
    D --> E[Summary]
    D --> F[Quiz]
    D --> G[Flashcards]
    D --> H[Concepts]
    E --> I[Store Results]
    F --> I
    G --> I
    H --> I
    I --> J[Notify / Display]
```

### Intelligence engine

```mermaid
flowchart LR
    A[Learning Material] --> B[Parsing]
    B --> C[NLP Processing]
    C --> D[Concept Extraction]
    D --> E[Ontology]
    E --> F[Knowledge Graph]
    F --> G[Prolog Reasoning]
    G --> H[Knowledge Gap Detection]
    H --> I[Evidence-Grounded Learning Support]
```

The goal is to combine natural-language generation with structured knowledge and explicit reasoning.

### System architecture

```mermaid
flowchart TD
    Student[Student] --> Web[Next.js Application]
    Student --> Telegram[Telegram Bot]
    Web --> Mongo[(MongoDB)]
    Web --> Redis[(Redis)]
    Telegram --> Webhook[Telegram Webhook]
    Webhook --> Services[Application Services]
    Services --> Mongo
    Services --> Redis
    Redis --> PDF[PDF Worker]
    Redis --> AI[AI Generation Worker]
    PDF --> Mongo
    AI --> Mongo
    AI --> Provider[AI Provider]
```

### Background workers and queues

Long-running workloads are separated from the web process.

```mermaid
flowchart TB
    App[Next.js Application] --> PDFQueue[(Redis / PDF Queue)]
    App --> StudyQueue[(Redis / Study Queue)]
    PDFQueue --> PDFWorker[PDF Worker]
    StudyQueue --> AIWorker[AI Generation Worker]
    PDFWorker --> Mongo[(MongoDB)]
    AIWorker --> Mongo
    AIWorker --> AIProvider[AI Provider]
```

This architecture supports non-blocking web requests, background processing, retryable jobs, failure isolation, worker monitoring, and independent workload management.

### Telegram integration

```mermaid
flowchart TD
    A[Telegram User] --> B[Telegram Bot]
    B --> C[Webhook]
    C --> D[Next.js API]
    D --> E[Application Services]
    E --> F[Study System]
    F --> G[Telegram Response / Notification]
```

---

## Technology stack

| Category | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Node.js |
| Database | MongoDB, Mongoose |
| Queues | Redis, BullMQ, IORedis |
| AI | Google GenAI |
| Document processing | PDF Parse, Mammoth, Tesseract OCR |
| Symbolic reasoning | Tau-Prolog |
| Visualisation | XYFlow (`@xyflow/react`) |
| Authentication | JWT (`jsonwebtoken`, `jose`), Google OAuth |
| Validation | Zod |
| Email | Resend |
| Infrastructure | Docker, Docker Compose |
| Deployment | Vercel |
| Messaging | Telegram Bot API |

## Project structure

```text
ai-study-assistant/
├── app/
│   ├── api/
│   ├── admin/
│   ├── student/
│   └── ...
├── src/
│   └── server/
│       ├── config/
│       ├── intelligence/
│       │   └── prolog/
│       ├── queues/
│       ├── repositories/
│       ├── services/
│       ├── utils/
│       └── workers/
│           ├── study-generation.worker.ts
│           └── pdf-ingestion.worker.ts
├── docs/
│   └── screenshots/
├── public/
├── Dockerfile
├── compose.yaml
├── compose.prod.yaml
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Quick start

### Requirements

- Node.js 20.9 or later (required by Next.js 16).
- npm.
- Docker and Docker Compose for the local service stack.

### 1. Clone the repository

```bash
git clone https://github.com/ANG-KUNG-TANG/ai-study-ass.git
cd ai-study-ass
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create your local environment configuration and provide the database, Redis, authentication, AI, storage, and Telegram settings required by the features you intend to run.

See [Environment variables](#environment-variables).

### 4. Start supporting services

```bash
docker compose up --build -d
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Start background workers

Run the workers in separate terminals. MongoDB and Redis must be reachable.

```bash
npm run worker       # AI study-generation worker
npm run worker:pdf   # PDF ingestion worker
```

## Docker development

Start the local service stack:

```bash
docker compose up --build -d
```

Check running services:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

Stop the environment:

```bash
docker compose down
```

Typical services include:

```text
ai-study-app
ai-study-worker
ai-study-pdf-worker
ai-study-redis
ai-study-mongo
```

## Environment variables

The following are representative variable names. Check the current `.env.example` and deployment configuration for the complete, authoritative list.

```env
# Application
APP_URL=
APP_PUBLIC_URL=

# Database
MONGODB_URI=

# Redis
REDIS_URL=

# Authentication
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GOOGLE_AI_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
```

> Never commit real API keys, passwords, tokens, or private connection strings to GitHub.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:coverage` | Generate a coverage report |
| `npm run format` | Format the codebase with Prettier |
| `npm run format:check` | Check formatting |
| `npm run check` | Run typecheck, lint, tests, and build |
| `npm run worker` | Start the AI study-generation worker |
| `npm run worker:pdf` | Start the PDF ingestion worker |
| `npm run docker:build` | Build the Docker image |
| `npm run docker:up` | Start the Docker Compose stack |
| `npm run docker:down` | Stop the Docker Compose stack |
| `npm run docker:logs` | Follow application container logs |
| `npm run docker:prod` | Start the production Compose stack |

## Testing and quality checks

Run the test suite:

```bash
npm test
```

Run type checking and linting:

```bash
npm run typecheck
npm run lint
```

Run the full pre-merge check:

```bash
npm run check
```

---

## Production deployment

The web application can be deployed independently from the background workers.

```mermaid
flowchart TD
    Internet[Internet] --> Web[Next.js Web Hosting]
    Web --> Mongo[(MongoDB)]
    Web --> Redis[(Redis)]
    Web --> AIProvider[AI Provider]
    Redis --> AIWorker[AI Worker]
    Redis --> PDFWorker[PDF Worker]
    AIWorker --> Mongo
    PDFWorker --> Mongo
```

This separation allows web traffic and background workloads to be managed independently. The web application is available at [ai-study-ass.vercel.app](https://ai-study-ass.vercel.app).

## Architecture decisions

### Why background workers?

Document processing and AI generation can take significantly longer than normal API operations. Moving these tasks into queues and workers allows the API to respond quickly while processing continues asynchronously.

### Why Redis and BullMQ?

Redis provides the queue infrastructure, while BullMQ provides job management features such as retries, worker processing, and job states.

### Why MongoDB?

The application works with flexible learning content, generated resources, usage telemetry, and other document-oriented data. MongoDB provides a practical fit for these evolving structures.

### Why combine AI and symbolic reasoning?

AI models are useful for natural-language generation, summarisation, and explanations. Structured knowledge and symbolic reasoning provide explicit relationships and deterministic rule-based inference.

The project therefore explores the combination of:

```text
AI Generation
     +
Structured Knowledge
     +
Knowledge Graph
     +
Ontology
     +
Symbolic Reasoning
```

## Engineering challenges

### Long-running operations

AI generation and document processing cannot always be treated as ordinary request-response operations.

**Approach:** asynchronous queues and dedicated workers.

### PDF processing

Documents can contain different layouts, encodings, and scanned pages.

**Approach:** extraction quality checks and OCR support.

### Worker failures

Background jobs can fail independently of the web application.

**Approach:** queue-based job states, retries, and worker health monitoring.

### AI observability

AI applications require operational metrics beyond traditional CRUD monitoring.

**Approach:** track provider, model, feature, latency, token usage, failures, and usage limits.

### Secure processing

Uploaded documents should not automatically receive unrestricted access to the host environment.

**Approach:** container isolation and hardening controls, including non-root execution, dropped capabilities, resource limits, and restricted filesystems where configured.

---

## Roadmap

Potential future improvements include:

### Personalised learning

- Adaptive quiz difficulty.
- Personalised recommendations.
- Concept review priorities.
- Learning progress analysis.

### Spaced repetition

Introduce scheduling for flashcard and concept review.

### Multi-document knowledge bases

Allow multiple documents to contribute to a single course-level knowledge base.

### Advanced knowledge graphs

Improve concept extraction, relationship detection, prerequisite detection, and knowledge graph visualisation.

### Learning analytics

Expand concept mastery, quiz performance, review frequency, weak-concept detection, learning progress, and study-time trends.

---

## Project status

AI Study Assistant is an active academic and portfolio project focused on combining:

**Full-stack development + AI engineering + asynchronous systems + document processing + knowledge representation + DevOps + security.**

The project currently includes the Next.js application, TypeScript, MongoDB, Redis, BullMQ, background workers, PDF ingestion, AI study generation, Telegram integration, AI usage observability, worker health monitoring, administrative controls, audit logging, Docker-based development, and a knowledge-representation foundation.

Further intelligence-engine improvements and advanced learning personalisation remain under development.

## Author

**Ang Kung Tang**  
Computer Science / Digital Technology Innovation Student

- GitHub: [ANG-KUNG-TANG](https://github.com/ANG-KUNG-TANG)
- Project: [ai-study-ass](https://github.com/ANG-KUNG-TANG/ai-study-ass)
- Live application: [ai-study-ass.vercel.app](https://ai-study-ass.vercel.app)
- Telegram: [@aistudyassbot](https://t.me/aistudyassbot)

## License

This project is currently developed as a personal academic and portfolio project. See the repository's [LICENSE](./LICENSE) file for licensing information.
