FROM node:22-slim

RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  python-is-python3 \
  git \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

RUN pip3 install gkeepapi --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p sessions logs data

ENV TZ=America/Argentina/Buenos_Aires

EXPOSE 3000

CMD ["node", "src/index.js"]
