# Guía de deploy en Railway

## Paso 1: Subir código a GitHub

1. Andá a https://github.com y creá una cuenta si no tenés
2. Click en el botón **"+"** (arriba a la derecha) → **"New repository"**
3. Nombre: `whatsapp-agent` — **"Public"** — click en **"Create repository"**

Desde tu PC en PowerShell:
```powershell
cd E:\whatsapp cliente
git init
git add .
git commit -m "Agente WhatsApp turnos"
git remote add origin https://github.com/TU-USUARIO/whatsapp-agent.git
git branch -M main
git push -u origin main
```

Te va a pedir usuario y contraseña de GitHub. Usá un **token** en vez de contraseña:
- Andá a https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Tildá `repo` — "Generate"
- Copiá el token y usalo como contraseña

## Paso 2: Crear cuenta en Railway

1. Andá a https://railway.com
2. Click en **"Sign in"** → **"Continue with GitHub"**
3. Autorizá Railway en GitHub

## Paso 3: Desplegar

1. En Railway, click en **"New Project"**
2. **"Deploy from GitHub repo"**
3. Seleccioná `whatsapp-agent`
4. Railway lo detecta automáticamente y empieza a construir

## Paso 4: Configurar variables

Cuando termine el build, andá a la pestaña **"Variables"** y agregá:

| Variable | Valor |
|----------|-------|
| `OPENAI_API_KEY` | `sk-or-v1-tu-api-key-de-openrouter` |
| `AI_MODEL` | `google/gemini-2.0-flash-001` |
| `API_BASE_URL` | `https://openrouter.ai/api/v1` |
| `BUSINESS_ROLE` | `asistente municipal de atención al público` |
| `BUSINESS_TYPE` | `municipalidad - gestión de turnos para HCD y CIC` |
| `GOOGLE_KEEP_EMAIL` | `tu-email@gmail.com` |
| `GOOGLE_KEEP_PASSWORD` | `tu-contraseña-app` |
| `PORT` | `3000` |

## Paso 5: Escanear QR

1. Andá a la pestaña **"Deployments"**
2. Click en el deployment activo
3. Andá a **"Logs"**
4. Ahí debería aparecer el código QR
5. Escanealo con WhatsApp (ajustes → dispositivos vinculados)

Si no ves el QR, puede que necesites ver los logs en tiempo real.

## Paso 6: Acceder al dashboard

1. En Railway, andá a **"Settings"** → **"Networking"**
2. En **"Public Networking"** click en **"Generate Domain"**
3. Te da una URL tipo `https://whatsapp-agent.up.railway.app`
4. Abrí esa URL — tenés el dashboard de turnos

## Comandos útiles

```bash
# Actualizar código
cd E:\whatsapp cliente
git add .
git commit -m "cambios"
git push

# Railway detecta el cambio y redepliega solo
```

## Nota sobre sesión

Railway reinicia el contenedor de vez en cuando. Baileys guarda la sesión en la carpeta `sessions/`. Railway tiene un disco persistente (volume) — si no lo configurás, perdés la sesión al reiniciar.

Para solucionarlo:
1. En Railway, **"Settings"** → **"Volumes"** → **"Add Volume"**
2. Name: `sessions`, Mount Path: `/app/sessions`
3. Hacé lo mismo para `data` y `logs`
