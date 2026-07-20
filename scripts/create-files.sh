#!/bin/bash
# ActionCode Enterprise — Mock Agent File Creator
# Creates project files based on instruction
# Usage: create-files.sh "instruction text"

set -e

INSTRUCTION="$1"
INSTRLower=$(echo "$INSTRUCTION" | tr '[:upper:]' '[:lower:]')

echo "Creating files for: $INSTRUCTION"

# Detect project type
IS_NEXTJS=false; IS_PYTHON=false; IS_NODE=false
if echo "$INSTRLower" | grep -qi "nextjs\|next\.js\|next js"; then IS_NEXTJS=true; fi
if echo "$INSTRLower" | grep -qi "python\|flask\|django\|fastapi"; then IS_PYTHON=true; fi

# ── ALWAYS create README ──
printf '%s\n' "# $(echo "$INSTRUCTION" | head -c 80)" "" "Created by ActionCode Enterprise Agent on $(date -u +%Y-%m-%dT%H:%M:%SZ)." "" "## Instruction" "" "> $INSTRUCTION" "" "## Getting Started" "" > README.md

if [ "$IS_NEXTJS" = true ]; then
  printf '%s\n' '```bash' 'npm install' 'npm run dev' '```' "" "## License" "" "MIT" >> README.md
elif [ "$IS_PYTHON" = true ]; then
  printf '%s\n' '```bash' 'pip install -r requirements.txt' 'python main.py' '```' "" "## License" "" "MIT" >> README.md
else
  printf '%s\n' '```bash' 'npm install' 'npm start' '```' "" "## License" "" "MIT" >> README.md
fi
echo "[FILES] Created README.md"

# ── Create project files ──
if [ "$IS_NEXTJS" = true ]; then
  echo "[FILES] Detected Next.js project"
  mkdir -p src/app

  # package.json
  cat > package.json << 'PKGJSON'
{
  "name": "actioncode-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "typescript": "^5"
  }
}
PKGJSON
  echo "[FILES] Created package.json"

  # tsconfig.json
  cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
TSCONFIG
  echo "[FILES] Created tsconfig.json"

  # next.config.js
  cat > next.config.js << 'NEXTCFG'
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
NEXTCFG
  echo "[FILES] Created next.config.js"

  # src/app/layout.tsx
  cat > src/app/layout.tsx << 'LAYOUT'
