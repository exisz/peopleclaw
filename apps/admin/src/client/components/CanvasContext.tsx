/**
 * PLANET-1385: Canvas context for generative UI.
 * Allows the chat agent to push dynamic components to the right panel.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

interface CanvasState {
  /** Currently rendered generative component, or null for default page content */
  component: ReactNode | null;
  /** Title shown above the canvas when a generative component is active */
  title: string | null;
}

interface CanvasContextValue {
  canvas: CanvasState;
  setCanvas: (component: ReactNode, title?: string) => void;
  clearCanvas: () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [canvas, setCanvasState] = useState<CanvasState>({
    component: null,
    title: null,
  });

  const setCanvas = (component: ReactNode, title?: string) => {
    setCanvasState({ component, title: title || null });
  };

  const clearCanvas = () => {
    setCanvasState({ component: null, title: null });
  };

  return (
    <CanvasContext.Provider value={{ canvas, setCanvas, clearCanvas }}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error('useCanvas must be used within CanvasProvider');
  return ctx;
}
