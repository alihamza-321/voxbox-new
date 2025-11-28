#!/bin/bash
# Bash script to create .env file for VoxBox Frontend

ENV_CONTENT="# API Configuration
# Backend API URL - default is http://localhost:3000/api/v1
VITE_API_URL=http://localhost:3000/api/v1"

ENV_PATH=".env"

if [ -f "$ENV_PATH" ]; then
    echo "⚠️  .env file already exists at: $ENV_PATH"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

echo "$ENV_CONTENT" > "$ENV_PATH"
echo "✅ .env file created successfully at: $ENV_PATH"
echo "📝 Content:"
cat "$ENV_PATH"
echo ""
echo "🎉 You can now start the development server with: npm run dev"