export const metadata = {
  title: "ActionCode Calculator",
  description: "Next.js Calculator App - Created by ActionCode Enterprise Agent",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
LAYOUT
  echo "[FILES] Created src/app/layout.tsx"

  # src/app/page.tsx — Calculator
  cat > src/app/page.tsx << 'CALCPAGE'
"use client";
import { useState } from "react";

export default function Home() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const digit = (d: string) => {
    if (waiting) { setDisplay(d); setWaiting(false); }
    else { setDisplay(display === "0" ? d : display + d); }
  };

  const dot = () => {
    if (waiting) { setDisplay("0."); setWaiting(false); return; }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const clear = () => { setDisplay("0"); setPrev(null); setOp(null); setWaiting(false); };

  const calc = (nextOp: string) => {
    const val = parseFloat(display);
    if (prev === null) { setPrev(val); }
    else if (op) {
      let r = prev;
      switch (op) {
        case "+": r = prev + val; break;
        case "-": r = prev - val; break;
        case "*": r = prev * val; break;
        case "/": r = val !== 0 ? prev / val : 0; break;
      }
      setDisplay(String(r));
      setPrev(r);
    }
    setWaiting(true);
    setOp(nextOp);
  };

  const equals = () => {
    if (!op || prev === null) return;
    calc("=");
    setOp(null); setPrev(null); setWaiting(true);
  };

  const Btn = ({ l, onClick, c = "" }: { l: string; onClick: () => void; c?: string }) => (
    <button onClick={onClick} className={`calc-btn ${c}`}>{l}</button>
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#1a1a2e" }}>
      <div style={{ background: "#16213e", borderRadius: "16px", padding: "24px", width: "320px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#0f3460", borderRadius: "8px", padding: "16px", marginBottom: "16px", textAlign: "right", fontSize: "2rem", fontFamily: "monospace", color: "#e94560", minHeight: "48px", overflow: "hidden" }}>
          {display}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          <Btn l="C" onClick={clear} c="func" />
          <Btn l="±" onClick={() => setDisplay(String(-parseFloat(display)))} c="func" />
          <Btn l="%" onClick={() => setDisplay(String(parseFloat(display) / 100))} c="func" />
          <Btn l="/" onClick={() => calc("/")} c="op" />
          <Btn l="7" onClick={() => digit("7")} />
          <Btn l="8" onClick={() => digit("8")} />
          <Btn l="9" onClick={() => digit("9")} />
          <Btn l="*" onClick={() => calc("*")} c="op" />
          <Btn l="4" onClick={() => digit("4")} />
          <Btn l="5" onClick={() => digit("5")} />
          <Btn l="6" onClick={() => digit("6")} />
          <Btn l="-" onClick={() => calc("-")} c="op" />
          <Btn l="1" onClick={() => digit("1")} />
          <Btn l="2" onClick={() => digit("2")} />
          <Btn l="3" onClick={() => digit("3")} />
          <Btn l="+" onClick={() => calc("+")} c="op" />
          <Btn l="0" onClick={() => digit("0")} c="zero" />
          <Btn l="." onClick={dot} />
          <Btn l="=" onClick={equals} c="op" />
        </div>
      </div>
    </div>
  );
}
CALCPAGE
  echo "[FILES] Created src/app/page.tsx (Calculator)"

  # src/app/globals.css
  cat > src/app/globals.css << 'GLOBALCSS'
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }
.calc-btn {
  border: none; border-radius: 8px; padding: 16px; font-size: 1.2rem;
  cursor: pointer; transition: all 0.15s; font-weight: 600;
}
.calc-btn:hover { transform: scale(1.05); }
.calc-btn:active { transform: scale(0.95); }
.calc-btn:not(.func):not(.op) { background: #1a1a2e; color: #e6e6e6; }
.calc-btn:not(.func):not(.op):hover { background: #2a2a4e; }
.calc-btn.func { background: #533483; color: #e6e6e6; }
.calc-btn.func:hover { background: #6a42a0; }
.calc-btn.op { background: #e94560; color: white; }
.calc-btn.op:hover { background: #ff6b6b; }
.calc-btn.zero { grid-column: span 2; }
GLOBALCSS
  echo "[FILES] Created src/app/globals.css"

elif [ "$IS_PYTHON" = true ]; then
  echo "[FILES] Detected Python project"
  cat > main.py << 'MAINPY'
"""$(echo "$INSTRUCTION" | head -c 80)"""
from datetime import datetime

def main():
    print(f"Application started at {datetime.now()}")
    print("Instruction: $(echo "$INSTRUCTION")")

if __name__ == "__main__":
    main()
MAINPY
  echo "[FILES] Created main.py"
  echo "# Dependencies" > requirements.txt
  echo "[FILES] Created requirements.txt"

else
  echo "[FILES] Detected Node.js project"
  cat > package.json << 'PKGJSON'
{
  "name": "actioncode-app",
  "version": "0.1.0",
  "description": "$(echo "$INSTRUCTION" | head -c 100)",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "echo \"Tests passed\""
  },
  "license": "MIT"
}
PKGJSON
  echo "[FILES] Created package.json"

  cat > index.js << 'INDEXJS'
/**
 * $(echo "$INSTRUCTION" | head -c 80)
 * Generated by ActionCode Enterprise Agent
 */
console.log("Application started");

function main() {
  console.log("Main function executing...");
}

main();
INDEXJS
  echo "[FILES] Created index.js"

  printf '%s\n' "node_modules/" "dist/" ".env" "*.log" > .gitignore
  echo "[FILES] Created .gitignore"
fi

TOTAL=$(find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | wc -l)
echo "[FILES] Done — $TOTAL files created"
