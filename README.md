# MCP Image Generation Server 🎨

A Model Context Protocol (MCP) server that provides AI image generation capabilities through multiple backends: DALL-E 3, Stability AI, and local Automatic1111.

## ✨ Features

- **Multiple Backends**: Support for DALL-E 3, Stability AI SDXL, and Automatic1111
- **Auto-Selection**: Automatically chooses the best available backend
- **Cost Estimation**: Built-in cost calculation for API services
- **Local Generation**: Free image generation with Automatic1111
- **MCP Integration**: Works seamlessly with Claude and other MCP clients

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MCP-compatible client (Claude Desktop, etc.)
- API keys for external services (optional)

### Installation

```bash
git clone <repository-url>
cd mcp-image-generation
npm install
```

### Configuration

Set environment variables for the backends you want to use:

```bash
# For DALL-E 3 (OpenAI)
export OPENAI_API_KEY="your-openai-api-key"

# For Stability AI
export STABILITY_API_KEY="your-stability-api-key"

# For Automatic1111 (local)
# No API key needed - just run Automatic1111 on http://127.0.0.1:7860
```

### Usage

#### As MCP Server

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "image-generation": {
      "command": "node",
      "args": ["/path/to/mcp-image-generation/src/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key",
        "STABILITY_API_KEY": "your-api-key"
      }
    }
  }
}
```

#### Standalone

```bash
node src/index.js
```

## 🛠️ Available Tools

### `generate_image`

Generate an image using AI.

**Parameters:**
- `prompt` (required): Text description of the image
- `backend` (optional): Choose 'dall-e', 'stability-ai', 'automatic1111', or 'auto'
- `width/height` (optional): Image dimensions (default: 1024x1024)
- `quality` (optional): 'standard' or 'hd' for DALL-E
- `steps` (optional): Generation steps for Stability AI/Automatic1111

**Example:**
```javascript
{
  "prompt": "A beautiful sunset over mountains, digital art",
  "backend": "auto",
  "width": 1024,
  "height": 1024
}
```

### `list_backends`

Check which image generation backends are available and their status.

### `estimate_cost`

Calculate the cost for generating images with different backends.

## 💰 Cost Comparison

| Backend | Cost per Image | Quality | Speed | Setup |
|---------|---------------|---------|-------|-------|
| DALL-E 3 | $0.04-$0.08 | Excellent | Fast | API Key |
| Stability AI | $0.02 | Very Good | Medium | API Key |
| Automatic1111 | Free | Good* | Slow | Local Install |

*Quality depends on the model used

## 🔧 Backend Setup

### DALL-E 3 (OpenAI)

1. Get API key from [OpenAI](https://platform.openai.com)
2. Set `OPENAI_API_KEY` environment variable

### Stability AI

1. Get API key from [Stability AI](https://platform.stability.ai)
2. Set `STABILITY_API_KEY` environment variable

### Automatic1111

1. Install [Automatic1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
2. Start with API enabled: `./webui.sh --api --listen`
3. Server will auto-detect if running on http://127.0.0.1:7860

## 🎨 Example Prompts

- `"A serene lake at dawn with mountains in the background, photorealistic"`
- `"Cyberpunk city street at night, neon lights, digital art"`
- `"Cute cartoon cat wearing a wizard hat, studio ghibli style"`
- `"Abstract geometric patterns in blue and gold, minimalist"`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Stability AI API Documentation](https://platform.stability.ai/docs)
- [Automatic1111 Documentation](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
