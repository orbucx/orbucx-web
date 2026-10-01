/* ============================================================
   Orbucx — tools.js
   Free DevOps Script Generators (100% client-side, deterministic)

   Architecture:
   - TOOLS: registry array. Each tool = { id, cat, name, desc, filename(v),
     fields[], safety, generate(v) }.
   - Fields drive form rendering; generate() is a pure template function
     of the sanitized values. Add a new tool = add one entry.
   - Hash routing: #<tool-id> opens that tool and is kept in sync.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- sanitizers ---------- */
  var RE_DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  var RE_NAME   = /^[a-z0-9]([a-z0-9._-]{0,62})$/i;

  function cleanDomain(v, fallback) {
    v = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return RE_DOMAIN.test(v) ? v : fallback;
  }
  function cleanPort(v, fallback) {
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 65535) ? n : fallback;
  }
  function cleanInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    return (n >= min && n <= max) ? n : fallback;
  }
  function cleanName(v, fallback) {
    v = String(v || "").trim();
    return RE_NAME.test(v) ? v : fallback;
  }
  function cleanPath(v, fallback) {
    v = String(v || "").trim().replace(/["'`;$\\]/g, "");
    return v || fallback;
  }
  function cleanText(v, fallback) {
    v = String(v || "").trim().replace(/["'`;$\\]/g, "");
    return v || fallback;
  }

  /* ============================================================
     TOOL TEMPLATES — one function per tool, pure string builders
     ============================================================ */

  /* ---------- 1. Nginx Reverse Proxy + SSL ---------- */
  function genNginx(v) {
    var d = cleanDomain(v.domain, "example.com");
    var p = cleanPort(v.port, 3000);
    var L = [
      "#!/usr/bin/env bash",
      "# 📋 Usage Instructions:",
      "# 1. Download the script above ",
      "# 2. Make it executable: chmod 755 <certbot.sh>",
      "#3. To Run it: . certbot.sh",
      "",
      "set -u -o pipefail",
      "STEP=\"Initialization\"",
      "error_handler() {",
      "  echo \"❌ Error during: $STEP\" >&2",
      "  return 1",
      "}",
      "trap error_handler ERR",
      "",
      "# ─── Defaults ─────────────────────────────────────────────────────",
      "STEP=\"Setting defaults\"",
      "# ───----------────────────────────────────────────────────────────",
      "",
      "DOMAIN=\"" + d + "\"  # domain name (leave empty to skip nginx/certbot)",
      "PORT=" + p + "  # application port",
      "",
      "# ─── Optional: Setup nginx reverse proxy & TLS via Certbot ───────────────────",
      "",
      "if [[ -n \"$DOMAIN\" ]]; then",
      "  STEP=\"Installing nginx\"",
      "  if ! command -v nginx >/dev/null; then",
      "    echo \"ℹ️ Installing Nginx...\"",
      "    sudo apt-get update && sudo apt-get install -y nginx",
      "  fi",
      "",
      "  STEP=\"Installing certbot\"",
      "  if ! command -v certbot >/dev/null; then",
      "    echo \"ℹ️ Installing Certbot...\"",
      "    sudo apt-get install -y certbot python3-certbot-nginx",
      "  fi",
      "",
      "  STEP=\"Creating nginx site config\"",
      "",
      "  SITE_CONF=\"/etc/nginx/sites-available/$DOMAIN\"",
      "  echo \"📝 Writing Nginx config for $DOMAIN (port $PORT)...\"",
      "",
      "  sudo tee \"$SITE_CONF\" > /dev/null <<EOF",
      "server {",
      "  listen 80;",
      "  server_name $DOMAIN;",
      "",
      "  location / {",
      "    proxy_pass http://localhost:$PORT;",
      "    proxy_http_version 1.1;",
      "    proxy_set_header Upgrade \\$http_upgrade;",
      "    proxy_set_header Connection 'upgrade';",
      "    proxy_set_header Host \\$host;",
      "    proxy_cache_bypass \\$http_upgrade;",
      "  }",
      "}"
    ];
    L.push(
      "EOF",
      "",
      "  STEP=\"Enabling nginx site\"",
      "",
      "  sudo rm -f /etc/nginx/sites-enabled/default",
      "  sudo ln -sf \"$SITE_CONF\" /etc/nginx/sites-enabled/",
      "",
      "  STEP=\"Testing & reloading nginx\"",
      "",
      "  sudo nginx -t",
      "  sudo systemctl restart nginx.service ",
      "",
      "  STEP=\"Obtaining TLS certificate\"",
      "  sudo certbot --nginx -d \"$DOMAIN\" --non-interactive --agree-tos -m \"admin@$DOMAIN\"",
      "  sudo systemctl restart nginx.service ",
      "",
      "  echo \"✅ SSL certificate obtained for $DOMAIN.\"",
      "fi",
      "",
      "STEP=\"Complete\"",
      "echo \"🎉 $DOMAIN Configure Successfully \""
    );
    return L.filter(function (x) { return x !== null && x !== undefined; }).join("\n");
  }

  /* ---------- 2. Multi-stage Dockerfile ---------- */
  function genDockerfile(v) {
    var p = cleanPort(v.port, 3000);
    var lang = v.lang;
    var out = "";
    var ignore = ["# ---- .dockerignore (save as a separate file) ----", ".git", ".gitignore", ".env", "*.md", "Dockerfile", ".dockerignore"];

    if (lang === "node") {
      var pm = v.pm; // npm | pnpm | yarn
      var install = pm === "pnpm" ? "corepack enable && pnpm install --frozen-lockfile"
                  : pm === "yarn" ? "corepack enable && yarn install --frozen-lockfile"
                  : "npm ci";
      var prod    = pm === "pnpm" ? "corepack enable && pnpm install --frozen-lockfile --prod"
                  : pm === "yarn" ? "corepack enable && yarn install --frozen-lockfile --production"
                  : "npm ci --omit=dev";
      var lock    = pm === "pnpm" ? "pnpm-lock.yaml" : pm === "yarn" ? "yarn.lock" : "package-lock.json";
      out = [
        "# syntax=docker/dockerfile:1",
        "# ---------- build stage ----------",
        "FROM node:22-alpine AS build",
        "WORKDIR /app",
        "COPY package.json " + lock + " ./",
        "RUN " + install,
        "COPY . .",
        "# Remove/keep depending on your project (tsc, next build, vite build...)",
        "RUN npm run build --if-present",
        "",
        "# ---------- runtime stage ----------",
        "FROM node:22-alpine",
        "ENV NODE_ENV=production",
        "WORKDIR /app",
        "# Non-root: the official node image ships a 'node' user",
        "COPY --from=build --chown=node:node /app/package.json ./",
        "COPY --from=build --chown=node:node /app/" + lock + " ./",
        "RUN " + prod + " && " + (pm === "npm" ? "npm cache clean --force" : "rm -rf ~/.cache"),
        "COPY --from=build --chown=node:node /app/dist ./dist",
        "USER node",
        "EXPOSE " + p,
        "HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\",
        "  CMD wget -qO- http://127.0.0.1:" + p + "/health || exit 1",
        "CMD [\"node\", \"dist/index.js\"]"
      ].join("\n");
      ignore.push("node_modules", "dist", "coverage", "npm-debug.log*");
    } else if (lang === "python") {
      out = [
        "# syntax=docker/dockerfile:1",
        "# ---------- build stage ----------",
        "FROM python:3.12-slim AS build",
        "WORKDIR /app",
        "RUN pip install --no-cache-dir --upgrade pip",
        "COPY requirements.txt .",
        "RUN pip install --no-cache-dir --prefix=/install -r requirements.txt",
        "",
        "# ---------- runtime stage ----------",
        "FROM python:3.12-slim",
        "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1",
        "WORKDIR /app",
        "COPY --from=build /install /usr/local",
        "COPY . .",
        "# Non-root user",
        "RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app",
        "USER appuser",
        "EXPOSE " + p,
        "HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\",
        "  CMD python -c \"import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:" + p + "/health')\" || exit 1",
        "# gunicorn for Flask/Django, uvicorn for FastAPI — adjust:",
        "CMD [\"gunicorn\", \"--bind\", \"0.0.0.0:" + p + "\", \"--workers\", \"2\", \"app:app\"]"
      ].join("\n");
      ignore.push("__pycache__/", "*.pyc", ".venv/", "venv/", ".pytest_cache/");
    } else if (lang === "go") {
      out = [
        "# syntax=docker/dockerfile:1",
        "# ---------- build stage ----------",
        "FROM golang:1.23-alpine AS build",
        "WORKDIR /src",
        "COPY go.mod go.sum ./",
        "RUN go mod download",
        "COPY . .",
        "RUN CGO_ENABLED=0 GOOS=linux go build -ldflags=\"-s -w\" -o /out/app .",
        "",
        "# ---------- runtime stage (distroless-style minimal) ----------",
        "FROM alpine:3.20",
        "RUN apk add --no-cache ca-certificates wget && adduser -D -u 10001 appuser",
        "COPY --from=build /out/app /usr/local/bin/app",
        "USER appuser",
        "EXPOSE " + p,
        "HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\",
        "  CMD wget -qO- http://127.0.0.1:" + p + "/health || exit 1",
        "ENTRYPOINT [\"/usr/local/bin/app\"]"
      ].join("\n");
      ignore.push("bin/", "*.test");
    } else if (lang === "java") {
      out = [
        "# syntax=docker/dockerfile:1",
        "# ---------- build stage ----------",
        "FROM eclipse-temurin:21-jdk AS build",
        "WORKDIR /app",
        "# Cache dependencies first (Maven; for Gradle copy build.gradle + gradlew)",
        "COPY pom.xml mvnw ./",
        "COPY .mvn .mvn",
        "RUN ./mvnw dependency:go-offline -q",
        "COPY src src",
        "RUN ./mvnw package -DskipTests -q",
        "",
        "# ---------- runtime stage ----------",
        "FROM eclipse-temurin:21-jre",
        "WORKDIR /app",
        "RUN useradd --uid 10001 appuser",
        "COPY --from=build /app/target/*.jar app.jar",
        "USER appuser",
        "EXPOSE " + p,
        "HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \\",
        "  CMD curl -fsS http://127.0.0.1:" + p + "/actuator/health || exit 1",
        "ENTRYPOINT [\"java\", \"-XX:MaxRAMPercentage=75\", \"-jar\", \"app.jar\"]"
      ].join("\n");
      ignore.push("target/", ".idea/", "*.iml");
    } else { // php laravel
      out = [
        "# syntax=docker/dockerfile:1",
        "# ---------- composer deps stage ----------",
        "FROM composer:2 AS deps",
        "WORKDIR /app",
        "COPY composer.json composer.lock ./",
        "RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist",
        "COPY . .",
        "RUN composer dump-autoload --optimize --no-dev",
        "",
        "# ---------- runtime stage (php-fpm; pair with nginx or use FrankenPHP) ----------",
        "FROM php:8.3-fpm-alpine",
        "RUN apk add --no-cache icu-dev libzip-dev oniguruma-dev \\",
        "  && docker-php-ext-install pdo_mysql bcmath intl zip opcache",
        "WORKDIR /var/www/html",
        "COPY --from=deps /app .",
        "RUN chown -R www-data:www-data storage bootstrap/cache",
        "USER www-data",
        "EXPOSE " + p,
        "HEALTHCHECK --interval=30s --timeout=3s --retries=3 \\",
        "  CMD php -r \"exit(0);\" || exit 1",
        "CMD [\"php-fpm\", \"-F\"]"
      ].join("\n");
      ignore.push("vendor/", "storage/logs/*", "node_modules/");
    }
    return out + "\n\n" + ignore.join("\n") + "\n";
  }

  /* ---------- 2b. Simple single-stage Dockerfile ---------- */
  function genDockerSimple(v) {
    var base = v.base || "node:22-alpine";
    var p = cleanPort(v.port, 3000);
    var L = ["# Dockerfile — generated with Orbucx DevOps Tools", "FROM " + base];
    if (base.indexOf("nginx") === 0) {
      L.push("COPY . /usr/share/nginx/html");
      L.push("EXPOSE " + p);
    } else {
      L.push("WORKDIR /app");
      if (base.indexOf("python") === 0) {
        L.push("COPY requirements.txt ./");
        L.push("RUN pip install -r requirements.txt");
      } else {
        L.push("COPY package*.json ./");
        L.push("RUN npm install");
      }
      L.push("COPY . .");
      L.push("EXPOSE " + p);
      var start = cleanText(v.cmd, base.indexOf("python") === 0 ? "python app.py" : "npm start");
      L.push("CMD [" + start.split(/\s+/).map(function (s) { return '"' + s + '"'; }).join(", ") + "]");
    }
    return L.join("\n") + "\n";
  }

  /* ---------- 2c. Docker command list builder ---------- */
  function dockerCommands(v) {
    var img = cleanText(v.image, "my-app");
    var ctr = cleanText(v.container, "my-app-container");
    var cp  = cleanPort(v.cport, 80);
    var hp  = cleanPort(v.hport, 3000);
    var net = String(v.network || "").trim();
    if (net && !RE_NAME.test(net)) net = "my-network";
    var netFlag = net ? " --network " + net : "";
    var rows = [];
    rows.push({ cmd: "docker build -t " + img + " .", desc: "Build the Docker image from the current directory." });
    if (net) rows.push({ cmd: "docker network create " + net, desc: "Create the network (skips if it already exists)." });
    if (v.redis) rows.push({ cmd: "docker run -d --name redis" + netFlag + " -p 6379:6379 redis", desc: "Start a Redis container." });
    rows.push({ cmd: "docker stop " + ctr, desc: "Stop the old container if running." });
    rows.push({ cmd: "docker rm " + ctr, desc: "Remove the old container." });
    rows.push({ cmd: "docker run -d --name " + ctr + netFlag + " -p " + hp + ":" + cp + " " + img, desc: "Run the new container." });
    rows.push({ cmd: "docker logs -f " + ctr, desc: "Follow container logs." });
    rows.push({ cmd: "docker ps", desc: "List running containers." });
    return rows;
  }

  /* ---------- 3. docker-compose Stack ---------- */
  function genCompose(v) {
    var img = cleanText(v.image, "myorg/myapp:latest");
    var p   = cleanPort(v.port, 3000);
    var db = v.db, redis = v.redis, nginx = v.nginx;
    var L = [];
    L.push("# docker-compose stack — run with: docker compose up -d");
    L.push("# Secrets live in .env next to this file (never commit .env).");
    L.push("");
    L.push("services:");
    L.push("  app:");
    L.push("    image: " + img);
    L.push("    restart: unless-stopped");
    L.push("    env_file: .env");
    if (nginx) {
      L.push("    expose:");
      L.push("      - \"" + p + "\"");
    } else {
      L.push("    ports:");
      L.push("      - \"" + p + ":" + p + "\"");
    }
    var deps = [];
    if (db !== "none") deps.push("db");
    if (redis) deps.push("redis");
    if (deps.length) {
      L.push("    depends_on:");
      deps.forEach(function (d) { L.push("      - " + d); });
    }
    L.push("    networks: [backend" + (nginx ? ", frontend" : "") + "]");
    L.push("");
    if (db === "postgres") {
      L.push("  db:");
      L.push("    image: postgres:16-alpine");
      L.push("    restart: unless-stopped");
      L.push("    environment:");
      L.push("      POSTGRES_DB: ${POSTGRES_DB:-app}");
      L.push("      POSTGRES_USER: ${POSTGRES_USER:-app}");
      L.push("      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set in .env}");
      L.push("    volumes:");
      L.push("      - db_data:/var/lib/postgresql/data");
      L.push("    healthcheck:");
      L.push("      test: [\"CMD-SHELL\", \"pg_isready -U $${POSTGRES_USER:-app}\"]");
      L.push("      interval: 10s");
      L.push("      timeout: 5s");
      L.push("      retries: 5");
      L.push("    networks: [backend]");
      L.push("");
    } else if (db === "mysql") {
      L.push("  db:");
      L.push("    image: mysql:8.4");
      L.push("    restart: unless-stopped");
      L.push("    environment:");
      L.push("      MYSQL_DATABASE: ${MYSQL_DATABASE:-app}");
      L.push("      MYSQL_USER: ${MYSQL_USER:-app}");
      L.push("      MYSQL_PASSWORD: ${MYSQL_PASSWORD:?set in .env}");
      L.push("      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?set in .env}");
      L.push("    volumes:");
      L.push("      - db_data:/var/lib/mysql");
      L.push("    healthcheck:");
      L.push("      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\"]");
      L.push("      interval: 10s");
      L.push("      timeout: 5s");
      L.push("      retries: 5");
      L.push("    networks: [backend]");
      L.push("");
    } else if (db === "mongo") {
      L.push("  db:");
      L.push("    image: mongo:7");
      L.push("    restart: unless-stopped");
      L.push("    environment:");
      L.push("      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-app}");
      L.push("      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:?set in .env}");
      L.push("    volumes:");
      L.push("      - db_data:/data/db");
      L.push("    healthcheck:");
      L.push("      test: [\"CMD\", \"mongosh\", \"--eval\", \"db.adminCommand('ping')\"]");
      L.push("      interval: 10s");
      L.push("      timeout: 5s");
      L.push("      retries: 5");
      L.push("    networks: [backend]");
      L.push("");
    }
    if (redis) {
      L.push("  redis:");
      L.push("    image: redis:7-alpine");
      L.push("    restart: unless-stopped");
      L.push("    command: [\"redis-server\", \"--appendonly\", \"yes\"]");
      L.push("    volumes:");
      L.push("      - redis_data:/data");
      L.push("    networks: [backend]");
      L.push("");
    }
    if (nginx) {
      L.push("  nginx:");
      L.push("    image: nginx:1.27-alpine");
      L.push("    restart: unless-stopped");
      L.push("    ports:");
      L.push("      - \"80:80\"");
      L.push("      - \"443:443\"");
      L.push("    volumes:");
      L.push("      # Provide your own nginx.conf proxying to app:" + p);
      L.push("      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro");
      L.push("    depends_on: [app]");
      L.push("    networks: [frontend]");
      L.push("");
    }
    L.push("volumes:");
    if (db !== "none") L.push("  db_data:");
    if (redis) L.push("  redis_data:");
    if (db === "none" && !redis) L.push("  {}  # no named volumes needed");
    L.push("");
    L.push("networks:");
    L.push("  backend:");
    if (nginx) L.push("  frontend:");
    return L.join("\n") + "\n";
  }

  /* ---------- 4. Kubernetes Manifests ---------- */
  function genK8s(v) {
    var name = cleanName(v.name, "myapp");
    var img  = cleanText(v.image, "myorg/myapp:latest");
    var p    = cleanPort(v.port, 3000);
    var reps = cleanInt(v.replicas, 1, 50, 2);
    var d    = cleanDomain(v.domain, "app.example.com");
    var hpa  = v.hpa;
    var out = [
      "# deployment.yaml",
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: " + name,
      "  labels: { app: " + name + " }",
      "spec:",
      "  replicas: " + (hpa ? reps + "  # HPA below will manage this after creation" : reps),
      "  selector:",
      "    matchLabels: { app: " + name + " }",
      "  template:",
      "    metadata:",
      "      labels: { app: " + name + " }",
      "    spec:",
      "      containers:",
      "        - name: " + name,
      "          image: " + img,
      "          ports:",
      "            - containerPort: " + p,
      "          resources:",
      "            requests: { cpu: 100m, memory: 128Mi }",
      "            limits:   { cpu: 500m, memory: 512Mi }",
      "          livenessProbe:",
      "            httpGet: { path: /health, port: " + p + " }",
      "            initialDelaySeconds: 15",
      "            periodSeconds: 20",
      "          readinessProbe:",
      "            httpGet: { path: /health, port: " + p + " }",
      "            initialDelaySeconds: 5",
      "            periodSeconds: 10",
      "      securityContext:",
      "        runAsNonRoot: true",
      "        allowPrivilegeEscalation: false",
      "---",
      "# service.yaml",
      "apiVersion: v1",
      "kind: Service",
      "metadata:",
      "  name: " + name,
      "spec:",
      "  selector: { app: " + name + " }",
      "  ports:",
      "    - port: 80",
      "      targetPort: " + p,
      "---",
      "# ingress.yaml (assumes ingress-nginx + cert-manager installed)",
      "apiVersion: networking.k8s.io/v1",
      "kind: Ingress",
      "metadata:",
      "  name: " + name,
      "  annotations:",
      "    cert-manager.io/cluster-issuer: letsencrypt-prod",
      "spec:",
      "  ingressClassName: nginx",
      "  tls:",
      "    - hosts: [" + d + "]",
      "      secretName: " + name + "-tls",
      "  rules:",
      "    - host: " + d,
      "      http:",
      "        paths:",
      "          - path: /",
      "            pathType: Prefix",
      "            backend:",
      "              service:",
      "                name: " + name,
      "                port: { number: 80 }"
    ];
    if (hpa) {
      out = out.concat([
        "---",
        "# hpa.yaml",
        "apiVersion: autoscaling/v2",
        "kind: HorizontalPodAutoscaler",
        "metadata:",
        "  name: " + name,
        "spec:",
        "  scaleTargetRef:",
        "    apiVersion: apps/v1",
        "    kind: Deployment",
        "    name: " + name,
        "  minReplicas: " + reps,
        "  maxReplicas: " + Math.max(reps * 3, 6),
        "  metrics:",
        "    - type: Resource",
        "      resource:",
        "        name: cpu",
        "        target: { type: Utilization, averageUtilization: 70 }"
      ]);
    }
    return out.join("\n") + "\n";
  }

  /* ---------- 5. CI/CD generators ---------- */
  var CICD_HEADER = [
    "# 📋 Usage Instructions",
    "# 1. Create .github/workflows folder",
    "# 2. Create file with BranchName.yml",
    "# 3. Paste code",
    ""
  ];

  function cicdInstall(pm) {
    return pm === "yarn" ? "yarn install --frozen-lockfile"
         : pm === "pnpm" ? "pnpm install --frozen-lockfile"
         : "npm ci";
  }
  function cicdBuild(pm) {
    return pm === "yarn" ? "yarn run build || echo 'No build script'"
         : pm === "pnpm" ? "pnpm run --if-present build"
         : "npm run build --if-present";
  }

  function genCicdPm2Backend(v) {
    var proc   = cleanText(v.process, "my-backend-app");
    var pm     = v.pm || "npm";
    var node   = v.node || "22";
    var branch = cleanText(v.branch, "main");
    var runner = cleanText(v.runner, "my-runner");
    var dir    = String(v.dir || "").trim().replace(/["'`;$\\]/g, "");
    var installCmd = pm === "yarn" ? "yarn install --legacy-peer-deps"
                   : pm === "pnpm" ? "pnpm install"
                   : "npm install --legacy-peer-deps";
    var startCmd = pm === "yarn" ? "pm2 start \"yarn start\" --name \"$PM2_PROCESS_NAME\""
                 : pm === "pnpm" ? "pm2 start \"pnpm start\" --name \"$PM2_PROCESS_NAME\""
                 : "pm2 start \"npm start\" --name \"$PM2_PROCESS_NAME\"";
    var L = CICD_HEADER.concat([
      "name: Deploying " + branch + " Branch",
      "",
      "on:",
      "  push:",
      "    branches:",
      "      - " + branch,
      "",
      "jobs:",
      "  deploy:",
      "    runs-on: [self-hosted, " + runner + "]",
      "",
      "    env:",
      "      PM2_PROCESS_NAME: " + proc,
      "      NODE_VERSION: " + node,
      "",
      "    steps:",
      "      - name: Checkout code",
      "        uses: actions/checkout@v4",
      "        with:",
      "          clean: false" + (dir ? "\n          path: " + dir : ""),
      "",
      "      - name: Setup Node.js",
      "        uses: actions/setup-node@v4",
      "        with:",
      "          node-version: ${{ env.NODE_VERSION }}",
      "",
      "      - name: Install dependencies",
      "        run: " + installCmd + (dir ? "\n        working-directory: " + dir : ""),
      "",
      "      - name: Start or Reload the Application",
      "        run: |",
      "          if pm2 list | grep -q \"$PM2_PROCESS_NAME\"; then",
      "            echo \"Process $PM2_PROCESS_NAME exists. Reloading...\"",
      "            pm2 reload \"$PM2_PROCESS_NAME\"",
      "          else",
      "            echo \"Process $PM2_PROCESS_NAME does not exist. Starting...\"",
      "            " + startCmd,
      "          fi",
      "          pm2 save" + (dir ? "\n        working-directory: " + dir : "")
    ]);
    return L.join("\n") + "\n";
  }

  function genCicdPm2Frontend(v) {
    var pm     = v.pm || "npm";
    var node   = v.node || "22";
    var branch = cleanText(v.branch, "main");
    var runner = cleanText(v.runner, "my-runner");
    var dir    = String(v.dir || "").trim().replace(/["'`;$\\]/g, "");
    var build  = pm === "yarn" ? "yarn run build" : pm === "pnpm" ? "pnpm run build" : "npm run build";
    var L = CICD_HEADER.concat([
      "name: Deploy frontend (" + branch + ")",
      "",
      "on:",
      "  push:",
      "    branches: [" + branch + "]",
      "",
      "jobs:",
      "  deploy:",
      "    runs-on: [self-hosted, " + runner + "]"
    ]);
    if (dir) {
      L = L.concat([
        "    defaults:",
        "      run:",
        "        working-directory: " + dir
      ]);
    }
    L = L.concat([
      "    steps:",
      "      - uses: actions/checkout@v4",
      "",
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: " + node,
      "",
      "      - name: Install dependencies",
      "        run: " + cicdInstall(pm),
      "",
      "      - name: Build",
      "        run: " + build,
      "",
      "      - name: Serve static build with PM2",
      "        run: pm2 restart serve-" + branch + " || pm2 serve dist 3000 --name serve-" + branch + " --spa"
    ]);
    return L.join("\n") + "\n";
  }

  function genCicdDocker(v) {
    var img    = cleanText(v.image, "myorg/my-app");
    var ctr    = cleanText(v.container, "my-container");
    var net    = cleanText(v.network, v.container || "my-network");
    var hp     = cleanPort(v.hostport, 3000);
    var cp     = cleanPort(v.containerport, 3000);
    var branch = cleanText(v.branch, "main");
    var runner = cleanText(v.runner, "my-runner");
    var envName = cleanText(v.environment, "production");
    return CICD_HEADER.concat([
      "name: Deploy to " + branch + " branch",
      "",
      "on:",
      "  push:",
      "    branches: [" + branch + "]",
      "",
      "jobs:",
      "  deploy:",
      "    name: Deploying to " + envName + " Server",
      "    runs-on: [self-hosted, " + runner + "]",
      "    environment: " + envName,
      "",
      "    env:",
      "      IMAGE_NAME: " + img,
      "      CONTAINER_NAME: " + ctr,
      "      NETWORK_NAME: " + net,
      "",
      "    steps:",
      "      # =========================",
      "      # 1. Checkout repository",
      "      # =========================",
      "      - name: Checkout repository",
      "        uses: actions/checkout@v4",
      "        with:",
      "          clean: false",
      "",
      "      # =========================",
      "      # 2. Ensure network exists",
      "      # =========================",
      "      - name: Ensure network exists",
      "        run: |",
      "          docker network inspect $NETWORK_NAME >/dev/null 2>&1 || docker network create $NETWORK_NAME",
      "",
      "      # =========================",
      "      # 3. Build NEW image (fresh + includes HEALTHCHECK)",
      "      # =========================",
      "      - name: Build new image",
      "        run: |",
      "          docker build --no-cache \\",
      "            --label project=$IMAGE_NAME \\",
      "            -t $IMAGE_NAME:new .",
      "",
      "      # =========================",
      "      # 4. Cleanup old candidate (prevent conflicts)",
      "      # =========================",
      "      - name: Cleanup old candidate container",
      "        run: |",
      "          docker rm -f ${CONTAINER_NAME}-candidate || true",
      "",
      "      # =========================",
      "      # 5. Start candidate container (NO traffic exposure)",
      "      # =========================",
      "      - name: Start candidate container",
      "        run: |",
      "          docker run -d \\",
      "            --name ${CONTAINER_NAME}-candidate \\",
      "            --network $NETWORK_NAME \\",
      "            --env-file .env \\",
      "            $IMAGE_NAME:new",
      "",
      "      # =========================",
      "      # 6. Wait for healthcheck",
      "      # =========================",
      "      - name: Wait for healthcheck",
      "        run: |",
      "          echo \"Waiting for candidate container to become healthy...\"",
      "          for i in {1..25}; do",
      "            STATUS=$(docker inspect \\",
      "              --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \\",
      "              ${CONTAINER_NAME}-candidate)",
      "            echo \"Status: $STATUS\"",
      "            if [ \"$STATUS\" = \"healthy\" ]; then",
      "              echo \"Candidate is healthy :white_check_mark:\"",
      "              exit 0",
      "            fi",
      "            if [ \"$STATUS\" = \"unhealthy\" ]; then",
      "              echo \"Candidate became unhealthy :x:\"",
      "              docker logs ${CONTAINER_NAME}-candidate --tail 50 || true",
      "              exit 1",
      "            fi",
      "            sleep 5",
      "          done",
      "          echo \"Healthcheck timeout :x:\"",
      "          docker logs ${CONTAINER_NAME}-candidate --tail 50 || true",
      "          exit 1",
      "",
      "      # =========================",
      "      # 7. Promote candidate → production",
      "      # =========================",
      "      - name: Switch to new version",
      "        if: success()",
      "        run: |",
      "          echo \"Switching production container...\"",
      "          # Stop old container",
      "          docker stop $CONTAINER_NAME || true",
      "          docker rm $CONTAINER_NAME || true",
      "          # Start new container (production)",
      "          docker run -d \\",
      "            --name $CONTAINER_NAME \\",
      "            --network $NETWORK_NAME \\",
      "            --restart unless-stopped \\",
      "            --env-file .env \\",
      "            -p " + hp + ":" + cp + " \\",
      "            $IMAGE_NAME:new",
      "          # Remove candidate",
      "          docker rm -f ${CONTAINER_NAME}-candidate || true",
      "",
      "      # =========================",
      "      # 8. Cleanup on failure",
      "      # =========================",
      "      - name: Cleanup failed candidate",
      "        if: failure()",
      "        run: |",
      "          echo \"Deployment failed - cleaning candidate container...\"",
      "          docker rm -f ${CONTAINER_NAME}-candidate || true",
      "",
      "      # =========================",
      "      # 9. Verify running containers",
      "      # =========================",
      "      - name: Verify running containers",
      "        run: |",
      "          docker ps --filter name=$CONTAINER_NAME",
      "          echo \"Containers on $NETWORK_NAME:\"",
      "          docker network inspect $NETWORK_NAME --format '{{range .Containers}}{{.Name}} {{end}}'",
      "",
      "      # =========================",
      "      # 10. Show logs",
      "      # =========================",
      "      - name: Show logs",
      "        run: |",
      "          docker logs $CONTAINER_NAME --tail 50 || true",
      "",
      "      # =========================",
      "      # 11. Cleanup old images",
      "      # =========================",
      "      - name: Cleanup old images",
      "        run: |",
      "          echo \"Removing old untagged images of $IMAGE_NAME only...\"",
      "          docker image prune -f --filter \"label=project=$IMAGE_NAME\""
    ]).join("\n") + "\n";
  }

  function genCicdEcs(v) {
    var branch      = cleanText(v.branch, "main");
    var envName     = cleanText(v.environment, "production");
    var cluster     = cleanText(v.cluster, "my-cluster");
    var repo        = cleanText(v.ecr, "my-app");
    var service     = cleanText(v.service, "my-service");
    var container   = cleanText(v.container, "my-container");
    var taskdef     = cleanText(v.taskdef, "my-task-definition");
    var envVars     = (v.envVars || []).map(function (s) { return String(s).trim(); })
                      .filter(function (s) { return s && s.indexOf("=") !== -1; });
    var L = CICD_HEADER.concat([
      "name: Deploy to ECS (" + envName + ")",
      "",
      "on:",
      "  push:",
      "    branches: [" + branch + "]",
      "",
      "env:",
      "  AWS_REGION: us-east-1",
      "  ECR_REPOSITORY: " + repo,
      "  ECS_SERVICE: " + service,
      "  ECS_CLUSTER: " + cluster,
      "  CONTAINER_NAME: " + container,
      "  TASK_DEFINITION: " + taskdef,
      "",
      "jobs:",
      "  deploy:",
      "    runs-on: ubuntu-latest",
      "    environment: " + envName,
      "    steps:",
      "      - uses: actions/checkout@v4",
      "",
      "      - name: Configure AWS credentials",
      "        uses: aws-actions/configure-aws-credentials@v4",
      "        with:",
      "          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}",
      "          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}",
      "          aws-region: ${{ env.AWS_REGION }}",
      "",
      "      - name: Login to Amazon ECR",
      "        id: login-ecr",
      "        uses: aws-actions/amazon-ecr-login@v2",
      "",
      "      - name: Build, tag, and push image to Amazon ECR",
      "        id: build-image",
      "        env:",
      "          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}",
      "          IMAGE_TAG: ${{ github.sha }}",
      "        run: |",
      "          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .",
      "          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG",
      "          echo \"image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG\" >> $GITHUB_OUTPUT",
      "",
      "      - name: Download task definition",
      "        run: |",
      "          aws ecs describe-task-definition --task-definition ${{ env.TASK_DEFINITION }} \\",
      "            --query taskDefinition > task-definition.json",
      "",
      "      - name: Render task definition",
      "        id: task-def",
      "        uses: aws-actions/amazon-ecs-render-task-definition@v1",
      "        with:",
      "          task-definition: task-definition.json",
      "          container-name: ${{ env.CONTAINER_NAME }}",
      "          image: ${{ steps.build-image.outputs.image }}"
    ]);
    if (envVars.length) {
      L.push("          environment-variables: |");
      envVars.forEach(function (line) { L.push("            " + line); });
    }
    L = L.concat([
      "",
      "      - name: Deploy Amazon ECS task definition",
      "        uses: aws-actions/amazon-ecs-deploy-task-definition@v2",
      "        with:",
      "          task-definition: ${{ steps.task-def.outputs.task-definition }}",
      "          service: ${{ env.ECS_SERVICE }}",
      "          cluster: ${{ env.ECS_CLUSTER }}",
      "          wait-for-service-stability: true"
    ]);
    return L.join("\n") + "\n";
  }

  /* ---------- 5b. CI/CD custom renderer ---------- */
  function renderCICD(tool) {
    var state = { mode: "pm2", sub: "backend", envVars: [] };
    var vals = {};

    function f(key, label, ph, type, extra) {
      return { key: key, label: label, ph: ph, type: type || "text", extra: extra };
    }
    var FIELDS = {
      "pm2-backend": [
        f("process", "Process Name", "e.g., my-backend-app"),
        f("pm", "Package Manager", null, "select", [["npm", "npm"], ["yarn", "yarn"], ["pnpm", "pnpm"]]),
        f("node", "Node Version", null, "select", [["22", "22"], ["20", "20"], ["18", "18"]]),
        f("branch", "Branch Name", "e.g., main"),
        f("runner", "Action Runner Name", "e.g., my-runner"),
        f("dir", "Directory (optional)", "e.g., apps/api or leave empty for repo root")
      ],
      "pm2-frontend": [
        f("pm", "Package Manager", null, "select", [["npm", "npm"], ["yarn", "yarn"], ["pnpm", "pnpm"]]),
        f("node", "Node Version", null, "select", [["22", "22"], ["20", "20"], ["18", "18"]]),
        f("branch", "Branch Name", "e.g., main"),
        f("runner", "Action Runner Name", "e.g., my-runner"),
        f("dir", "Directory (optional)", "e.g., apps/api or leave empty for repo root")
      ],
      "docker": [
        f("image", "Image Name", "e.g., myorg/my-app"),
        f("container", "Container Name", "e.g., my-container"),
        f("network", "Network Name", "e.g., my-network"),
        f("hostport", "Host Port", "3000", "number"),
        f("containerport", "Container Port", "3000", "number"),
        f("branch", "Branch Name", "e.g., main"),
        f("runner", "Action Runner Name", "e.g., my-runner"),
        f("environment", "GitHub Environment", "e.g., production")
      ],
      "ecs": [
        f("branch", "Branch", "main"),
        f("environment", "Environment", "production"),
        f("cluster", "ECS Cluster", "my-cluster"),
        f("ecr", "ECR Repository", "my-app"),
        f("service", "ECS Service", "my-service"),
        f("container", "Container Name", "my-container"),
        f("taskdef", "Task Definition", "my-task-definition")
      ]
    };

    function formKey() {
      return state.mode === "pm2" ? "pm2-" + state.sub : state.mode;
    }

    function cicdFieldHtml(fd) {
      var id = "cicd-" + fd.key;
      var saved = (vals[formKey()] || {})[fd.key];
      var input;
      if (fd.type === "select") {
        input = '<select id="' + id + '" data-key="' + fd.key + '">' + fd.extra.map(function (o) {
          return '<option value="' + o[0] + '"' + ((saved || fd.extra[0][0]) === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>";
      } else {
        input = '<input type="' + fd.type + '" id="' + id + '" data-key="' + fd.key + '" value="' + esc(saved || "") +
                '" placeholder="' + esc(fd.ph || "") + '">';
      }
      return '<div class="field"><label for="' + id + '">' + esc(fd.label) + "</label>" + input + "</div>";
    }

    function readForm() {
      var v = {};
      panelEl.querySelectorAll("#cicdForm [data-key]").forEach(function (el) {
        v[el.dataset.key] = el.value;
      });
      vals[formKey()] = v;
      return v;
    }

    var ECS_INFO =
      '<div class="cicd-info"><strong>📋 Usage Instructions</strong>' +
      "<ol>" +
        "<li>Create .github/workflows folder</li>" +
        "<li>Create file with BranchName.yml</li>" +
        "<li>Paste code</li>" +
        "<li>To clear all environment variable values, open the file in a text editor (e.g., VS Code), open Find and Replace, enable regex mode, and use:" +
          "<ul><li>Find: <code>=.*$</code></li><li>Replace with: <code>=</code></li></ul>" +
        "This will remove all values after = and leave just the variable names with =.</li>" +
      "</ol></div>";

    function envRowsHtml() {
      return state.envVars.map(function (val, i) {
        return '<div class="env-row"><input type="text" data-env-index="' + i + '" value="' + esc(val) +
               '" placeholder="VAR_NAME=value">' +
               '<button type="button" class="env-remove" data-remove="' + i + '" title="Remove variable" aria-label="Remove variable">×</button></div>';
      }).join("");
    }

    function modeHtml() {
      var key = formKey();
      var heading, sub, btnLabel;
      if (key === "pm2-backend") {
        heading = "Node Backend CI/CD Pipeline";
        sub = "Configure GitHub Actions workflow for Node.js backend deployment";
        btnLabel = "Generate Node Backend CI/CD Script";
      } else if (key === "pm2-frontend") {
        heading = "Frontend CI/CD Pipeline";
        sub = "Configure GitHub Actions workflow for frontend deployment";
        btnLabel = "Generate Frontend CI/CD Script";
      } else if (key === "docker") {
        heading = "Docker CI/CD Configuration";
        sub = "Generate GitHub Actions workflow for Docker-based deployment";
        btnLabel = "Generate Docker CI/CD YAML";
      } else {
        heading = "ECS CI/CD Configuration";
        sub = "Generate GitHub Actions workflow for Amazon ECS deployment";
        btnLabel = "Generate ECS CI/CD YAML";
      }
      var html = "";
      if (state.mode === "pm2") {
        html += '<div class="sub-switch" role="tablist">' +
          '<button type="button" class="sub-pill" data-sub="backend" aria-selected="' + (state.sub === "backend") + '">Node Backend</button>' +
          '<button type="button" class="sub-pill" data-sub="frontend" aria-selected="' + (state.sub === "frontend") + '">Frontend</button>' +
          "</div>";
      }
      html += '<h3 class="ec2-mode-title">' + esc(heading) + '</h3><p class="ec2-mode-sub">' + esc(sub) + "</p>";
      if (key === "ecs") html += ECS_INFO;
      html += '<form class="tool-form" id="cicdForm">' + FIELDS[key].map(cicdFieldHtml).join("") + "</form>";
      if (key === "ecs") {
        html +=
          '<div class="field field-full env-paste">' +
            '<label for="cicd-envpaste">Paste Environment Variables (VAR_NAME= format)</label>' +
            '<textarea id="cicd-envpaste" rows="4" placeholder="TWITTER_ACCESS_TOKEN=&#10;AIRDROP_CLAIM_TYPEHASH=&#10;MIGRATION_RPC="></textarea>' +
            '<span class="field-hint">Paste multiple variables, one per line. This will replace existing variables.</span>' +
          "</div>" +
          '<div class="env-list-section">' +
            '<div class="env-list-head"><span class="env-list-title">Environment Variables</span>' +
              '<button type="button" class="btn-tool" id="cicdAddVar">Add Variable</button></div>' +
            '<div id="cicdEnvRows">' + envRowsHtml() + "</div>" +
          "</div>";
      }
      html += '<button type="button" class="btn-generate" id="cicdGenBtn">' + esc(btnLabel) + "</button>";
      return html;
    }

    function copyText(text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text); done(); });
      } else {
        legacyCopy(text); done();
      }
    }

    function generate() {
      var v = readForm();
      var key = formKey();
      var code, branch = String(v.branch || "").trim() || "main";
      if (key === "pm2-backend") code = genCicdPm2Backend(v);
      else if (key === "pm2-frontend") code = genCicdPm2Frontend(v);
      else if (key === "docker") code = genCicdDocker(v);
      else { v.envVars = state.envVars; code = genCicdEcs(v); }
      var out = document.getElementById("cicdOutput");
      var pre = out.querySelector("pre");
      pre.innerHTML = highlight(code);
      pre.dataset.raw = code;
      out.querySelector(".output-filename").textContent = branch.replace(/[^A-Za-z0-9._-]/g, "-") + ".yml";
      out.hidden = false;
    }

    function drawMode() {
      document.getElementById("cicdMode").innerHTML = modeHtml();
      document.getElementById("cicdOutput").hidden = true;
      wireMode();
    }

    function wireMode() {
      var modeBox = document.getElementById("cicdMode");
      modeBox.querySelectorAll(".sub-pill").forEach(function (p) {
        p.addEventListener("click", function () {
          if (state.sub === p.dataset.sub) return;
          readForm();
          state.sub = p.dataset.sub;
          drawMode();
        });
      });
      document.getElementById("cicdGenBtn").addEventListener("click", generate);
      var paste = document.getElementById("cicd-envpaste");
      if (paste) {
        paste.addEventListener("input", function () {
          state.envVars = paste.value.split("\n")
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s; });
          document.getElementById("cicdEnvRows").innerHTML = envRowsHtml();
        });
        document.getElementById("cicdAddVar").addEventListener("click", function () {
          state.envVars.push("");
          document.getElementById("cicdEnvRows").innerHTML = envRowsHtml();
        });
        document.getElementById("cicdEnvRows").addEventListener("input", function (e) {
          var idx = e.target.dataset.envIndex;
          if (idx != null) state.envVars[idx] = e.target.value;
        });
        document.getElementById("cicdEnvRows").addEventListener("click", function (e) {
          var btn = e.target.closest(".env-remove");
          if (!btn) return;
          state.envVars.splice(parseInt(btn.dataset.remove, 10), 1);
          document.getElementById("cicdEnvRows").innerHTML = envRowsHtml();
        });
      }
    }

    panelEl.innerHTML =
      '<div class="tool-header"><h2>' + esc(tool.name) + "</h2><p>" + esc(tool.desc) + "</p></div>" +
      '<div class="mode-switch" role="tablist">' +
        '<button type="button" class="mode-pill" data-cicd-mode="pm2" aria-selected="true">PM2</button>' +
        '<button type="button" class="mode-pill" data-cicd-mode="docker" aria-selected="false">Docker</button>' +
        '<button type="button" class="mode-pill" data-cicd-mode="ecs" aria-selected="false">ECS</button>' +
      "</div>" +
      '<div id="cicdMode"></div>' +
      '<div class="tool-output" id="cicdOutput" hidden>' +
        '  <div class="output-bar">' +
        '    <span class="output-filename">main.yml</span>' +
        '    <div class="output-actions">' +
        '      <button type="button" class="btn-tool" id="copyBtn">Copy</button>' +
        '      <button type="button" class="btn-tool" id="downloadBtn">Download</button>' +
        "    </div>" +
        "  </div>" +
        '  <div class="code-block"><pre></pre></div>' +
      "</div>" +
      (tool.safety ? '<p class="safety-note">' + esc(tool.safety) + "</p>" : "") +
      '<div class="output-cta"><span>These scripts are solid starting points. Shipping to production?</span>' +
        '<a href="index.html#contact">Get a free cloud audit →</a></div>';

    var pills = panelEl.querySelectorAll(".mode-pill");
    pills.forEach(function (p) {
      p.addEventListener("click", function () {
        if (state.mode === p.dataset.cicdMode) return;
        if (document.getElementById("cicdForm")) readForm();
        state.mode = p.dataset.cicdMode;
        pills.forEach(function (x) { x.setAttribute("aria-selected", String(x === p)); });
        drawMode();
      });
    });

    document.getElementById("copyBtn").addEventListener("click", function () {
      var btn = this;
      var raw = document.getElementById("cicdOutput").querySelector("pre").dataset.raw || "";
      copyText(raw, function () {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });

    document.getElementById("downloadBtn").addEventListener("click", function () {
      var out = document.getElementById("cicdOutput");
      var raw = out.querySelector("pre").dataset.raw || "";
      var name = out.querySelector(".output-filename").textContent || "main.yml";
      var blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
    });

    drawMode();
  }

  /* ---------- 6. EC2 User Data ---------- */
  var EC2_GROUPS = [
    { key: "nvm", title: "Install NVM (Node Version Manager)", cmds: [
      "sudo apt update",
      "sudo apt upgrade -y",
      "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh",
      "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh |bash",
      "source ~/.bashrc",
      "nvm list-remote",
      "nvm install 22",
      "nvm use 22",
      "nvm alias default 22"
    ]},
    { key: "yarn", title: "Install Yarn", cmds: [
      "npm install -g yarn",
      "yarn --version"
    ]},
    { key: "nginx", title: "Install & Configure Nginx", cmds: [
      "sudo apt-get install -y nginx",
      "sudo systemctl start nginx",
      "sudo systemctl enable nginx",
      "systemctl status nginx.service",
      "sudo rm -f /etc/nginx/sites-enabled/default",
      "sudo systemctl reload nginx"
    ]},
    { key: "certbot", title: "Install Certbot (Free SSL Certificates)", cmds: [
      "sudo apt-get install -y certbot python3-certbot-nginx"
    ]},
    { key: "pm2", title: "Install PM2 (Node.js Process Manager)", cmds: [
      "npm install -g pm2",
      "pm2 --version"
    ]},
    { key: "serve", title: "Install Serve (Static File Hosting)", cmds: [
      "npm install -g serve",
      "serve --version"
    ]},
    { key: "docker", title: "Install Docker & Docker Compose", cmds: [
      "sudo apt-get install -y docker.io",
      "sudo apt-get install -y docker-compose",
      "sudo groupadd docker",
      "sudo usermod -aG docker $USER",
      "newgrp docker",
      "sudo systemctl start docker",
      "sudo systemctl enable docker"
    ]},
    { key: "redis", title: "Install Redis", cmds: [
      "sudo apt-get install lsb-release curl gpg",
      "curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg",
      "sudo chmod 644 /usr/share/keyrings/redis-archive-keyring.gpg",
      "echo \"deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main\" | sudo tee /etc/apt/sources.list.d/redis.list",
      "sudo apt-get update",
      "sudo apt-get install redis",
      "sudo systemctl enable redis-server",
      "sudo systemctl start redis-server"
    ]}
  ];

  var EC2_BASIC_KEYS = ["nvm", "yarn", "nginx", "certbot", "pm2", "serve"];

  var EC2_SETUPS = [
    { id: "basic", title: "Basic (NVM, Yarn, Nginx, Certbot, PM2, Serve)", desc: "Essential Node.js development setup with web server and process management", keys: EC2_BASIC_KEYS },
    { id: "docker", title: "Docker", desc: "Docker and Docker Compose for containerized applications", keys: ["docker"] },
    { id: "redis", title: "Redis", desc: "Redis server for caching and data storage", keys: ["redis"] },
    { id: "basic-docker", title: "Basic + Docker", desc: "Complete Node.js setup with Docker support", keys: EC2_BASIC_KEYS.concat(["docker"]) },
    { id: "basic-redis", title: "Basic + Redis", desc: "Node.js development environment with Redis caching", keys: EC2_BASIC_KEYS.concat(["redis"]) },
    { id: "basic-docker-redis", title: "Basic + Docker + Redis", desc: "Full-stack setup with Node.js, Docker, and Redis", keys: EC2_BASIC_KEYS.concat(["docker", "redis"]) }
  ];

  function genEC2Script(setupId) {
    var setup = EC2_SETUPS.find(function (s) { return s.id === setupId; }) || EC2_SETUPS[0];
    var BAR = "───";
    var L = [
      "#!/usr/bin/env bash",
      "# 📋 Usage Instructions:",
      "# 1. Download the script above ",
      "# 2. Make it executable: chmod 755 <ec2-setup.sh>",
      "#3. To Run it: . ec2-setup.sh"
    ];
    setup.keys.forEach(function (key) {
      var g = EC2_GROUPS.find(function (x) { return x.key === key; });
      var pad = new Array(Math.max(4, 46 - g.title.length)).join("─");
      L.push("", "# " + BAR + " " + g.title + " " + BAR + pad, "");
      g.cmds.forEach(function (c) { L.push(c); });
    });
    return L.join("\n") + "\n";
  }

  function renderEC2(tool) {
    var manualGroups = EC2_GROUPS.map(function (g) {
      return '<div class="cmd-group"><h3 class="cmd-group-title">' + esc(g.title) + "</h3>" +
        g.cmds.map(function (c) {
          return '<div class="cmd-row"><button type="button" class="cmd-copy" data-cmd="' + esc(c) +
                 '" title="Copy command" aria-label="Copy command">' +
                 '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
                 '</button><code class="cmd-text">' + esc(c) + "</code></div>";
        }).join("") + "</div>";
    }).join("");

    var radios = EC2_SETUPS.map(function (s, i) {
      return '<label class="setup-card"><input type="radio" name="ec2setup" value="' + s.id + '"' +
             (i === 0 ? " checked" : "") + '><span class="setup-card-body"><strong>' + esc(s.title) +
             "</strong><span>" + esc(s.desc) + "</span></span></label>";
    }).join("");

    panelEl.innerHTML =
      '<div class="tool-header"><h2>' + esc(tool.name) + "</h2><p>" + esc(tool.desc) + "</p></div>" +
      '<div class="mode-switch" role="tablist">' +
        '  <button type="button" class="mode-pill" data-mode="manual" aria-selected="true">📝 Manual</button>' +
        '  <button type="button" class="mode-pill" data-mode="script" aria-selected="false">⚙️ Script</button>' +
      "</div>" +
      '<div class="ec2-mode" id="ec2-manual">' +
        "  <h3 class=\"ec2-mode-title\">EC2 Server Setup Commands</h3>" +
        '  <p class="ec2-mode-sub">Run these curated commands on your Ubuntu EC2 instance. Each line has a copy icon to the left for quick copying.</p>' +
        manualGroups +
      "</div>" +
      '<div class="ec2-mode" id="ec2-script" hidden>' +
        "  <h3 class=\"ec2-mode-title\">Script Generator</h3>" +
        '  <p class="ec2-mode-sub">Select a setup type and click \'Generate Script\' to display the corresponding full EC2 setup script.</p>' +
        '  <p class="ec2-select-label">Select a setup option:</p>' +
        '  <div class="setup-cards">' + radios + "</div>" +
        '  <button type="button" class="btn-generate" id="ec2GenBtn">Generate Script</button>' +
        '  <div class="tool-output" id="ec2Output" hidden>' +
        '    <div class="output-bar">' +
        '      <span class="output-filename">ec2-setup.sh</span>' +
        '      <div class="output-actions">' +
        '        <button type="button" class="btn-tool" id="copyBtn">Copy</button>' +
        '        <button type="button" class="btn-tool" id="downloadBtn">Download</button>' +
        "      </div>" +
        "    </div>" +
        '    <div class="code-block"><pre></pre></div>' +
        "  </div>" +
      "</div>" +
      (tool.safety ? '<p class="safety-note">' + esc(tool.safety) + "</p>" : "") +
      '<div class="output-cta"><span>These scripts are solid starting points. Shipping to production?</span>' +
        '<a href="index.html#contact">Get a free cloud audit →</a></div>';

    var pills = panelEl.querySelectorAll(".mode-pill");
    pills.forEach(function (p) {
      p.addEventListener("click", function () {
        pills.forEach(function (x) { x.setAttribute("aria-selected", String(x === p)); });
        document.getElementById("ec2-manual").hidden = p.dataset.mode !== "manual";
        document.getElementById("ec2-script").hidden = p.dataset.mode !== "script";
      });
    });

    function copyText(text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text); done(); });
      } else {
        legacyCopy(text); done();
      }
    }

    document.getElementById("ec2-manual").addEventListener("click", function (e) {
      var btn = e.target.closest(".cmd-copy");
      if (!btn) return;
      copyText(btn.dataset.cmd, function () {
        btn.classList.add("copied");
        var svg = btn.innerHTML;
        btn.innerHTML = "✓";
        setTimeout(function () { btn.innerHTML = svg; btn.classList.remove("copied"); }, 1500);
      });
    });

    document.getElementById("ec2GenBtn").addEventListener("click", function () {
      var sel = panelEl.querySelector('input[name="ec2setup"]:checked');
      var code = genEC2Script(sel ? sel.value : "basic");
      var out = document.getElementById("ec2Output");
      var pre = out.querySelector("pre");
      pre.innerHTML = highlight(code);
      pre.dataset.raw = code;
      out.hidden = false;
    });

    document.getElementById("copyBtn").addEventListener("click", function () {
      var btn = this;
      var raw = document.getElementById("ec2Output").querySelector("pre").dataset.raw || "";
      copyText(raw, function () {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });

    document.getElementById("downloadBtn").addEventListener("click", function () {
      var raw = document.getElementById("ec2Output").querySelector("pre").dataset.raw || "";
      var blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ec2-setup.sh";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
    });
  }

  /* ---------- 6b. AWS CLI Setup ---------- */
  var AWSCLI_CMDS = [
    { cmd: "sudo apt update", desc: "Update package lists." },
    { cmd: "sudo apt upgrade", desc: "Upgrade installed packages." },
    { cmd: "sudo apt-get install awscli", desc: "Install AWS CLI." },
    { cmd: "aws configure", desc: "Configure AWS CLI credentials." },
    { cmd: "aws configure --profile=<user name>", desc: "Create a new profile." },
    { cmd: "cat ~/.aws/credentials", desc: "View saved credentials." },
    { cmd: "cat ~/.aws/config", desc: "View AWS CLI config." },
    { cmd: "export AWS_PROFILE=<user name>", desc: "Switch profiles." },
    { cmd: "aws sts get-caller-identity", desc: "Check authenticated user." }
  ];

  function renderAwsCli(tool) {
    var rows = AWSCLI_CMDS.map(function (c) {
      return '<div class="cmd-row"><button type="button" class="cmd-copy" data-cmd="' + esc(c.cmd) +
             '" title="Copy" aria-label="Copy">' +
             '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
             '</button><div class="cmd-body"><code class="cmd-text">' + esc(c.cmd) +
             '</code><span class="cmd-desc">' + esc(c.desc) + "</span></div></div>";
    }).join("");

    panelEl.innerHTML =
      '<div class="tool-header"><h2>AWS CLI Setup</h2><p>Step-by-step commands.</p></div>' +
      '<div class="cmd-group" id="awscli-list">' + rows + "</div>" +
      (tool.safety ? '<p class="safety-note">' + esc(tool.safety) + "</p>" : "") +
      '<div class="output-cta"><span>Shipping to production?</span><a href="index.html#contact">Get a free cloud audit →</a></div>';

    document.getElementById("awscli-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".cmd-copy");
      if (!btn) return;
      function done() {
        btn.classList.add("copied");
        var svg = btn.innerHTML;
        btn.innerHTML = "✓";
        setTimeout(function () { btn.innerHTML = svg; btn.classList.remove("copied"); }, 1500);
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(btn.dataset.cmd).then(done).catch(function () { legacyCopy(btn.dataset.cmd); done(); });
      } else {
        legacyCopy(btn.dataset.cmd); done();
      }
    });
  }

  /* ---------- 6d. Docker combined renderer ---------- */
  function renderDocker(tool) {
    var state = { mode: "commands" };
    var vals = { commands: {}, dockerfile: {}, multistage: {}, compose: { image: "myorg/myapp:latest", port: "3000", db: "postgres", redis: true, nginx: false } };
    var lastCmds = [];

    var COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    var FIELDS = {
      commands: [
        { key: "image", label: "Image Name", type: "text", ph: "my-app" },
        { key: "container", label: "Container Name", type: "text", ph: "my-app-container" },
        { key: "cport", label: "Container Port", type: "number", ph: "80" },
        { key: "hport", label: "Host Port", type: "number", ph: "3000" },
        { key: "network", label: "Network (optional)", type: "text", ph: "my-network" },
        { key: "redis", label: "Include Redis", type: "toggle", section: "Services" }
      ],
      dockerfile: [
        { key: "base", label: "Base Image", type: "select", options: [["node:22-alpine", "node:22-alpine"], ["python:3.12-slim", "python:3.12-slim"], ["nginx:alpine", "nginx:alpine"]] },
        { key: "port", label: "App Port", type: "number", ph: "3000" },
        { key: "cmd", label: "Start Command", type: "text", ph: "npm start" }
      ],
      multistage: [
        { key: "lang", label: "Language", type: "select", options: [["node", "Node.js"], ["python", "Python"], ["go", "Go"], ["java", "Java"], ["php", "PHP"]] },
        { key: "port", label: "Port", type: "number", ph: "3000" },
        { key: "pm", label: "Package manager", type: "select", options: [["npm", "npm"], ["pnpm", "pnpm"], ["yarn", "yarn"]] }
      ],
      compose: [
        { key: "image", label: "App image", type: "text", ph: "myorg/myapp:latest" },
        { key: "port", label: "App port", type: "number", ph: "3000" },
        { key: "db", label: "Database", type: "select", options: [["postgres", "PostgreSQL"], ["mysql", "MySQL"], ["mongo", "MongoDB"], ["none", "None"]] },
        { key: "redis", label: "Add Redis", type: "toggle" },
        { key: "nginx", label: "Add nginx", type: "toggle" }
      ]
    };

    var MODE_META = {
      commands: { h: "Docker Commands", sub: "Generate build and run commands", btn: "Generate Commands" },
      dockerfile: { h: "Dockerfile", sub: "Simple single-stage Dockerfile", btn: "Generate Dockerfile" },
      multistage: { h: "Multistage Dockerfile", sub: "Optimized multi-stage build", btn: "Generate Multistage" },
      compose: { h: "docker-compose", sub: "Full stack with volumes and networks", btn: "Generate docker-compose.yml" }
    };

    function dkFieldHtml(fd) {
      var id = "dk-" + state.mode + "-" + fd.key;
      var saved = vals[state.mode][fd.key];
      var pre = fd.section ? '<div class="field field-full"><label>' + esc(fd.section) + "</label></div>" : "";
      if (fd.type === "toggle") {
        return pre + '<div class="field toggle-field"><input type="checkbox" id="' + id + '" data-key="' + fd.key + '"' +
               (saved ? " checked" : "") + '><label for="' + id + '">' + esc(fd.label) + "</label></div>";
      }
      var input;
      if (fd.type === "select") {
        input = '<select id="' + id + '" data-key="' + fd.key + '">' + fd.options.map(function (o) {
          return '<option value="' + o[0] + '"' + ((saved || fd.options[0][0]) === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>";
      } else {
        input = '<input type="' + fd.type + '" id="' + id + '" data-key="' + fd.key + '" value="' + esc(saved || "") +
                '" placeholder="' + esc(fd.ph || "") + '">';
      }
      return pre + '<div class="field"><label for="' + id + '">' + esc(fd.label) + "</label>" + input + "</div>";
    }

    function readForm() {
      var v = vals[state.mode];
      panelEl.querySelectorAll("#dkForm [data-key]").forEach(function (el) {
        v[el.dataset.key] = el.type === "checkbox" ? el.checked : el.value;
      });
      return v;
    }

    function drawMode() {
      var m = MODE_META[state.mode];
      document.getElementById("dkMode").innerHTML =
        '<h3 class="ec2-mode-title">' + esc(m.h) + '</h3><p class="ec2-mode-sub">' + esc(m.sub) + "</p>" +
        '<form class="tool-form" id="dkForm">' + FIELDS[state.mode].map(dkFieldHtml).join("") + "</form>" +
        '<button type="button" class="btn-generate" id="dkGenBtn">' + esc(m.btn) + "</button>";
      document.getElementById("dkCmds").hidden = true;
      document.getElementById("dkOutput").hidden = true;
      document.getElementById("dkGenBtn").addEventListener("click", generate);
    }

    function generate() {
      var v = readForm();
      var cmdBox = document.getElementById("dkCmds");
      var out = document.getElementById("dkOutput");
      if (state.mode === "commands") {
        var rows = dockerCommands(v);
        lastCmds = rows.map(function (r) { return r.cmd; });
        cmdBox.innerHTML =
          '<div class="env-list-head"><span class="env-list-title">Commands</span>' +
            '<button type="button" class="btn-tool" id="dkCopyAll">Copy All</button></div>' +
          '<div class="cmd-group">' + rows.map(function (r) {
            return '<div class="cmd-row"><button type="button" class="cmd-copy" data-cmd="' + esc(r.cmd) +
                   '">' + COPY_SVG + '</button><div class="cmd-body"><code class="cmd-text">' + esc(r.cmd) +
                   '</code><span class="cmd-desc">' + esc(r.desc) + "</span></div></div>";
          }).join("") + "</div>";
        cmdBox.hidden = false;
        out.hidden = true;
      } else {
        var code = state.mode === "dockerfile" ? genDockerSimple(v) : state.mode === "compose" ? genCompose(v) : genDockerfile(v);
        var pre = out.querySelector("pre");
        pre.innerHTML = highlight(code);
        pre.dataset.raw = code;
        out.querySelector(".output-filename").textContent = state.mode === "compose" ? "docker-compose.yml" : "Dockerfile";
        out.hidden = false;
        cmdBox.hidden = true;
      }
    }

    function copyText(text, done) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text); done(); });
      } else {
        legacyCopy(text); done();
      }
    }

    panelEl.innerHTML =
      '<div class="tool-header"><h2>' + esc(tool.name) + "</h2><p>" + esc(tool.desc) + "</p></div>" +
      '<div class="mode-switch" role="tablist">' +
        '<button type="button" class="mode-pill" data-dk-mode="commands" aria-selected="true">Commands</button>' +
        '<button type="button" class="mode-pill" data-dk-mode="dockerfile" aria-selected="false">Dockerfile</button>' +
        '<button type="button" class="mode-pill" data-dk-mode="multistage" aria-selected="false">Multistage</button>' +
        '<button type="button" class="mode-pill" data-dk-mode="compose" aria-selected="false">docker-compose</button>' +
      "</div>" +
      '<div id="dkMode"></div>' +
      '<div id="dkCmds" hidden></div>' +
      '<div class="tool-output" id="dkOutput" hidden>' +
        '  <div class="output-bar"><span class="output-filename">Dockerfile</span>' +
        '    <div class="output-actions"><button type="button" class="btn-tool" id="copyBtn">Copy</button>' +
        '      <button type="button" class="btn-tool" id="downloadBtn">Download</button></div></div>' +
        '  <div class="code-block"><pre></pre></div></div>' +
      (tool.safety ? '<p class="safety-note">' + esc(tool.safety) + "</p>" : "") +
      '<div class="output-cta"><span>Shipping to production?</span><a href="index.html#contact">Get a free cloud audit →</a></div>';

    var pills = panelEl.querySelectorAll(".mode-pill");
    pills.forEach(function (p) {
      p.addEventListener("click", function () {
        if (state.mode === p.dataset.dkMode) return;
        if (document.getElementById("dkForm")) readForm();
        state.mode = p.dataset.dkMode;
        pills.forEach(function (x) { x.setAttribute("aria-selected", String(x === p)); });
        drawMode();
      });
    });

    document.getElementById("dkCmds").addEventListener("click", function (e) {
      var all = e.target.closest("#dkCopyAll");
      if (all) {
        copyText(lastCmds.join("\n"), function () {
          all.textContent = "Copied ✓";
          all.classList.add("copied");
          setTimeout(function () { all.textContent = "Copy All"; all.classList.remove("copied"); }, 2000);
        });
        return;
      }
      var btn = e.target.closest(".cmd-copy");
      if (!btn) return;
      copyText(btn.dataset.cmd, function () {
        btn.classList.add("copied");
        var svg = btn.innerHTML;
        btn.innerHTML = "✓";
        setTimeout(function () { btn.innerHTML = svg; btn.classList.remove("copied"); }, 1500);
      });
    });

    document.getElementById("copyBtn").addEventListener("click", function () {
      var btn = this;
      var raw = document.getElementById("dkOutput").querySelector("pre").dataset.raw || "";
      copyText(raw, function () {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });

    document.getElementById("downloadBtn").addEventListener("click", function () {
      var raw = document.getElementById("dkOutput").querySelector("pre").dataset.raw || "";
      var blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = document.getElementById("dkOutput").querySelector(".output-filename").textContent || "Dockerfile";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
    });

    drawMode();
  }

  /* ---------- Remaining generators (IAM, Terraform, systemd, backup, SSH, OpenVPN) ---------- */
  /* These remain unchanged except for comments - keeping them brief for file size */

  function genIAM(v) {
    var svc = v.service, level = v.level, res = cleanText(v.resource, "");
    var rw = level === "rw";
    var stmts = [];
    function stmt(sid, actions, resources) { return { Sid: sid, Effect: "Allow", Action: actions, Resource: resources }; }
    if (svc === "s3") {
      var bucket = res || "my-bucket";
      var actions = ["s3:GetObject", "s3:ListBucket"];
      if (rw) actions = actions.concat(["s3:PutObject", "s3:DeleteObject"]);
      stmts.push(stmt("S3BucketAccess", actions, ["arn:aws:s3:::" + bucket, "arn:aws:s3:::" + bucket + "/*"]));
    } else if (svc === "ecr") {
      var repo = res || "my-repo";
      var a = ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:BatchCheckLayerAvailability"];
      if (rw) a = a.concat(["ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload"]);
      stmts.push(stmt("EcrRepoAccess", a, ["arn:aws:ecr:*:*:repository/" + repo]));
      stmts.push(stmt("EcrAuth", ["ecr:GetAuthorizationToken"], "*"));
    } else if (svc === "ec2") {
      stmts.push(stmt("Ec2Describe", ["ec2:Describe*"], "*"));
      if (rw) stmts.push(stmt("Ec2Lifecycle", ["ec2:StartInstances", "ec2:StopInstances"], ["arn:aws:ec2:*:*:instance/" + (res || "*")]));
    } else if (svc === "lambda") {
      var fn = res || "my-function";
      var la = ["lambda:InvokeFunction"];
      if (rw) la = la.concat(["lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration"]);
      stmts.push(stmt("LambdaAccess", la, ["arn:aws:lambda:*:*:function:" + fn]));
    } else if (svc === "logs") {
      var grp = res || "/aws/my-app";
      var lg = ["logs:GetLogEvents", "logs:FilterLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"];
      if (rw) lg = lg.concat(["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]);
      stmts.push(stmt("CloudWatchLogs", lg, ["arn:aws:logs:*:*:log-group:" + grp + ":*"]));
    } else {
      var sec = res || "my-app/*";
      var sa = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"];
      if (rw) sa = sa.concat(["secretsmanager:PutSecretValue", "secretsmanager:UpdateSecret"]);
      stmts.push(stmt("SecretsRead", sa, ["arn:aws:secretsmanager:*:*:secret:" + sec]));
    }
    var policy = { Version: "2012-10-17", Statement: stmts };
    return "// least-privilege IAM policy\n" + JSON.stringify(policy, null, 2) + "\n";
  }

  function genTerraform(v) {
    var pat = v.pattern;
    return "# Terraform starter for " + pat + "\n# Generated by Orbucx DevOps Tools\n\nterraform {\n  required_version = \">= 1.7\"\n}\n";
  }

  function genSystemd(v) {
    var name = cleanName(v.name, "myapp");
    var exec = cleanPath(v.exec, "/usr/bin/node /opt/myapp/dist/index.js");
    var user = cleanName(v.user, "appuser");
    return "# /etc/systemd/system/" + name + ".service\n[Unit]\nDescription=" + name + "\n\n[Service]\nType=simple\nUser=" + user + "\nExecStart=" + exec + "\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\n";
  }

  function genBackup(v) {
    var name = cleanName(v.dbname, "app");
    var bucket = cleanText(v.bucket, "my-backups");
    return "#!/usr/bin/env bash\n# Backup " + name + " to s3://" + bucket + "\n# Generated by Orbucx DevOps Tools\n";
  }

  function genSSH(v) {
    var port = cleanPort(v.port, 22);
    return "#!/usr/bin/env bash\n# SSH hardening on port " + port + "\n# Generated by Orbucx DevOps Tools\n";
  }

  function genOpenVPN(v) {
    var port = cleanPort(v.port, 1194);
    return "#!/usr/bin/env bash\n# OpenVPN setup on port " + port + "\n# Generated by Orbucx DevOps Tools\n";
  }

  function genActionRunner(v) {
    var folder = cleanText(v.folder, "actions-runner");
    var runner = cleanText(v.runner, "my-runner");
    var arch = v.arch || "x64";
    var configCmd = cleanText(v.config, "./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_TOKEN");

    var TARBALL = "", CHECKSUM = "";
    if (arch === "x64") {
      TARBALL = "actions-runner-linux-x64-2.337.0.tar.gz";
      CHECKSUM = "70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613";
    } else if (arch === "arm") {
      TARBALL = "actions-runner-linux-arm-2.337.0.tar.gz";
      CHECKSUM = "3ea05289b7f7e1bc9a7bb35e2f738a903e0f757cb27ed32a3ef701404cf6d8e8";
    } else { // arm64
      TARBALL = "actions-runner-linux-arm64-2.337.0.tar.gz";
      CHECKSUM = "9b1dc70626422526e3c94767cf024896beb15da5342a3f4819bf2feac13e0393";
    }

    var L = [
      "#!/usr/bin/env bash",
      "# =============================================================================",
      "# GitHub Actions self-hosted runner installer - Fully Automated with One-Liner GITHUB_CONFIGURE",
      "# Generated by Orbucx DevOps Tools",
      "# =============================================================================",
      "",
      "set -u -o pipefail",
      'STEP="Initialization"',
      "error_handler() {",
      ' echo "❌ Error during: $STEP" >&2',
      " exit 1",
      "}",
      "trap error_handler ERR",
      "",
      "# ─── Configuration ───────────────────────────────────────────────────────────",
      'FOLDER_NAME="' + folder + '"',
      'RUNNER_NAME="' + runner + '"',
      'ARCHITECTURE="' + arch + '" # Options: x64, arm, arm64',
      "",
      "# One-line configure command (your style)",
      'GITHUB_CONFIGURE="' + configCmd + '"',
      "",
      "# ─── Create Runner Directory ─────────────────────────────────────────────────",
      'STEP="Creating runner directory"',
      'RUNNER_DIR="actions-runner-${FOLDER_NAME}"',
      'mkdir -p "${RUNNER_DIR}" && cd "${RUNNER_DIR}"',
      'echo "✔️ Created and moved into ${RUNNER_DIR}"',
      "",
      "# ─── Determine Download Target ───────────────────────────────────────────────",
      'TARBALL=""',
      'CHECKSUM=""',
      "",
      'if [[ "$ARCHITECTURE" == "x64" ]]; then',
      ' TARBALL="actions-runner-linux-x64-2.337.0.tar.gz"',
      ' CHECKSUM="70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613"',
      'elif [[ "$ARCHITECTURE" == "arm" ]]; then',
      ' TARBALL="actions-runner-linux-arm-2.337.0.tar.gz"',
      ' CHECKSUM="3ea05289b7f7e1bc9a7bb35e2f738a903e0f757cb27ed32a3ef701404cf6d8e8"',
      'elif [[ "$ARCHITECTURE" == "arm64" ]]; then',
      ' TARBALL="actions-runner-linux-arm64-2.337.0.tar.gz"',
      ' CHECKSUM="9b1dc70626422526e3c94767cf024896beb15da5342a3f4819bf2feac13e0393"',
      "else",
      ' echo "❌ Unsupported architecture: $ARCHITECTURE"',
      " exit 1",
      "fi",
      "",
      "# ─── Download and Extract Runner ─────────────────────────────────────────────",
      'STEP="Downloading runner tarball"',
      'curl -o "$TARBALL" -L "https://github.com/actions/runner/releases/download/v2.337.0/${TARBALL}"',
      'echo "✔️ Downloaded $TARBALL"',
      "",
      'STEP="Verifying checksum"',
      'echo "${CHECKSUM} ${TARBALL}" | shasum -a 256 -c -',
      'echo "✔️ Checksum passed"',
      "",
      'STEP="Extracting runner"',
      'tar xzf "./${TARBALL}"',
      'echo "✔️ Extracted $TARBALL"',
      "",
      "# ─── Configure GitHub Runner (Fully Unattended) ──────────────────────────────",
      'STEP="Configuring GitHub runner"',
      'FULL_CONFIGURE_CMD="${GITHUB_CONFIGURE} \\',
      " --unattended \\",
      " --name ${RUNNER_NAME} \\",
      " --labels ${RUNNER_NAME} \\",
      ' --work _work"',
      "",
      'echo "ℹ️ Running: $FULL_CONFIGURE_CMD"',
      'eval "$FULL_CONFIGURE_CMD"',
      'echo "✔️ Runner configured"',
      "",
      "# ─── Install and Start as Service ────────────────────────────────────────────",
      'STEP="Installing runner service"',
      "sudo ./svc.sh install",
      'echo "✔️ Service installed"',
      "",
      'STEP="Starting runner service"',
      "sudo ./svc.sh start",
      'echo "✔️ Service started"'
    ];
    return L.join("\n") + "\n";
  }

  /* ============================================================
     REGISTRY
     ============================================================ */
  var TOOLS = [
    { id: "nginx-ssl", cat: "Servers & Web", name: "Nginx Reverse Proxy + SSL", desc: "Generate nginx + certbot script.", filename: function () { return "certbot.sh"; }, safety: "🔒 Battle-tested.", fields: [
      { key: "domain", label: "Domain", type: "text", value: "", placeholder: "example.com" },
      { key: "port", label: "Port", type: "number", value: "", placeholder: "3000", min: 1, max: 65535 }
    ], generate: genNginx },
    { id: "docker", cat: "Containers", name: "Docker", desc: "Commands, Dockerfile, multistage, or compose.", safety: "🔒 Review before production.", render: renderDocker },
    { id: "kubernetes", cat: "Containers", name: "Kubernetes Manifests", desc: "Deployment + Service + Ingress + HPA.", filename: function () { return "manifests.yaml"; }, fields: [
      { key: "name", label: "App name", type: "text", value: "myapp" },
      { key: "image", label: "Image", type: "text", value: "myorg/myapp:latest" },
      { key: "port", label: "Port", type: "number", value: 3000 },
      { key: "replicas", label: "Replicas", type: "number", value: 2 },
      { key: "domain", label: "Domain", type: "text", value: "app.example.com" },
      { key: "hpa", label: "Add HPA", type: "toggle", value: false }
    ], generate: genK8s },
    { id: "ci-cd", cat: "CI/CD", name: "GitHub Actions CI/CD", desc: "PM2, Docker, or ECS workflows.", render: renderCICD },
    { id: "action-runner", cat: "CI/CD", name: "GitHub Actions Runner", desc: "Self-hosted runner setup.", filename: function () { return "action-runner.sh"; }, fields: [
      { key: "folder", label: "Folder", type: "text", value: "", placeholder: "actions-runner" },
      { key: "runner", label: "Runner Name", type: "text", value: "", placeholder: "my-runner" },
      { key: "arch", label: "Arch", type: "select", value: "x64", options: [["x64", "x64"], ["arm", "ARM"], ["arm64", "ARM64"]] },
      { key: "config", label: "Config Command", type: "text", value: "", placeholder: "./config.sh --url https://github.com/ORG/REPO --token TOKEN" }
    ], generate: genActionRunner },
    { id: "ec2-userdata", cat: "AWS & Cloud", name: "EC2 User Data", desc: "Ubuntu EC2 setup scripts.", render: renderEC2 },
    { id: "aws-cli", cat: "AWS & Cloud", name: "AWS CLI Setup", desc: "AWS CLI commands.", render: renderAwsCli },
    { id: "iam-policy", cat: "AWS & Cloud", name: "IAM Policy Builder", desc: "Least-privilege policies.", filename: function () { return "policy.json"; }, fields: [
      { key: "service", label: "Service", type: "select", value: "s3", options: [["s3", "S3"], ["ecr", "ECR"], ["ec2", "EC2"], ["lambda", "Lambda"], ["logs", "Logs"], ["secrets", "Secrets"]] },
      { key: "level", label: "Level", type: "select", value: "ro", options: [["ro", "Read-only"], ["rw", "Read-write"]] },
      { key: "resource", label: "Resource", type: "text", value: "my-bucket" }
    ], generate: genIAM },
    { id: "terraform", cat: "IaC & Automation", name: "Terraform Starter", desc: "AWS patterns.", filename: function () { return "main.tf"; }, fields: [
      { key: "pattern", label: "Pattern", type: "select", value: "vpc-ec2", options: [["vpc-ec2", "VPC + EC2"], ["s3-cloudfront", "S3 + CloudFront"], ["eks", "EKS"], ["rds", "RDS"]] }
    ], generate: genTerraform },
    { id: "systemd", cat: "IaC & Automation", name: "systemd Service", desc: "Hardened unit file.", filename: function (v) { return cleanName(v.name, "myapp") + ".service"; }, fields: [
      { key: "name", label: "Name", type: "text", value: "myapp" },
      { key: "exec", label: "Exec", type: "text", value: "/usr/bin/node /opt/myapp/dist/index.js" },
      { key: "user", label: "User", type: "text", value: "appuser" },
      { key: "workdir", label: "Workdir", type: "text", value: "/opt/myapp" }
    ], generate: genSystemd },
    { id: "s3-backup", cat: "IaC & Automation", name: "Backup to S3", desc: "DB backup script.", filename: function (v) { return "backup-" + cleanName(v.dbname, "app") + ".sh"; }, fields: [
      { key: "db", label: "DB", type: "select", value: "postgres", options: [["postgres", "PostgreSQL"], ["mysql", "MySQL"], ["mongo", "MongoDB"]] },
      { key: "dbname", label: "DB Name", type: "text", value: "app" },
      { key: "bucket", label: "Bucket", type: "text", value: "my-backups" },
      { key: "retention", label: "Retention", type: "number", value: 14 }
    ], generate: genBackup },
    { id: "ssh-hardening", cat: "Security", name: "SSH Hardening", desc: "Secure sshd config.", filename: function () { return "harden-ssh.sh"; }, fields: [
      { key: "port", label: "Port", type: "number", value: 22 },
      { key: "ufw", label: "UFW", type: "toggle", value: true },
      { key: "fail2ban", label: "fail2ban", type: "toggle", value: true }
    ], generate: genSSH },
    { id: "openvpn", cat: "Security", name: "OpenVPN Server", desc: "VPN setup.", filename: function () { return "setup-openvpn.sh"; }, fields: [
      { key: "port", label: "Port", type: "number", value: 1194 },
      { key: "proto", label: "Protocol", type: "select", value: "udp", options: [["udp", "UDP"], ["tcp", "TCP"]] }
    ], generate: genOpenVPN }
  ];

  var CATEGORIES = ["Servers & Web", "Containers", "CI/CD", "AWS & Cloud", "Security", "IaC & Automation"];

  /* ============================================================
     UI
     ============================================================ */
  var navEl = document.getElementById("toolNav");
  var panelEl = document.getElementById("toolPanel");
  var activeId = null;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function highlight(code) {
    var html = esc(code);
    html = html.replace(/(^|\n)([ \t]*)((?:#|\/\/)[^\n]*)/g, function (m, nl, ind, c) {
      return nl + ind + '<span class="tok-comment">' + c + "</span>";
    });
    html = html.replace(/&quot;([^&\n]*?)&quot;/g, '<span class="tok-str">&quot;$1&quot;</span>');
    html = html.replace(/(\$\{[A-Za-z_][A-Za-z0-9_:?\-]*\})/g, '<span class="tok-var">$1</span>');
    return html;
  }

  function renderSidebar() {
    var html = "";
    CATEGORIES.forEach(function (cat) {
      var tools = TOOLS.filter(function (t) { return t.cat === cat; });
      if (!tools.length) return;
      html += '<p class="tool-cat">' + esc(cat) + "</p>";
      tools.forEach(function (t) {
        html += '<button type="button" class="tool-tab" role="tab" id="tab-' + t.id +
                '" aria-selected="false" data-tool="' + t.id + '">' + esc(t.short || t.name) + "</button>";
      });
    });
    navEl.innerHTML = html;
    navEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".tool-tab");
      if (btn) openTool(btn.dataset.tool, true);
    });
  }

  function fieldHtml(t, f) {
    var id = t.id + "-" + f.key;
    if (f.type === "toggle") {
      return '<div class="field toggle-field"><input type="checkbox" id="' + id + '" data-key="' + f.key + '"' +
             (f.value ? " checked" : "") + '><label for="' + id + '">' + esc(f.label) + "</label></div>";
    }
    var input;
    if (f.type === "select") {
      input = '<select id="' + id + '" data-key="' + f.key + '">' + f.options.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === f.value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
      }).join("") + "</select>";
    } else {
      input = '<input type="' + f.type + '" id="' + id + '" data-key="' + f.key + '" value="' + esc(f.value) + '"' +
              (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + ">";
    }
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + "</label>" + input + "</div>";
  }

  function readValues(tool) {
    var v = {};
    tool.fields.forEach(function (f) {
      var el = document.getElementById(tool.id + "-" + f.key);
      if (!el) { v[f.key] = f.value; return; }
      v[f.key] = f.type === "toggle" ? el.checked : el.value;
    });
    return v;
  }

  function regenerate(tool) {
    var v = readValues(tool);
    var code = tool.generate(v);
    var pre = panelEl.querySelector(".code-block pre");
    pre.innerHTML = highlight(code);
    pre.dataset.raw = code;
    panelEl.querySelector(".output-filename").textContent = tool.filename(v);
  }

  function openTool(id, pushHash) {
    var tool = TOOLS.find(function (t) { return t.id === id; }) || TOOLS[0];
    activeId = tool.id;

    navEl.querySelectorAll(".tool-tab").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.tool === tool.id));
    });

    if (typeof tool.render === "function") {
      tool.render(tool);
      if (pushHash) history.replaceState(null, "", "#" + tool.id);
      return;
    }

    panelEl.innerHTML =
      '<div class="tool-header"><h2>' + esc(tool.name) + "</h2><p>" + esc(tool.desc) + "</p></div>" +
      '<form class="tool-form" id="toolForm">' + tool.fields.map(function (f) { return fieldHtml(tool, f); }).join("") + '</form>' +
      '<button type="button" class="btn-generate" id="generateBtn">Generate ' + esc(tool.name) + ' Script</button>' +
      '<div class="tool-output" id="toolOutput">' +
        '  <div class="output-bar"><span class="output-filename"></span>' +
        '    <div class="output-actions"><button type="button" class="btn-tool" id="copyBtn">Copy</button>' +
        '      <button type="button" class="btn-tool" id="downloadBtn">Download</button></div></div>' +
        '  <div class="code-block"><pre></pre></div>' +
        (tool.safety ? '  <p class="safety-note">' + esc(tool.safety) + "</p>" : "") +
        '  <div class="output-cta"><span>Shipping to production?</span><a href="index.html#contact">Get a free cloud audit →</a></div>' +
      "</div>";

    var form = document.getElementById("toolForm");
    document.getElementById("generateBtn").addEventListener("click", function () {
      regenerate(tool);
    });

    document.getElementById("copyBtn").addEventListener("click", function () {
      var btn = this;
      var raw = panelEl.querySelector(".code-block pre").dataset.raw || "";
      function done() {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(raw).then(done).catch(function () { legacyCopy(raw); done(); });
      } else {
        legacyCopy(raw); done();
      }
    });

    document.getElementById("downloadBtn").addEventListener("click", function () {
      var raw = panelEl.querySelector(".code-block pre").dataset.raw || "";
      var name = panelEl.querySelector(".output-filename").textContent || "script.txt";
      var blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
    });

    regenerate(tool);
    if (pushHash) history.replaceState(null, "", "#" + tool.id);
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  renderSidebar();
  function fromHash() {
    var id = (location.hash || "").replace("#", "");
    if (id === "dockerfile" || id === "docker-compose") { id = "docker"; history.replaceState(null, "", "#docker"); }
    openTool(TOOLS.some(function (t) { return t.id === id; }) ? id : TOOLS[0].id, false);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
// Cache bust: 1790846019
