"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, MessageSquare, X, ChevronRight, CornerDownLeft, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DataPoint {
  date: string;
  budget_required: number;
  task_name: string;
  chapter?: string;
}

interface AnalysisChatProps {
  dataPoints: DataPoint[];
  analysis: string;
  directBudget: number;
  totalBudget: number;
}

// Preset helper questions for construction cost control
const PRESETS = [
  "¿Cuáles son los capítulos de mayor costo directo?",
  "¿Cuándo se concentran los mayores desembolsos?",
  "¿Cómo se distribuyen los costos indirectos?",
  "¿Hay retrasos o riesgos potenciales en el cronograma?"
];

export default function AnalysisChat({ dataPoints, analysis, directBudget, totalBudget }: AnalysisChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini-2.5-pro" | "gemini-2.5-flash">("gemini-2.5-pro");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Saludos. Soy tu Asistente Senior de Control de Costos e Inteligencia Financiera. ¿En qué puedo ayudarte a profundizar hoy sobre el flujo de caja del proyecto Bosque de Agua?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          dataPoints,
          analysis,
          directBudget,
          totalBudget,
          model: selectedModel
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al comunicarse con el chatbot");
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Lo siento, experimenté una interrupción de red al intentar conectarme con el servicio de análisis de Vertex AI. Por favor, reintenta en un momento." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Lightweight markdown formatter for chat bubbles
  const renderMessageContent = (text: string) => {
    return text.split("\n").map((line, idx) => {
      let cleanLine = line.trim();
      if (!cleanLine) return <div key={idx} className="h-1.5" />;

      // Bold text formatting **bold**
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const renderedLine = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-extrabold text-[var(--color-primary)]">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Chapter bullet list formatting
      if (cleanLine.startsWith("- ") || cleanLine.startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs sm:text-sm leading-relaxed mb-0.5" style={{ color: "var(--color-text-primary)" }}>
            {renderedLine}
          </li>
        );
      }

      // Headers formatting
      if (cleanLine.startsWith("### ")) {
        return <h5 key={idx} className="text-xs sm:text-sm font-black mt-2.5 mb-1 text-[var(--color-accent)]">{renderedLine}</h5>;
      }
      if (cleanLine.startsWith("## ")) {
        return <h4 key={idx} className="text-sm font-black mt-3 mb-1.5 text-[var(--color-primary)]">{renderedLine}</h4>;
      }

      return (
        <p key={idx} className="text-xs sm:text-sm leading-relaxed mb-1.5" style={{ color: "var(--color-text-primary)" }}>
          {renderedLine}
        </p>
      );
    });
  };

  return (
    <>
      {/* Botón flotante premium para abrir el chat */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-4 rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer select-none text-white border border-[var(--color-primary)] shrink-0 animate-fade-in hover:shadow-[0_0_20px_rgba(1,92,50,0.4)]"
        style={{
          backgroundColor: "var(--color-primary)",
          boxShadow: "0 10px 25px -5px rgba(1, 92, 50, 0.45)"
        }}
      >
        <Sparkles className="w-5 h-5 animate-pulse text-white" />
        Consultar Asistente IA
      </button>

      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Panel de chat deslizante lateral derecho */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col transition-transform duration-300 shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          boxShadow: isOpen ? "-10px 0 40px -10px rgba(0,0,0,0.5)" : "none"
        }}
      >
        {/* Header del Panel */}
        <div
          className="p-5 flex justify-between items-center border-b"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface-hover)"
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-primary)]">Asistente de Costos Serving</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Vertex AI Activo</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg border hover:bg-[var(--color-surface-hover)] active:scale-95 transition-all cursor-pointer"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)"
            }}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Selector de Nivel de Razonamiento IA */}
        <div 
          className="px-5 py-2.5 border-b flex items-center justify-between gap-4 text-xs font-bold bg-[var(--color-surface-hover)]/30"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">
            Razonamiento IA:
          </span>
          <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setSelectedModel("gemini-2.5-pro")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[10px] font-bold ${
                selectedModel === "gemini-2.5-pro"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Profundo (Pro)
            </button>
            <button
              onClick={() => setSelectedModel("gemini-2.5-flash")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[10px] font-bold ${
                selectedModel === "gemini-2.5-flash"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Veloz (Flash)
            </button>
          </div>
        </div>

        {/* Historial de Mensajes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[85%] rounded-2xl p-4 animate-fade-in ${
                msg.role === "user"
                  ? "ml-auto border border-[var(--color-primary)] bg-[var(--color-primary-light)]/20"
                  : "mr-auto border"
              }`}
              style={{
                borderColor: msg.role === "user" ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: msg.role === "user" ? undefined : "var(--color-surface-hover)/40"
              }}
            >
              <span
                className="text-[9px] font-black uppercase tracking-wider mb-1.5"
                style={{
                  color: msg.role === "user" ? "var(--color-primary)" : "var(--color-text-tertiary)"
                }}
              >
                {msg.role === "user" ? "Tú (Gerencia)" : "Asistente IA"}
              </span>
              <div className="space-y-1">
                {renderMessageContent(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mr-auto border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
              <span className="text-xs font-bold text-[var(--color-text-secondary)]">Analizando base de datos semántica...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias de Preguntas (Preset Chips) */}
        {messages.length === 1 && !loading && (
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-2">Preguntas sugeridas:</span>
            <div className="flex flex-col gap-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(preset)}
                  className="text-xs text-left px-3.5 py-2.5 rounded-lg border hover:bg-[var(--color-surface-hover)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between group"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)"
                  }}
                >
                  <span>{preset}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-primary)]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div
          className="p-4 border-t flex gap-2 items-center"
          style={{
            borderColor: "var(--color-border)"
          }}
        >
          <input
            type="text"
            placeholder="Pregunta sobre las tablas, capítulos o flujo de caja..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage(input);
            }}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg text-sm transition-colors border outline-none bg-[var(--color-bg)] disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)"
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
          />
          <button
            onClick={() => handleSendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-3 rounded-lg flex items-center justify-center text-white transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-primary)"
            }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}
