"use client";

import React, { useState } from "react";
import { AnticipoRule, DataPoint } from "@/lib/anticipoUtils";
import { SlidersHorizontal, ChevronDown, ChevronUp, Plus, Trash2, Percent, ListFilter, CornerDownRight } from "lucide-react";

interface AnticipoManagerPanelProps {
  dataPoints: DataPoint[];
  rules: { [key: string]: AnticipoRule };
  onUpdateRules: (newRules: { [key: string]: AnticipoRule }) => void;
}

export default function AnticipoManagerPanel({
  dataPoints,
  rules,
  onUpdateRules,
}: AnticipoManagerPanelProps) {
  // Plegado global por defecto para no generar ruido visual
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado para desplegar los procesos específicos de cada capítulo individual
  const [expandedChapters, setExpandedChapters] = useState<{ [key: string]: boolean }>({});

  const [customProcessName, setCustomProcessName] = useState("");
  const [customPct, setCustomPct] = useState(30);
  const [customDays, setCustomDays] = useState(60);

  // Obtener capítulos únicos
  const chaptersSet = new Set<string>();
  dataPoints.forEach((dp) => {
    if (dp.chapter && dp.chapter !== "Presupuesto Sin Asignar / Huérfano") {
      chaptersSet.add(dp.chapter);
    }
  });

  const chapters = Array.from(chaptersSet).sort();
  const activeCustomRulesCount = Object.keys(rules).length;

  const toggleExpandChapter = (ch: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChapters((prev) => ({
      ...prev,
      [ch]: !prev[ch],
    }));
  };

  const handleToggleRule = (key: string, currentRule?: AnticipoRule) => {
    const newRules = { ...rules };
    if (!currentRule || !currentRule.hasAnticipo) {
      newRules[key] = {
        chapterOrProcess: key,
        hasAnticipo: true,
        percentage: currentRule ? currentRule.percentage : 30,
        daysInAdvance: currentRule ? currentRule.daysInAdvance : 60,
      };
    } else {
      newRules[key] = {
        ...currentRule,
        hasAnticipo: false,
      };
    }
    onUpdateRules(newRules);
  };

  const handleUpdatePercentage = (key: string, pct: number) => {
    const current = rules[key] || {
      chapterOrProcess: key,
      hasAnticipo: true,
      percentage: 30,
      daysInAdvance: 60,
    };
    onUpdateRules({
      ...rules,
      [key]: { ...current, percentage: pct },
    });
  };

  const handleUpdateDays = (key: string, days: number) => {
    const current = rules[key] || {
      chapterOrProcess: key,
      hasAnticipo: true,
      percentage: 30,
      daysInAdvance: 60,
    };
    onUpdateRules({
      ...rules,
      [key]: { ...current, daysInAdvance: days },
    });
  };

  const handleAddCustomRule = () => {
    if (!customProcessName.trim()) return;
    const key = customProcessName.trim();
    onUpdateRules({
      ...rules,
      [key]: {
        chapterOrProcess: key,
        hasAnticipo: true,
        percentage: customPct,
        daysInAdvance: customDays,
      },
    });
    setCustomProcessName("");
  };

  const handleRemoveCustomRule = (key: string) => {
    const newRules = { ...rules };
    delete newRules[key];
    onUpdateRules(newRules);
  };

  return (
    <div
      className="rounded-xl border transition-all duration-300 backdrop-blur-xl shadow-sm overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Barra Principal Plegable (Compacta y Elegante) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-[var(--color-surface-hover)]/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-extrabold text-xs sm:text-sm text-[var(--color-text-primary)]">
                Ajustar Anticipos por Proceso / Capítulo
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                60 Días (2 Meses) • 30%
              </span>
              {activeCustomRulesCount > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                  {activeCustomRulesCount} Reglas Personalizadas
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] hidden sm:block mt-0.5">
              Despliega cualquier capítulo para personalizar procesos específicos o cambiar sus días de anticipo.
            </p>
          </div>
        </div>

        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] cursor-pointer"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span>{isOpen ? "Plegar" : "Personalizar"}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Contenido Desplegable Principal */}
      {isOpen && (
        <div className="p-5 border-t space-y-5 animate-fade-in bg-[var(--color-bg)]/30" style={{ borderColor: "var(--color-border)" }}>
          {/* Fila de Agregar Insumo / Proceso Personalizado */}
          <div className="p-3.5 rounded-xl border bg-[var(--color-surface)] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-xs" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex-1">
              <span className="block text-[10px] font-black uppercase text-[var(--color-text-secondary)] mb-1">
                Agregar Insumo o Proceso Específico:
              </span>
              <input
                type="text"
                placeholder="Ej. Tubería PVC 200mm, Pavimento Eje 5..."
                value={customProcessName}
                onChange={(e) => setCustomProcessName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>

            <div className="w-full sm:w-28">
              <span className="block text-[10px] font-black uppercase text-[var(--color-text-secondary)] mb-1">
                % Anticipo:
              </span>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={5}
                  max={95}
                  value={customPct}
                  onChange={(e) => setCustomPct(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-[var(--color-bg)] text-[var(--color-text-primary)] pr-6"
                  style={{ borderColor: "var(--color-border)" }}
                />
                <Percent className="w-3 h-3 absolute right-2 text-[var(--color-text-tertiary)] pointer-events-none" />
              </div>
            </div>

            <div className="w-full sm:w-36">
              <span className="block text-[10px] font-black uppercase text-[var(--color-text-secondary)] mb-1">
                Días Anticipados:
              </span>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-[var(--color-bg)] text-[var(--color-text-primary)] pr-8"
                  style={{ borderColor: "var(--color-border)" }}
                />
                <span className="absolute right-2 text-[9px] font-mono text-[var(--color-text-tertiary)] pointer-events-none">días</span>
              </div>
            </div>

            <button
              onClick={handleAddCustomRule}
              disabled={!customProcessName.trim()}
              className="mt-auto sm:mt-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold text-white transition-all cursor-pointer shadow-sm disabled:opacity-40"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          {/* Grilla de Capítulos con Sub-desplegable por Procesos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
            {chapters.map((ch) => {
              const chapterRule = rules[ch];
              const hasAnticipo = chapterRule ? chapterRule.hasAnticipo : true;
              const pct = chapterRule ? chapterRule.percentage : 30;
              const days = chapterRule ? chapterRule.daysInAdvance : 60;

              // Procesos / tareas pertenecientes a este capítulo DEDUPLICADOS por nombre único
              const tasksInChapter = dataPoints.filter((dp) => dp.chapter === ch);
              const uniqueTaskNames = Array.from(
                new Set(tasksInChapter.map((dp) => dp.task_name).filter(Boolean))
              );

              const isChapterExpanded = !!expandedChapters[ch];

              return (
                <div
                  key={`chapter-${ch}`}
                  className={`p-3.5 rounded-xl border transition-all duration-200 ${
                    hasAnticipo
                      ? "bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs"
                      : "bg-[var(--color-surface-hover)]/30 border-dashed border-[var(--color-border)] opacity-70"
                  }`}
                >
                  {/* Fila del Capítulo (Nivel 1) */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-2.5 h-2.5 rounded-full ${hasAnticipo ? "bg-[var(--color-primary)]" : "bg-[var(--color-text-tertiary)]"}`} />
                      <h4 className="text-xs font-black truncate text-[var(--color-text-primary)] uppercase tracking-wide">
                        {ch}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Botón para Desplegar los Procesos Específicos Únicos del Capítulo */}
                      {uniqueTaskNames.length > 0 && (
                        <button
                          onClick={(e) => toggleExpandChapter(ch, e)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white transition-all cursor-pointer"
                        >
                          <ListFilter className="w-3 h-3" />
                          <span>{uniqueTaskNames.length} Procesos</span>
                          {isChapterExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}

                      {/* Switch ¿Tiene Anticipo el Capítulo? */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasAnticipo}
                          onChange={() => handleToggleRule(ch, chapterRule)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/40 peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  </div>

                  {/* Configuración rápida del Capítulo */}
                  {hasAnticipo ? (
                    <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]/40">
                      <div className="flex-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--color-text-secondary)] font-bold">% Anticipo:</span>
                        <input
                          type="number"
                          min={5}
                          max={90}
                          value={pct}
                          onChange={(e) => handleUpdatePercentage(ch, Number(e.target.value))}
                          className="w-14 text-[11px] font-extrabold px-1.5 py-0.5 rounded border bg-[var(--color-bg)] text-[var(--color-primary)] text-center"
                          style={{ borderColor: "var(--color-border)" }}
                        />
                      </div>

                      <div className="flex-1">
                        <select
                          value={days}
                          onChange={(e) => handleUpdateDays(ch, Number(e.target.value))}
                          className="w-full text-[10px] font-bold px-1.5 py-0.5 rounded border bg-[var(--color-bg)] text-[var(--color-text-primary)] cursor-pointer"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          <option value={30}>30 Días (1 Mes)</option>
                          <option value={60}>60 Días (2 Meses - Default)</option>
                          <option value={90}>90 Días (3 Meses)</option>
                          <option value={120}>120 Días (4 Meses)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-[var(--color-border)]/30 text-[10px] font-semibold text-[var(--color-text-tertiary)] italic">
                      Sin anticipo (100% normal)
                    </div>
                  )}

                  {/* Sub-Desplegable de Procesos Únicos del Capítulo (Nivel 2) */}
                  {isChapterExpanded && uniqueTaskNames.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed space-y-2 animate-fade-in bg-[var(--color-bg)]/50 p-2.5 rounded-lg" style={{ borderColor: "var(--color-border)" }}>
                      <span className="block text-[9px] font-black uppercase text-[var(--color-primary)] mb-1 flex items-center gap-1">
                        <CornerDownRight className="w-3 h-3" />
                        Procesos Específicos Únicos en {ch}:
                      </span>

                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {uniqueTaskNames.map((taskKey, tIdx) => {
                          const taskRule = rules[taskKey];
                          const taskHasAnticipo = taskRule !== undefined ? taskRule.hasAnticipo : hasAnticipo;
                          const taskPct = taskRule !== undefined ? taskRule.percentage : pct;
                          const taskDays = taskRule !== undefined ? taskRule.daysInAdvance : days;

                          return (
                            <div
                              key={`task-${ch}-${taskKey}-${tIdx}`}
                              className="p-2 rounded border bg-[var(--color-surface)] flex items-center justify-between gap-2 text-[11px]"
                              style={{ borderColor: "var(--color-border)" }}
                            >
                              <span className="font-semibold text-[var(--color-text-primary)] truncate max-w-[55%]" title={taskKey}>
                                {taskKey}
                              </span>

                              <div className="flex items-center gap-2 shrink-0">
                                {taskHasAnticipo ? (
                                  <>
                                    <input
                                      type="number"
                                      min={5}
                                      max={90}
                                      value={taskPct}
                                      onChange={(e) => handleUpdatePercentage(taskKey, Number(e.target.value))}
                                      className="w-11 text-[10px] font-bold px-1 py-0.5 rounded border bg-[var(--color-bg)] text-[var(--color-primary)] text-center"
                                      style={{ borderColor: "var(--color-border)" }}
                                    />
                                    <span className="text-[10px] font-bold text-[var(--color-primary)]">%</span>

                                    <select
                                      value={taskDays}
                                      onChange={(e) => handleUpdateDays(taskKey, Number(e.target.value))}
                                      className="text-[9px] font-bold px-1 py-0.5 rounded border bg-[var(--color-bg)] text-[var(--color-text-primary)] cursor-pointer"
                                      style={{ borderColor: "var(--color-border)" }}
                                    >
                                      <option value={30}>30d</option>
                                      <option value={60}>60d</option>
                                      <option value={90}>90d</option>
                                    </select>
                                  </>
                                ) : (
                                  <span className="text-[9px] italic text-[var(--color-text-tertiary)]">Normal</span>
                                )}

                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={taskHasAnticipo}
                                    onChange={() => handleToggleRule(taskKey, taskRule || { chapterOrProcess: taskKey, hasAnticipo, percentage: pct, daysInAdvance: days })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-full peer peer-focus:ring-1 peer-focus:ring-[var(--color-primary)]/40 peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all after:shadow-xs peer-checked:after:translate-x-full"></div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reglas Personalizadas */}
          {Object.keys(rules).filter((k) => !chaptersSet.has(k) && !dataPoints.some((dp) => dp.task_name === k)).length > 0 && (
            <div className="pt-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">Personalizados:</span>
              {Object.keys(rules)
                .filter((k) => !chaptersSet.has(k) && !dataPoints.some((dp) => dp.task_name === k))
                .map((key, kIdx) => {
                  const r = rules[key];
                  return (
                    <span
                      key={`custom-rule-${key}-${kIdx}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs"
                    >
                      <span className="text-[var(--color-text-primary)]">{key}</span>
                      <span className="text-[var(--color-primary)]">{r.percentage}%</span>
                      <span className="text-[var(--color-text-tertiary)] font-mono">({r.daysInAdvance}d)</span>
                      <button
                        onClick={() => handleRemoveCustomRule(key)}
                        className="hover:text-red-500 transition-colors ml-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
