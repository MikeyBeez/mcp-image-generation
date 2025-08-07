// Basic test to ensure the server structure is correct
const { spawn } = require('child_process');
const { join } = require('path');

describe('MCP Image Generation Server', () => {
  test('server starts without errors', (done) => {
    const serverPath = join(__dirname, '../src/index.js');
    const server = spawn('node', [serverPath]);
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('MCP Image Generation Server running')) {
        server.kill();
        done();
      }
    });
    
    server.on('error', (error) => {
      server.kill();
      done(error);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      server.kill();
      done(new Error('Server startup timeout'));
    }, 5000);
  });
});
