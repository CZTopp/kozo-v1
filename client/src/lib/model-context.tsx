import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FinancialModel } from "@shared/schema";

interface ModelContextType {
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;
  models: FinancialModel[];
  selectedModel: FinancialModel | null;
  isLoading: boolean;
}

const ModelContext = createContext<ModelContextType>({
  selectedModelId: null,
  setSelectedModelId: () => {},
  models: [],
  selectedModel: null,
  isLoading: true,
});

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModelId, setSelectedModelIdState] = useState<string | null>(() => {
    return localStorage.getItem("foresight_selected_model") || null;
  });

  const { data: models = [], isLoading } = useQuery<FinancialModel[]>({
    queryKey: ["/api/models"],
  });

  useEffect(() => {
    if (!isLoading && models.length > 0) {
      const valid = models.find((m) => m.id === selectedModelId);
      if (!valid) {
        setSelectedModelIdState(models[0].id);
        localStorage.setItem("foresight_selected_model", models[0].id);
      }
    }
  }, [models, isLoading, selectedModelId]);

  const setSelectedModelId = (id: string | null) => {
    setSelectedModelIdState(id);
    if (id) {
      localStorage.setItem("foresight_selected_model", id);
    } else {
      localStorage.removeItem("foresight_selected_model");
    }
  };

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;

  return (
    <ModelContext.Provider
      value={{ selectedModelId, setSelectedModelId, models, selectedModel, isLoading }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  return useContext(ModelContext);
}
