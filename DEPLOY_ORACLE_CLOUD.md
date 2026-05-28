# Guía de deploy en Oracle Cloud Free Tier

## Paso 1: Crear cuenta en Oracle Cloud

1. Andá a https://signup.cloud.oracle.com
2. Completá: país, nombre, email, teléfono
3. **Agregá una tarjeta de crédito/débito** (solo para verificar identidad, **no te cobran nada** mientras uses recursos Always Free)
4. Confirmá el teléfono con el código que te llega
5. Creá tu cuenta (tarda 1-2 minutos)

## Paso 2: Crear la VM (siempre gratis)

1. Iniciá sesión en https://cloud.oracle.com
2. Buscá "Compute" en el menú → "Instances" → "Create instance"
3. Configuración:
   - **Name**: `whatsapp-agent`
   - **Image**: Canonical Ubuntu 24.04 (o 22.04)
   - **Shape**: "VM.Standard.A1.Flex" ✨ (4 ARM cores, 24GB RAM — siempre gratis)
   - **Boot volume**: 200GB (el máximo gratis)
   - **SSH keys**: Elegí "Generate SSH key pair" y descargala
4. Click **"Create"**
5. Esperá a que aparezca **"Running"** (1-2 minutos)
6. Copiá la **IP pública** de la VM

## Paso 3: Conectarse a la VM

Desde tu PC (Windows):

```bash
# Descargá PuTTY desde https://www.putty.org
# O usá PowerShell si tenés OpenSSH:
ssh -i "C:\ruta\a\tu-key.ppk" ubuntu@IP_DE_TU_VM
```

En la VM ejecutá esto para instalar todo automáticamente:

```bash
# Descargar el setup
wget -O setup.sh https://raw.githubusercontent.com/TU_USUARIO/whatsapp-cliente/main/setup-vm.sh

# O copiá el contenido manualmente con nano
nano setup.sh  # pegá el contenido del archivo setup-vm.sh

# Ejecutá
bash setup.sh
```

## Paso 4: Subir el proyecto

**Opción A — GitHub (recomendada):**
```bash
# En tu PC:
git init
git add .
git commit -m "Primer commit"
# Creá un repo en https://github.com/new
git remote add origin https://github.com/TU_USUARIO/whatsapp-cliente.git
git push -u origin main

# En la VM:
git clone https://github.com/TU_USUARIO/whatsapp-cliente.git
cd whatsapp-cliente
```

**Opción B — Subir archivos directo:**
```bash
# En tu PC, comprimí la carpeta (excluyendo node_modules)
# En la VM:
nano .env  # pegá el contenido de tu .env
# Luego subí los archivos con SCP desde tu PC:
scp -i tu-key.ppk -r E:\whatsapp\ cliente\* ubuntu@IP:/home/ubuntu/whatsapp-cliente/
```

## Paso 5: Configurar .env y ejecutar

```bash
cd whatsapp-cliente
nano .env  # completá GOOGLE_KEEP_EMAIL y GOOGLE_KEEP_PASSWORD

# Construir y ejecutar con Docker:
sudo docker compose up -d --build
```

## Paso 6: Verificar

```bash
# Ver logs
sudo docker compose logs -f app

# Abrí en el navegador:
# http://IP_DE_TU_VM:3000
```

## Paso 7: Escanear QR

Cuando veas el QR en los logs, escanealo con WhatsApp:
```bash
sudo docker compose logs -f app
# Aparecerá el código QR, escanealo con WhatsApp
```

## Comandos útiles

```bash
# Ver logs
sudo docker compose logs -f

# Detener
sudo docker compose down

# Actualizar código
git pull
sudo docker compose up -d --build

# Reiniciar
sudo docker compose restart
```

## Firewall (abrir puerto 3000)

La primera vez, abrí el puerto en Oracle Cloud:
1. En Oracle Cloud, menú → "Networking" → "Virtual Cloud Networks"
2. Hacé click en tu VCN
3. "Security Lists" → "Default Security List"
4. "Add Ingress Rules":
   - Source: 0.0.0.0/0
   - Destination Port Range: 3000
   - Description: Dashboard web
5. Click "Add Ingress Rules"
