# Paradecor 3D Designer

A modular 3D designer for Paradecor, built with React, Three.js, and Clerk.

## 🧠 Repository Memory (Remote Origin)
If the project becomes disconnected from GitHub or the Git configuration is corrupted, use the following information to restore the environment:

- **Remote URL**: `https://github.com/jgreensite/paradecor`
- **Primary Branch**: `main`
- **Modularization Branch**: `joelgreensite/fle-23-ryb-126-extract-all-large-jsx-panels-from-apptsx-into-modularization`

### Quick Fix
To restore the repository configuration (remote, tracking branches, and recommended settings):
```bash
npm run repo:fix
```

## Getting Started

### Prerequisites
- Node.js (v20+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jgreensite/paradecor.git
   cd paradecor
   ```
2. Setup environment:
   ```bash
   npm install
   npm run repo:fix
   ```

### Development
```bash
npm run dev
```

### Testing
- **Unit Tests**: `npm run test:run`
- **Type Checking**: `npx tsc --noEmit`
- **Architecture Validation**: `npx depcruise src --output-type err-long`

## 🏗️ Architecture
This project follows the **Ports and Adapters (Hexagonal Architecture)** pattern.
- `src/core/domain`: Pure business logic and geometry algorithms.
- `src/core/ports`: Contract interfaces for external dependencies.
- `src/infrastructure/adapters`: Physical implementations of ports (Clerk, Three.js loaders, etc.).
- `src/components`: UI Layer components.

For more details, see [docs/architecture.md](docs/architecture.md).
