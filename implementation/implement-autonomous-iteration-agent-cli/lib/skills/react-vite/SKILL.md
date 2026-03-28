# React + Vite Skill

Domain-specific guidance for building React applications with Vite.

## Project Setup

- Create files manually instead of using `create-vite` (it prompts interactively)
- Minimum files: index.html, vite.config.js, src/main.jsx, src/App.jsx, package.json
- Use `"type": "module"` in package.json for ESM

## Patterns

- Use functional components with hooks, never class components
- Prefer `useState` and `useReducer` for local state
- Use `useEffect` cleanup functions to prevent memory leaks
- Keep components small — extract when a component exceeds ~100 lines

## Styling

- Prefer CSS Modules (*.module.css) or Tailwind CSS
- Avoid inline styles for anything beyond trivial one-offs

## Testing

- Use Vitest (not Jest) — it's Vite-native and faster
- Use `@testing-library/react` for component tests
- Run tests with `npx vitest --run` (not watch mode)
- Use Playwright for E2E tests: `npx playwright test` (headless)

## Build & Deploy

- `npm run build` produces `dist/` directory
- Preview with `npx serve dist` (background it with `&`)
- Never run `npm run dev` in automation — it blocks

## Common Gotchas

- Vite uses `import.meta.env` not `process.env` for environment variables
- Prefix env vars with `VITE_` for client-side access
- Hot module replacement only works in dev mode
- `@vitejs/plugin-react` is required in vite.config.js for JSX
