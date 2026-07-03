# knowledge_organizer

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
```