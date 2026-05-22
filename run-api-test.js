/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

async function runTest() {
  console.log("Iniciando prueba E2E de la API de análisis...");
  
  const budgetPath = path.join(__dirname, "backend", "documents", "20260303 Presupuesto Bosque de Agua V5.xlsx");
  const schedulePath = path.join(__dirname, "backend", "documents", "1111.xlsx");
  
  console.log("Cargando archivos...");
  const budgetBuffer = fs.readFileSync(budgetPath);
  const scheduleBuffer = fs.readFileSync(schedulePath);
  
  console.log("Creando FormData...");
  const formData = new FormData();
  
  // En Node 20+, Blob y File son nativos
  const budgetBlob = new Blob([budgetBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const scheduleBlob = new Blob([scheduleBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  
  formData.append("budget", budgetBlob, "20260303 Presupuesto Bosque de Agua V5.xlsx");
  formData.append("schedule", scheduleBlob, "1111.xlsx");
  
  console.log("Enviando petición POST a http://localhost:3000/api/analysis/process...");
  const startTime = Date.now();
  
  try {
    const response = await fetch("http://localhost:3000/api/analysis/process", {
      method: "POST",
      body: formData,
    });
    
    console.log(`Respuesta recibida en ${((Date.now() - startTime) / 1000).toFixed(2)}s. Código de estado: ${response.status}`);
    
    const result = await response.json();
    if (!response.ok) {
      console.error("Error en la respuesta de la API:", result);
      return;
    }
    
    console.log("¡ÉXITO! Respuesta procesada correctamente.");
    console.log("\n--- RESUMEN EJECUTIVO DE LA IA ---");
    console.log(result.data.analysis);
    console.log("----------------------------------\n");
    
    console.log(`Total de puntos de datos mapeados: ${result.data.dataPoints.length}`);
    console.log(`Presupuesto total calculado: $${new Intl.NumberFormat("es-CO").format(Math.round(result.data.totalBudget))} COP`);
    
    // Validar que se hayan mapeado todos los ítems y no haya duplicados raros o truncamientos
    const mappedTaskNames = new Set(result.data.dataPoints.map(dp => dp.task_name.trim().toLowerCase()));
    console.log(`Puntos de datos únicos mapeados (por descripción): ${mappedTaskNames.size}`);
    
    // Guardar respuesta de prueba para auditoría
    fs.writeFileSync(
      path.join(__dirname, "backend", "scratch", "api_response_sample.json"),
      JSON.stringify(result, null, 2)
    );
    console.log("Muestra de respuesta guardada en backend/scratch/api_response_sample.json");
    
  } catch (error) {
    console.error("Error durante la ejecución del test:", error);
  }
}

runTest();
