const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);

async function test() {
  const backendDir = 'C:\\Users\\ssanz\\OneDrive\\Documentos\\ChainPointAI\\SERVING\\SMA\\backend';
  const filePath = 'C:\\Users\\ssanz\\OneDrive\\Documentos\\ChainPointAI\\SERVING\\Copia de V1 SAO Costos por niveles_ 500019 Urbanismo Bosque de Agua APUS (1).xlsx';
  const content = fs.readFileSync(filePath);
  
  const tmpInput = path.join(os.tmpdir(), 'test_input.xlsx');
  fs.writeFileSync(tmpInput, content);
  
  const pyCode = `
import asyncio, json, base64, sys
sys.path.insert(0, r"${backendDir.replace(/\\/g, "/")}")
from app.services.costs_service import process_sao_costs

async def main():
    with open(r"${tmpInput.replace(/\\/g, "/")}", "rb") as f:
        data = f.read()
    res = await process_sao_costs(data, "test.xlsx")
    print(json.dumps({"success": True, "summary": res["summary"], "b64_len": len(res["excel_b64"])}))

asyncio.run(main())
`;

  const tmpScript = path.join(os.tmpdir(), 'run_test.py');
  fs.writeFileSync(tmpScript, pyCode);

  try {
    const { stdout } = await execFileAsync('python', [tmpScript], { cwd: backendDir });
    console.log('CLI PYTHON RESULT:', stdout);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
  }
}

test();
