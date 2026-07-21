const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

async function testExcelExport() {
  console.log("Probando generación de Excel con Flujo Semanal...");
  
  // Cargar datos de muestra guardados
  const samplePath = path.join(__dirname, "api_response_sample.json");
  if (!fs.existsSync(samplePath)) {
    console.log("No existe api_response_sample.json. Saltando test.");
    return;
  }
  
  const sample = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
  const data = sample.data;
  
  // Importar dinámicamente o simular la lógica de export
  const { dataPoints, distributedDataPoints, analysis, directBudget, totalBudget } = data;
  
  console.log(`Puntos de datos: ${dataPoints.length}, Puntos distribuidos: ${distributedDataPoints ? distributedDataPoints.length : 0}`);

  // Simular la llamada HTTP al endpoint local si el servidor dev está corriendo o probar con node
  console.log("Probando estructura de libro Excel...");
}

testExcelExport();
