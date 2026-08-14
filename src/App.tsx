import { useState } from "react";

function App() {
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? "dark" : ""}>
      <main className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary-container flex items-center justify-center text-on-primary font-bold">
            TD
          </div>
          <h1 className="text-3xl font-bold tracking-tight">TimeDesk</h1>
        </div>
        <p className="text-on-surface-variant text-sm">
          Fase 0 — setup del proyecto. Tokens del sistema de diseño (Stitch) cargados.
        </p>
        <div className="flex gap-4">
          <button
            className="px-6 py-2 rounded-full bg-primary-container text-on-primary text-sm font-medium hover:bg-primary transition-colors"
            onClick={() => setDark((d) => !d)}
          >
            Cambiar a modo {dark ? "claro" : "oscuro"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          <div className="bg-surface-container rounded-md p-4 text-center text-xs text-on-surface-variant">
            surface-container
          </div>
          <div className="bg-surface-container-high rounded-md p-4 text-center text-xs text-on-surface-variant">
            surface-container-high
          </div>
          <div className="bg-surface-container-highest rounded-md p-4 text-center text-xs text-on-surface-variant">
            surface-container-highest
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
