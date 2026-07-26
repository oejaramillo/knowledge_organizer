# knowledge_organizer

## Zotero syncing

Uses Zotero localapi to synchornize projects, papers, authors, attachments and annotations in that order and its relationships, it keeps track of previous synchronizations.

```
cd zotero_sync
python sync.py
```

## AI enrichment

Uses deepseek api or openai api as providers to read papers annotations or full papers and baed on that enrich the database with metadata information as discipline, theretical frameword, citation intent and language, also based on the information creates claims, concepts, methods and variables where it applies, fully robust to different types of literature, the prompt carries the paper information and ask the AI for JSON, then parsed and saved in the database.

```
cd ai_enrichments
# Annotation-driven mode (default) — fast and cheap
python -m ai_enrichments.enrich

# Full-text mode — thorough, uses more tokens
python -m ai_enrichments.enrich --full-text

# Force re-process already processed papers
python -m ai_enrichments.enrich --force

# Process a single paper by zotero_key
python -m ai_enrichments.enrich --key ABCD1234

# Use a different provider
python -m ai_enrichments.enrich --provider openai

# Dry run — shows what would be processed, writes nothing
python -m ai_enrichments.enrich --dry-run
```

## Board and UI for reading and editing the database
## Starting the backend
```
cd board/backend/
uvicorn main:app --reload
```

## Starting the frontend
```
# Make sure you are in the knowledge_organizer/board folder
npm create vite@latest frontend -- --template react

# Move into the new frontend folder
cd frontend

# Install the base React packages
npm install

# Install the tools we need: Router, Axios (for API calls), and Icons
npm install react-router-dom axios lucide-react

# Install and initialize Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

npm run dev
```


Great question. Let me explain the mental model clearly.

---

## The 4 layers of a React app

```
main.jsx          ← boots the app, nothing else
App.jsx           ← defines ALL routes (the map of the app)
layouts/          ← the shell (sidebar, navbar) that wraps pages
pages/            ← one file per "screen"
components/       ← reusable building blocks used inside pages
```

---

### `main.jsx` — the ignition key

```jsx
ReactDOM.createRoot(...).render(<App />)
```

You never touch this. It just starts React and mounts `App`. One job, done.

---

### `App.jsx` — the map

This is where you declare every URL and what it renders:

```jsx
<Routes>
  <Route path="/" element={<MainLayout />}>        // shell
    <Route index element={<ProjectsPage />} />      // → localhost:5173/
    <Route path="projects/:id" element={<ProjectDetail />} />  // → localhost:5173/projects/123
    <Route path="library" element={<LibraryPage />} />         // → localhost:5173/library
  </Route>
</Routes>
```

**There is no "homepage" file.** The homepage is whichever page component is assigned to `index` in `App.jsx`.

---

### `layouts/` — the persistent shell

`MainLayout.jsx` renders the sidebar + navbar **once**, and the `<Outlet />` is the hole where the current page gets injected:

```
┌─────────────────────────────────────┐
│  Sidebar  │   <Outlet />            │
│           │   (ProjectsPage,        │
│           │    ProjectDetail, etc.) │
└─────────────────────────────────────┘
```

The sidebar never re-renders. Only the `<Outlet />` changes when you navigate.

---

### `pages/` — one screen = one file

A page is just a component that assembles other components. It owns the data fetching for that screen:

```jsx
// pages/ProjectsPage.jsx
export default function ProjectsPage() {
    const [projects] = useFetch('/projects/');   // fetch here
    return <ProjectList projects={projects} />;   // pass down
}
```

---

### `components/` — reusable bricks

Components don't fetch data. They receive props and render UI:

```jsx
// components/projects/ProjectCard.jsx
export default function ProjectCard({ project }) {
    return <div>{project.name}</div>;   // just renders
}
```

---

## The incremental workflow

Every new feature follows the same 4 steps:

```
1. Add the route in App.jsx
2. Create the page in pages/
3. Build the components it needs in components/
4. Wire the API call in the page
```

### Example: "Projects grouped by type with tasks and papers"

**Step 1 — Route already exists**, or add one:
```jsx
// App.jsx
<Route path="projects/:id" element={<ProjectDetailPage />} />
```

**Step 2 — Create the page:**
```jsx
// pages/ProjectDetailPage.jsx
export default function ProjectDetailPage() {
    const { id } = useParams();
    const [project, setProject] = useState(null);

    useEffect(() => {
        apiClient.get(`/projects/${id}`).then(r => setProject(r.data));
    }, [id]);

    return (
        <>
            <TaskList tasks={project.tasks} />
            <PaperList papers={project.papers} />
        </>
    );
}
```

**Step 3 — Build the components:**
```
components/
  tasks/
    TaskList.jsx      ← renders a list
    TaskCard.jsx      ← renders one task
  papers/
    PaperList.jsx
    PaperCard.jsx
```

**Step 4 — Each component just receives props:**
```jsx
// components/tasks/TaskList.jsx
export default function TaskList({ tasks }) {
    return tasks.map(t => <TaskCard key={t.task_id} task={t} />);
}
```

---

## The golden rules

| Rule | Why |
|---|---|
| **Pages fetch, components render** | Components stay reusable |
| **One route = one page file** | Easy to find what renders where |
| **`App.jsx` is the source of truth for navigation** | You always know what URL maps to what |
| **Layout wraps everything** | Sidebar/navbar renders once, not per page |

---

So your next steps concretely would be:

1. `ProjectsPage` → shows `ProjectList` (grouped by status/type) ✅ you have this
2. `ProjectDetailPage` → shows tasks + papers for one project → **build next**
3. `LibraryPage` → shows all papers across projects → **after that**

Want me to scaffold `ProjectDetailPage` with `TaskList` and `PaperList` as the next step?