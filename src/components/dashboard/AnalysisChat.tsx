"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, MessageSquare, X, ChevronRight, CornerDownLeft, Loader2, Cpu } from "lucide-react";

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
  const [selectedModel, setSelectedModel] = useState<"gemini-3.1-pro-preview" | "gemini-3.7-flash">("gemini-3.1-pro-preview");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Saludos. Soy tu Asistente Senior de Control de Costos e Inteligencia Financiera. ¿En qué puedo ayudarte a profundizar hoy sobre el flujo de caja del proyecto Bosque de Agua?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Formatear moneda a pesos (COP)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

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
        let errMessage = "Error al comunicarse con el servicio de Inteligencia Financiera.";
        if (typeof data.error === "string") {
          errMessage = data.error;
        } else if (data.error?.message) {
          errMessage = data.error.message;
        }
        throw new Error(errMessage);
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "";
      const userFacingErr = errMsg.includes("PERMISSION_DENIED") || errMsg.includes("dunning")
        ? "⚠️ **Aviso de Servicio**: El servicio de IA en la nube (Vertex AI) se encuentra temporalmente en mantenimiento de facturación/cuota. Se ha activado el **Modo Local Resiliente de Control Financiero** para responder con las métricas del proyecto."
        : "Lo siento, experimenté una interrupción de red al comunicarse con el servicio. Por favor reintenta en un momento.";

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: userFacingErr }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Lightweight markdown formatter for chat bubbles
  const renderMessageContent = (text: string, isUser = false) => {
    return text.split("\n").map((line, idx) => {
      let cleanLine = line.trim();
      if (!cleanLine) return <div key={idx} className="h-1.5" />;

      let isBullet = false;
      if (cleanLine.startsWith("- ") || cleanLine.startsWith("* ")) {
        isBullet = true;
        cleanLine = cleanLine.substring(2).trim();
      }

      // Bold text formatting **bold**
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const renderedLine = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong 
              key={i} 
              className={`font-black ${isUser ? "text-white underline decoration-2" : "text-[var(--color-primary)] bg-[var(--color-primary-light)]/40 px-1.5 rounded"}`}
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      // Chapter bullet list formatting
      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs sm:text-sm leading-relaxed mb-1 pl-1" style={{ color: isUser ? "#ffffff" : "var(--color-text-primary)" }}>
            {renderedLine}
          </li>
        );
      }

      // Headers formatting
      if (cleanLine.startsWith("### ")) {
        return <h5 key={idx} className={`text-xs sm:text-sm font-black mt-3 mb-1 ${isUser ? "text-white" : "text-[var(--color-accent)]"}`}>{renderedLine}</h5>;
      }
      if (cleanLine.startsWith("## ")) {
        return <h4 key={idx} className={`text-sm font-black mt-3.5 mb-1.5 ${isUser ? "text-white" : "text-[var(--color-primary)]"}`}>{renderedLine}</h4>;
      }

      return (
        <p key={idx} className="text-xs sm:text-sm leading-relaxed mb-1.5" style={{ color: isUser ? "#ffffff" : "var(--color-text-primary)" }}>
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
        style={{
          position: "fixed",
          bottom: "1.75rem",
          right: "1.75rem",
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.85rem 1.85rem",
          borderRadius: "9999px",
          fontSize: "0.875rem",
          fontWeight: 800,
          color: "#ffffff",
          background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 10px 25px -3px rgba(1, 92, 50, 0.4), 0 4px 6px -2px rgba(1, 92, 50, 0.2)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
        className="hover:scale-105 active:scale-95 transition-all duration-300 shrink-0 animate-fade-in"
      >
        <Sparkles className="w-5 h-5 text-white shrink-0 animate-pulse" />
        <span>Consultar Asistente IA</span>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border border-white animate-ping" />
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
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col transition-transform duration-300 shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          boxShadow: isOpen ? "-15px 0 50px -10px rgba(0,0,0,0.15)" : "none"
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center shadow-inner">
              <Sparkles className="w-4.5 h-4.5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-primary)]">Asistente de Costos Serving</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">Conectado con Gemini 3.1 Pro</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Model Selector Pills */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black tracking-wider text-[var(--color-text-tertiary)] uppercase flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[var(--color-primary)]" />
              NIVEL DE RAZONAMIENTO:
            </span>
            <span className="text-[9px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              {selectedModel === "gemini-3.1-pro-preview" ? "Máxima Precisión (Gemini 3.1 Pro)" : "Instantáneo SOTA (Gemini 3.7 Flash)"}
            </span>
          </div>
          <div 
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              padding: "5px",
              gap: "6px",
              borderRadius: "9999px",
              backgroundColor: "var(--color-surface-hover)",
              border: "1px solid var(--color-border)",
            }}
          >
            <button
              onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
              style={{
                borderRadius: "9999px",
                padding: "0.55rem 1rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "none",
                background: selectedModel === "gemini-3.1-pro-preview" 
                  ? "linear-gradient(135deg, #015c32 0%, #11a542 100%)" 
                  : "transparent",
                color: selectedModel === "gemini-3.1-pro-preview" ? "#ffffff" : "var(--color-text-secondary)",
                boxShadow: selectedModel === "gemini-3.1-pro-preview" ? "0 2px 8px rgba(17, 165, 66, 0.3)" : "none",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Razonamiento (3.1 Pro)</span>
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.7-flash")}
              style={{
                borderRadius: "9999px",
                padding: "0.55rem 1rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "none",
                background: selectedModel === "gemini-3.7-flash" 
                  ? "linear-gradient(135deg, #015c32 0%, #11a542 100%)" 
                  : "transparent",
                color: selectedModel === "gemini-3.7-flash" ? "#ffffff" : "var(--color-text-secondary)",
                boxShadow: selectedModel === "gemini-3.7-flash" ? "0 2px 8px rgba(17, 165, 66, 0.3)" : "none",
              }}
            >
              <span>Veloz SOTA (3.7 Flash)</span>
            </button>
          </div>
        </div>

        {/* Historial de Mensajes */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24 space-y-5 select-text">
          
          {/* Welcome Card & Project KPI highlights */}
          {messages.length === 1 && (
            <div className="bg-[var(--color-primary-light)]/20 border border-[var(--color-primary)]/10 rounded-2xl p-5 animate-fade-in space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <h4 className="text-[10px] font-black uppercase tracking-wider">Métricas Cargadas en Contexto</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-inner">
                  <span className="text-[9px] font-bold text-[var(--color-text-tertiary)] uppercase block mb-0.5">Costo Directo</span>
                  <span className="text-xs font-extrabold text-[var(--color-text-primary)]">{formatCurrency(directBudget)}</span>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-inner">
                  <span className="text-[9px] font-bold text-[var(--color-text-tertiary)] uppercase block mb-0.5">Presupuesto Total</span>
                  <span className="text-xs font-extrabold text-[var(--color-primary)]">{formatCurrency(totalBudget)}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                He procesado los **{dataPoints.length} registros** mapeados de la obra Bosque de Agua. Puedo ayudarte a analizar flujos mensuales, identificar desvíos o consultar cualquier capítulo.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto justify-end" : "mr-auto justify-start"}`}
              >
                {/* Render Avatar first for assistant */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--color-primary)]/20 bg-[var(--color-primary-light)] shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`flex flex-col rounded-2xl p-4 shadow-sm animate-fade-in min-w-0 ${
                    isUser
                      ? "border border-[var(--color-primary)] bg-[var(--color-primary)] text-white rounded-tr-none"
                      : "border border-[var(--color-border)] bg-[var(--color-surface)] rounded-tl-none"
                  }`}
                >
                  <span
                    className="text-[9px] font-black uppercase tracking-wider mb-1.5"
                    style={{
                      color: isUser ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)"
                    }}
                  >
                    {isUser ? "Tú (Gerencia)" : "Asistente IA"}
                  </span>
                  <div className={`space-y-1 ${isUser ? "text-white" : ""}`}>
                    {renderMessageContent(msg.content, isUser)}
                  </div>
                </div>

                {/* Render Avatar last for user */}
                {isUser && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">person</span>
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 mr-auto max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0 border shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />
              </div>
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl rounded-tl-none p-4 flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                <span className="text-xs font-bold text-[var(--color-text-secondary)]">Analizando base de datos semántica...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias de Preguntas (Preset Chips) */}
        {messages.length === 1 && !loading && (
          <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-3">
              Preguntas sugeridas de control:
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(preset)}
                  className="text-xs text-left px-4 py-3.5 rounded-xl border hover:bg-[var(--color-surface)] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-between group bg-[var(--color-bg)] shadow-sm hover:shadow hover:border-[var(--color-primary)]"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)"
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-sm shrink-0">help</span>
                    <span className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">{preset}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-[var(--color-primary)] translate-x-[-4px] group-hover:translate-x-0 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div
          className="p-5 border-t flex flex-col gap-2.5 bg-[var(--color-surface)]"
          style={{
            borderColor: "var(--color-border)",
            boxShadow: "0 -8px 25px rgba(0, 0, 0, 0.04)"
          }}
        >
          <div className="relative flex items-center bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-light)]/40 transition-all duration-300 shadow-sm p-1">
            <textarea
              placeholder="Pregunta sobre las tablas, capítulos o flujo de caja..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                }
              }}
              disabled={loading}
              rows={2}
              className="flex-1 w-full bg-transparent text-sm border-0 outline-none resize-none pl-5.5 pr-14 pt-4 pb-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] min-h-[50px] max-h-[140px]"
            />
            <button
              onClick={() => handleSendMessage(input)}
              disabled={!input.trim() || loading}
              className="absolute right-2.5 bottom-2.5 w-9.5 h-9.5 rounded-xl flex items-center justify-center text-white transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(1,92,50,0.2)] shrink-0"
              style={{
                backgroundColor: "var(--color-primary)",
                backgroundImage: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))"
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[var(--color-text-tertiary)] px-1">
            <span>Shift + Enter para salto de línea</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Garantía de control de costos Serving
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
