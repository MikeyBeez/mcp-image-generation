const { spawn } = require('child_process');

// Start the MCP server
const server = spawn('node', ['src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseData = '';

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

// Send tools list request
const toolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list'
};

server.stdout.on('data', (data) => {
  responseData += data.toString();
  
  // Look for complete JSON responses
  const lines = responseData.split('\n');
  lines.forEach(line => {
    if (line.trim() && line.startsWith('{')) {
      try {
        const response = JSON.parse(line.trim());
        if (response.id === 1) {
          console.log('✅ Server initialized successfully');
          // Send tools request
          server.stdin.write(JSON.stringify(toolsRequest) + '\n');
        } else if (response.id === 2) {
          console.log('✅ Tools retrieved successfully');
          console.log(`📦 Available tools: ${response.result?.tools?.length || 0}`);
          response.result?.tools?.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description}`);
          });
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not valid JSON yet
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.log('📊 Server:', data.toString().trim());
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Send initialization request
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  server.kill();
  process.exit(1);
}, 10000);
