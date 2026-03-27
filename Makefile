.PHONY: help install dev build preview check clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make install  - Install dependencies"
	@echo "  make dev      - Start development server (http://localhost:4321)"
	@echo "  make build    - Build for production"
	@echo "  make preview  - Preview production build locally"
	@echo "  make check    - Run TypeScript type checking"
	@echo "  make clean    - Remove build artifacts"

# Install dependencies
install:
	npm install

# Start development server
dev:
	npm run dev

# Build for production
build:
	npm run build

# Preview production build
preview:
	npm run preview

# TypeScript type checking
check:
	npm run check

# Clean build artifacts
clean:
	rm -rf dist/ .astro/
	@echo "Build artifacts cleaned"
