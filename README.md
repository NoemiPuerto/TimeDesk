# TimeDesk

App de escritorio de time tracking y productividad personal, con proyectos compartibles en equipos pequeños (2-4 personas). Ver [CLAUDE.md](CLAUDE.md) para la arquitectura completa.

## Stack

Tauri + React + TypeScript + Vite, Tailwind CSS, Supabase (Postgres + Auth + Realtime).

## Setup local

```bash
npm install
cp .env.example .env   # rellena con las credenciales de tu proyecto Supabase
npm run tauri dev
```

## Conectar tu proyecto de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (requiere cuenta propia).
2. En **Project Settings → API**, copia el `Project URL` y la `anon public key` a tu `.env`.
3. Aplica el esquema (`supabase/migrations/`) a tu proyecto:
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
4. (Opcional) Regenera los tipos TypeScript de la base de datos:
   ```bash
   npx supabase gen types typescript --linked > src/lib/database.types.ts
   ```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
