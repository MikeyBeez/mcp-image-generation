#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const server = new Server(
  {
    name: 'mcp-image-generation',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * DALL-E API Integration
 */
async function generateWithDALLE(prompt, options = {}) {
  const { size = '1024x1024', quality = 'standard', style = 'vivid' } = options;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for DALL-E generation');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      size: size,
      quality: quality,
      style: style,
      n: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`DALL-E API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    url: data.data[0].url,
    revised_prompt: data.data[0].revised_prompt,
    cost: quality === 'hd' ? 0.08 : 0.04, // Approximate cost in USD
    backend: 'dall-e-3'
  };
}

/**
 * Stability AI API Integration
 */
async function generateWithStabilityAI(prompt, options = {}) {
  const { width = 1024, height = 1024, steps = 30 } = options;
  
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error('STABILITY_API_KEY environment variable is required for Stability AI generation');
  }

  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt }],
      cfg_scale: 7,
      height: height,
      width: width,
      steps: steps,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stability AI error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  const imageBase64 = data.artifacts[0].base64;
  
  return {
    base64: imageBase64,
    cost: 0.02, // Approximate cost per image
    backend: 'stability-ai-sdxl'
  };
}

/**
 * Local Automatic1111 Integration
 */
async function generateWithAutomatic1111(prompt, options = {}) {
  const { 
    width = 768, 
    height = 768, 
    steps = 50, 
    cfg_scale = 12,
    sampler_name = 'DPM++ 2M Karras',
    host = 'http://127.0.0.1:7860'
  } = options;

  try {
    const response = await fetch(`${host}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: 'blurry, low quality, distorted, ugly, bad anatomy',
        width: width,
        height: height,
        steps: steps,
        cfg_scale: cfg_scale,
        sampler_name: sampler_name,
        batch_size: 1,
        n_iter: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Automatic1111 API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      base64: data.images[0],
      cost: 0, // Local generation is free
      backend: 'automatic1111',
      info: data.info
    };
  } catch (error) {
    throw new Error(`Failed to connect to Automatic1111 at ${host}: ${error.message}`);
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_image',
        description: 'Generate an image using AI. Supports multiple backends: DALL-E 3, Stability AI, or local Automatic1111',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Text description of the image to generate',
            },
            backend: {
              type: 'string',
              enum: ['dall-e', 'stability-ai', 'automatic1111', 'auto'],
              default: 'auto',
              description: 'Which backend to use. "auto" tries DALL-E first, then Stability AI, then Automatic1111',
            },
            width: {
              type: 'number',
              description: 'Image width (ignored for DALL-E which uses size parameter)',
              default: 1024,
            },
            height: {
              type: 'number', 
              description: 'Image height (ignored for DALL-E which uses size parameter)',
              default: 1024,
            },
            quality: {
              type: 'string',
              enum: ['standard', 'hd'],
              default: 'standard',
              description: 'Quality setting (DALL-E only)',
            },
            steps: {
              type: 'number',
              description: 'Number of generation steps (Stability AI and Automatic1111 only)',
              default: 30,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'list_backends',
        description: 'List available image generation backends and their status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'estimate_cost',
        description: 'Estimate the cost for generating an image with different backends',
        inputSchema: {
          type: 'object',
          properties: {
            backend: {
              type: 'string',
              enum: ['dall-e', 'stability-ai', 'automatic1111'],
              description: 'Backend to estimate cost for',
            },
            quality: {
              type: 'string',
              enum: ['standard', 'hd'],
              default: 'standard',
              description: 'Quality setting (DALL-E only)',
            },
          },
          required: ['backend'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'generate_image': {
        const { prompt, backend = 'auto', width = 1024, height = 1024, quality = 'standard', steps = 30 } = args;
        
        let result;
        let backendUsed = backend;

        if (backend === 'auto') {
          // Try backends in order of preference
          try {
            if (process.env.OPENAI_API_KEY) {
              result = await generateWithDALLE(prompt, { quality });
              backendUsed = 'dall-e';
            } else if (process.env.STABILITY_API_KEY) {
              result = await generateWithStabilityAI(prompt, { width, height, steps });
              backendUsed = 'stability-ai';
            } else {
              result = await generateWithAutomatic1111(prompt, { width, height, steps });
              backendUsed = 'automatic1111';
            }
          } catch (error) {
            // If first choice fails, try the next
            try {
              if (backendUsed !== 'stability-ai' && process.env.STABILITY_API_KEY) {
                result = await generateWithStabilityAI(prompt, { width, height, steps });
                backendUsed = 'stability-ai';
              } else {
                result = await generateWithAutomatic1111(prompt, { width, height, steps });
                backendUsed = 'automatic1111';
              }
            } catch (fallbackError) {
              throw new Error(`All backends failed. Last error: ${fallbackError.message}`);
            }
          }
        } else {
          // Use specific backend
          switch (backend) {
            case 'dall-e':
              result = await generateWithDALLE(prompt, { quality });
              break;
            case 'stability-ai':
              result = await generateWithStabilityAI(prompt, { width, height, steps });
              break;
            case 'automatic1111':
              result = await generateWithAutomatic1111(prompt, { width, height, steps });
              break;
            default:
              throw new Error(`Unknown backend: ${backend}`);
          }
        }

        let text = `🎨 **Image Generated Successfully!**\n\n`;
        text += `**Prompt:** ${prompt}\n`;
        text += `**Backend:** ${result.backend}\n`;
        text += `**Cost:** $${result.cost.toFixed(3)}\n\n`;

        if (result.revised_prompt) {
          text += `**Revised Prompt:** ${result.revised_prompt}\n\n`;
        }

        if (result.url) {
          text += `**Image URL:** ${result.url}\n`;
        } else if (result.base64) {
          text += `**Image:** Generated successfully (base64 data available)\n`;
          text += `**Size:** ${result.base64.length} characters\n`;
        }

        text += `\n💡 **Tip:** Save the image from the URL or decode the base64 data to view it.`;

        return {
          content: [
            {
              type: 'text',
              text: text,
            },
          ],
        };
      }

      case 'list_backends': {
        let text = `🔧 **Available Image Generation Backends**\n\n`;

        // Check DALL-E
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        text += `**DALL-E 3** ${hasOpenAI ? '✅' : '❌'}\n`;
        text += `   Status: ${hasOpenAI ? 'Ready' : 'Missing OPENAI_API_KEY'}\n`;
        text += `   Quality: Excellent\n`;
        text += `   Cost: $0.04-$0.08 per image\n`;
        text += `   Speed: Fast\n\n`;

        // Check Stability AI
        const hasStability = !!process.env.STABILITY_API_KEY;
        text += `**Stability AI SDXL** ${hasStability ? '✅' : '❌'}\n`;
        text += `   Status: ${hasStability ? 'Ready' : 'Missing STABILITY_API_KEY'}\n`;
        text += `   Quality: Very Good\n`;
        text += `   Cost: $0.02 per image\n`;
        text += `   Speed: Medium\n\n`;

        // Check Automatic1111
        let a1111Status = '❌';
        try {
          const response = await fetch('http://127.0.0.1:7860/sdapi/v1/progress', { 
            method: 'GET',
            signal: AbortSignal.timeout(2000) 
          });
          if (response.ok) a1111Status = '✅';
        } catch (error) {
          // Automatic1111 not running
        }

        text += `**Automatic1111** ${a1111Status}\n`;
        text += `   Status: ${a1111Status === '✅' ? 'Running on http://127.0.0.1:7860' : 'Not running locally'}\n`;
        text += `   Quality: Good (depends on model)\n`;
        text += `   Cost: Free (local)\n`;
        text += `   Speed: Slow-Medium\n\n`;

        text += `💡 **Setup Instructions:**\n`;
        if (!hasOpenAI) text += `   - Set OPENAI_API_KEY for DALL-E\n`;
        if (!hasStability) text += `   - Set STABILITY_API_KEY for Stability AI\n`;
        if (a1111Status === '❌') text += `   - Start Automatic1111 server for local generation\n`;

        return {
          content: [
            {
              type: 'text',
              text: text,
            },
          ],
        };
      }

      case 'estimate_cost': {
        const { backend, quality = 'standard' } = args;
        
        let cost, description;
        
        switch (backend) {
          case 'dall-e':
            cost = quality === 'hd' ? 0.08 : 0.04;
            description = `DALL-E 3 ${quality} quality`;
            break;
          case 'stability-ai':
            cost = 0.02;
            description = 'Stability AI SDXL';
            break;
          case 'automatic1111':
            cost = 0;
            description = 'Automatic1111 (local, free)';
            break;
          default:
            throw new Error(`Unknown backend: ${backend}`);
        }

        const text = `💰 **Cost Estimate**\n\n` +
                    `**Backend:** ${description}\n` +
                    `**Cost per image:** $${cost.toFixed(3)}\n` +
                    `**Cost for 10 images:** $${(cost * 10).toFixed(2)}\n` +
                    `**Cost for 100 images:** $${(cost * 100).toFixed(2)}\n\n` +
                    `💡 **Note:** Costs are approximate and may vary.`;

        return {
          content: [
            {
              type: 'text',
              text: text,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ **Error:** ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('🎨 MCP Image Generation Server running');
console.error('🔧 Backends: DALL-E 3, Stability AI, Automatic1111');
console.error('💡 Set OPENAI_API_KEY and/or STABILITY_API_KEY environment variables for API access');
