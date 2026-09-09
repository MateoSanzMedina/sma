# Guía de Configuración: WAF Perimetral y Protección Cloudflare
### Constructora Serving S.A.S. — Sistema SMA

Este documento detalla la arquitectura de seguridad perimetral y los pasos exactos para interconectar **Cloudflare (WAF, DDoS, SSL Strict y Rate Limiting)** delante de **Vercel** (Frontend) y **Render** (Backend FastAPI).

---

## 1. Diagrama de Arquitectura de Seguridad

```
[ Navegador / Cliente ]
         │
         ▼ (HTTPS / TLS 1.3)
┌─────────────────────────────────────────────────────────┐
│              CLOUDFLARE PERIMETER DEFENSE               │
│  ├─ WAF (Web Application Firewall - OWASP Core Rules)   │
│  ├─ L7 DDoS Mitigation & Bot Fight Mode                │
│  ├─ Edge Rate Limiting (/api/v1/auth/*)                 │
│  ├─ SSL/TLS Encryption: Full (Strict)                   │
│  └─ Zero Trust IP Geofencing & Challenge                │
└────────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Vercel Edge Server ]           [ Render Web Service ]
   (Frontend Next.js App)           (FastAPI Python Backend)
   - CSP & HSTS Headers             - SlowAPI Rate Limiting
   - Anti-Clickjacking              - JWT Session Validation
   - Client AuthGuard               - Bcrypt/Argon2 & 2FA TOTP
```

---

## 2. Paso 1: Configuración de DNS y Proxy (Nube Naranja)

1. Inicia sesión en [dash.cloudflare.com](https://dash.cloudflare.com).
2. Selecciona tu dominio corporativo (ej. `chainpoint.ai` o `serving.com.co`).
3. Ve a **DNS** > **Records**.
4. Configura los registros con el **Proxy Status** en **Proxied (Nube Naranja 🟧)**:
   - **Frontend (Vercel):**
     - Tipo: `CNAME`
     - Nombre: `sma`
     - Destino: `cname.vercel-dns.com`
     - Proxy: **Proxied (Naranja)**
   - **Backend API (Render):**
     - Tipo: `CNAME`
     - Nombre: `api-sma`
     - Destino: `sma-backend-m7ia.onrender.com`
     - Proxy: **Proxied (Naranja)**

> [!IMPORTANT]
> Al activar la nube naranja, la dirección IP real de tus servidores en Render y Vercel queda completamente oculta frente a atacantes. Todo el tráfico pasa primero por los filtros de Cloudflare.

---

## 3. Paso 2: Configuración de Cifrado SSL/TLS (Full Strict)

1. En el panel de Cloudflare, ve a **SSL/TLS** > **Overview**.
2. Selecciona la opción **Full (strict)**. Esto garantiza que la conexión entre Cloudflare y Render/Vercel esté cifrada y requiera certificados válidos.
3. Ve a **SSL/TLS** > **Edge Certificates**:
   - **Always Use HTTPS:** `Activado (ON)`
   - **Minimum TLS Version:** `TLS 1.2` (o preferiblemente `TLS 1.3`)
   - **Opportunistic Encryption:** `Activado (ON)`
   - **HTTP Strict Transport Security (HSTS):**
     - Enable HSTS: `Activado`
     - Max-Age: `6 months` o `1 year`
     - Include Subdomains: `Activado`
     - Preload: `Activado`

---

## 4. Paso 3: Reglas de WAF (Web Application Firewall)

1. Ve a **Security** > **WAF** > **Managed rules**.
2. Asegúrate de tener activado:
   - **Cloudflare Managed Ruleset:** Proporciona mitigación inmediata contra vulnerabilidades Zero-Day, inyecciones SQL y ataques RCE.
   - **Cloudflare OWASP Core Ruleset:**
     - Sensibilidad: `High` o `Medium`
     - Acción: `Block` o `Managed Challenge`
3. Ve a **Security** > **Bots**:
   - Activa **Bot Fight Mode**: Bloquea de forma automática herramientas de escaneo malicioso (sqlmap, gobuster, scanners de vulnerabilidades automatizados).

---

## 5. Paso 4: Reglas de Rate Limiting Perimetral en Cloudflare

Para evitar ataques de fuerza bruta distribuidos contra el login antes de que siquiera toquen el servidor de FastAPI:

1. Ve a **Security** > **WAF** > **Rate limiting rules**.
2. Pulsa en **Create rule**.
3. Configura:
   - **Rule name:** `Proteger Autenticación SMA`
   - **Field:** `URI Path`
   - **Operator:** `starts with`
   - **Value:** `/api/v1/auth/`
   - **When rate exceeds:** `10 requests per 1 minute`
   - **Characteristics:** `IP`
   - **Action:** `Block` o `Managed Challenge` por `15 minutes`.
4. Guarda e implementa la regla.

---

## 6. Paso 5: Protección de Origen en Render (Restricción de Tráfico)

Para evitar que un atacante salte Cloudflare atacando directamente el subdominio `*.onrender.com`:

1. En **Render Dashboard** > Selecciona el servicio `sma-backend` > **Settings**.
2. Puedes agregar un encabezado secreto de validación:
   - En Cloudflare: **Rules** > **Transform Rules** > **Modify Request Header** > Añade:
     - Header Name: `X-SMA-Proxy-Secret`
     - Value: `(cadena secreta de 64 caracteres)`
   - En FastAPI, el middleware puede rechazar cualquier solicitud pública que no provenga con dicho encabezado o que no provenga de los rangos de IPs oficiales de Cloudflare.

---

## 7. Verificación de Funcionamiento

Ejecuta desde una terminal externa:

```bash
# 1. Verificar que el certificado y cabeceras de Cloudflare están activos
curl -I https://sma.chainpoint.ai

# Debe incluir en las cabeceras:
# cf-ray: ...
# server: cloudflare
# strict-transport-security: max-age=...
# content-security-policy: ...
```
