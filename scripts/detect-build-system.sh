#!/bin/bash

# Detect build system in the repository
# Usage: ./detect-build-system.sh

set -e

detect_build_system() {
  local build_system="unknown"
  local build_cmd=""
  local test_cmd=""
  local install_cmd=""
  local lint_cmd=""

  # Maven
  if [ -f "pom.xml" ]; then
    build_system="maven"
    build_cmd="mvn clean package -DskipTests"
    test_cmd="mvn test"
    install_cmd="mvn install -DskipTests"
    lint_cmd="mvn checkstyle:check"
  # Gradle
  elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    build_system="gradle"
    build_cmd="./gradlew build -x test"
    test_cmd="./gradlew test"
    install_cmd="./gradlew build -x test"
    lint_cmd="./gradlew checkstyleMain"
  # npm
  elif [ -f "package.json" ]; then
    build_system="npm"
    build_cmd="npm run build"
    test_cmd="npm test"
    install_cmd="npm install"
    lint_cmd="npm run lint"
  # yarn
  elif [ -f "yarn.lock" ]; then
    build_system="yarn"
    build_cmd="yarn build"
    test_cmd="yarn test"
    install_cmd="yarn install"
    lint_cmd="yarn lint"
  # pnpm
  elif [ -f "pnpm-lock.yaml" ]; then
    build_system="pnpm"
    build_cmd="pnpm build"
    test_cmd="pnpm test"
    install_cmd="pnpm install"
    lint_cmd="pnpm lint"
  # Go
  elif [ -f "go.mod" ]; then
    build_system="go"
    build_cmd="go build ./..."
    test_cmd="go test ./..."
    install_cmd="go mod download"
    lint_cmd="golangci-lint run"
  # Rust
  elif [ -f "Cargo.toml" ]; then
    build_system="rust"
    build_cmd="cargo build --release"
    test_cmd="cargo test"
    install_cmd="cargo fetch"
    lint_cmd="cargo clippy"
  # Python
  elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    build_system="python"
    build_cmd="python -m build"
    test_cmd="python -m pytest"
    install_cmd="pip install -r requirements.txt"
    lint_cmd="python -m flake8"
  # Docker
  elif [ -f "Dockerfile" ]; then
    build_system="docker"
    build_cmd="docker build -t app ."
    test_cmd=""
    install_cmd=""
    lint_cmd=""
  # Docker Compose
  elif [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
    build_system="docker-compose"
    build_cmd="docker-compose build"
    test_cmd=""
    install_cmd=""
    lint_cmd=""
  fi

  echo "BUILD_SYSTEM=$build_system"
  echo "BUILD_CMD=$build_cmd"
  echo "TEST_CMD=$test_cmd"
  echo "INSTALL_CMD=$install_cmd"
  echo "LINT_CMD=$lint_cmd"
}

# Run detection
detect_build_system
