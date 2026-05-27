import { Injectable, Logger, OnApplicationShutdown, } from "@nestjs/common";
import { ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import * as readline from "readline";

type McpServerStatus = "starting" | "running" | "stopped" | "error";

interface RunningMcpServer {
    key: string;
    command: string;
    args: string[];
    process: ChildProcess;
    startedAt: Date;
    status: McpServerStatus;
    tools: string[];

    stdoutBuffer: string[];
    stderrBuffer: string[];
}

@Injectable()
export class McpService implements OnApplicationShutdown {
    private readonly logger = new Logger(McpService.name);

    private readonly servers = new Map<string, RunningMcpServer>();

    constructor() {
        // this.updateMcpConfiguration({});

        // setTimeout(() => this.queryTools('filesystem').then(console.log), 3000);
    }

    async updateMcpConfiguration(mcpConfig: any) {
        // TODO:
        // - diff existing config
        // - start missing MCPs
        // - stop removed MCPs
        // - restart changed MCPs

        const serverId = await this.startMcpServer('filesystem', "npx", [
            "-y",
            "mcp-server-filesystem",
            ".",
        ]);

        return {
            started: serverId,
        };
    }

    private async startMcpServer(key: string, command: string, args: string[]) {
        this.logger.log(`Starting MCP server: ${command} ${args.join(" ")}`);

        const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            shell: process.platform === "win32",
            env: process.env,
        });

        const server: RunningMcpServer = { 
            key,
            command,
            args,
            process: child,
            startedAt: new Date(),
            status: "starting",
            tools: [],
            stdoutBuffer: [],
            stderrBuffer: [],
        };

        this.servers.set(key, server);

        //
        // STDOUT handling
        //
        const stdoutRl = readline.createInterface({ input: child.stdout!, });

        stdoutRl.on("line", (line) => {
            server.stdoutBuffer.push(line);

            this.logger.debug(`[MCP:${key}] ${line}`);

            this.handleServerMessage(server, line);
        });

        //
        // STDERR handling
        //
        const stderrRl = readline.createInterface({
            input: child.stderr!,
        });

        stderrRl.on("line", (line) => {
            server.stderrBuffer.push(line);

            this.logger.debug(`[MCP:${key}] ${line}`);
        });

        //
        // Lifecycle events
        //
        child.on("spawn", () => {
            server.status = "running";

            this.logger.log(`MCP server started: ${key}`);
        });

        child.on("exit", (code, signal) => {
            server.status = "stopped";

            this.logger.warn(`MCP server exited: ${key} (code=${code}, signal=${signal})`);

            // this.servers.delete(key);
        });

        child.on("error", (err) => {
            server.status = "error";

            this.logger.error(`MCP server error: ${key}`, err.stack);
        });

        return key;
    }

    async stopMcpServer(key: string) {
        const server = this.servers.get(key);

        if (!server) {
            return false;
        }

        this.logger.log(`Stopping MCP server: ${key}`);

        server.process.kill("SIGTERM");

        //
        // force kill after timeout
        //
        setTimeout(() => {
            if (!server.process.killed) {
                this.logger.warn(`Force killing MCP server: ${key}`);

                server.process.kill("SIGKILL");
            }
        }, 5000);

        return true;
    }

    async restartMcpServer(key: string) {
        const server = this.servers.get(key);

        if (!server) {
            return null;
        }

        const { command, args } = server;

        await this.stopMcpServer(key);

        return this.startMcpServer(key, command, args);
    }

    listRunningServers() {
        return Array.from(this.servers.values()).map((server) => ({
            key: server.key,
            command: server.command,
            args: server.args,
            startedAt: server.startedAt,
            status: server.status,
            tools: server.tools,
        }));
    }

    getServer(id: string) {
        return this.servers.get(id);
    }

    private handleServerMessage(server: RunningMcpServer, line: string) {
        try {
            const message = JSON.parse(line);

            //
            // Example:
            // detect tools/list response
            //
            if (message?.result?.tools && Array.isArray(message.result.tools)) {
                server.tools = message.result.tools.map(
                    (tool: any) => tool.name,
                );

                this.logger.log(
                    `MCP ${server.key} tools loaded: ${server.tools.join(", ")}`,
                );
            }
        } catch {
            //
            // Ignore non-JSON output
            //
        }
    }

    async sendMessage(key: string, message: unknown) {
        const server = this.servers.get(key);

        if (!server) {
            throw new Error(`MCP server not found: ${key}`);
        }

        server.process.stdin?.write(
            JSON.stringify(message) + "\n",
        );
    }

    async queryTools(key: string) {
        await this.sendMessage(key, {
            jsonrpc: "2.0",
            id: randomUUID(),
            method: "tools/list",
            params: {},
        });
    }

    async onApplicationShutdown() {
        this.logger.log("Stopping MCP servers...");

        await Promise.all(
            Array.from(this.servers.keys()).map((key) =>
                this.stopMcpServer(key),
            ),
        );
    }
}