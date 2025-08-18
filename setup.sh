#!/bin/bash

# Blockza Directory MCP Server Setup Script

set -e

echo "🚀 Setting up Blockza Directory MCP Server..."

# Check Node.js version
echo "📋 Checking Node.js version..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

# Detect operating system and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
else
    # Linux or other
    CONFIG_PATH="$HOME/.config/claude/claude_desktop_config.json"
fi

echo "🔧 Claude Desktop configuration path: $CONFIG_PATH"

# Get absolute path to the project
PROJECT_PATH=$(pwd)
BUILD_PATH="$PROJECT_PATH/build/index.js"

echo "📍 Project path: $PROJECT_PATH"
echo "📍 Build path: $BUILD_PATH"

# Check if build was successful
if [ ! -f "$BUILD_PATH" ]; then
    echo "❌ Error: Build failed. $BUILD_PATH not found."
    exit 1
fi

# Create Claude config directory if it doesn't exist
mkdir -p "$(dirname "$CONFIG_PATH")"

# Check if Claude config exists
if [ -f "$CONFIG_PATH" ]; then
    echo "📁 Found existing Claude Desktop config"
    # Backup existing config
    cp "$CONFIG_PATH" "$CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backed up existing config"
    
    # Check if our server is already configured
    if grep -q "blockza-directory" "$CONFIG_PATH"; then
        echo "⚠️  Blockza Directory server is already configured in Claude Desktop"
        echo "   You may need to manually update the path in: $CONFIG_PATH"
        echo "   Current build path: $BUILD_PATH"
    else
        echo "➕ Adding Blockza Directory server to existing config..."
        # Use jq to add our server to existing config if jq is available
        if command -v jq &> /dev/null; then
            tmp_file=$(mktemp)
            jq --arg path "$BUILD_PATH" '.mcpServers."blockza-directory" = {
                "command": "node",
                "args": [$path],
                "env": {
                    "NODE_ENV": "production"
                }
            }' "$CONFIG_PATH" > "$tmp_file" && mv "$tmp_file" "$CONFIG_PATH"
            echo "✅ Successfully added server to Claude Desktop config"
        else
            echo "⚠️  jq not found. Please manually add the following to your Claude Desktop config:"
            echo ""
            echo "Add this to the mcpServers section in $CONFIG_PATH:"
            echo "{
  \"blockza-directory\": {
    \"command\": \"node\",
    \"args\": [\"$BUILD_PATH\"],
    \"env\": {
      \"NODE_ENV\": \"production\"
    }
  }
}"
        fi
    fi
else
    echo "📝 Creating new Claude Desktop config..."
    cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "blockza-directory": {
      "command": "node",
      "args": ["$BUILD_PATH"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
    echo "✅ Created Claude Desktop config"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart Claude Desktop to load the new server"
echo "2. In Claude Desktop, you should now see 'blockza-directory' as an available server"
echo "3. Test the server by asking: 'Search for crypto companies in the Blockza directory'"
echo ""
echo "📁 Configuration file: $CONFIG_PATH"
echo "🏗️  Server build path: $BUILD_PATH"
echo ""
echo "🔧 To test the server manually:"
echo "   npx @modelcontextprotocol/inspector node build/index.js"
echo ""
echo "🐛 For debugging, check the build with:"
echo "   npm run dev"