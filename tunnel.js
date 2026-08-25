const { spawn } = require("child_process");

function startTunnel() {
  console.log("Starting localtunnel for port 5000 with subdomain youtube-api-backend-v2...");
  const lt = spawn("npx", ["localtunnel", "--port", "5000", "--subdomain", "youtube-api-backend-v2"], {
    shell: true,
  });

  lt.stdout.on("data", (data) => {
    const output = data.toString().trim();
    console.log(`[localtunnel] stdout: ${output}`);
  });

  lt.stderr.on("data", (data) => {
    console.error(`[localtunnel] stderr: ${data.toString().trim()}`);
  });

  lt.on("close", (code) => {
    console.log(`localtunnel process exited with code ${code}. Restarting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
