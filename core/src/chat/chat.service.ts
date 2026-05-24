import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { WindowStateEntity } from "./entities/window-state.entity";
import { ChatMessageEntity } from "./entities/chat-message.entity";
import { ChatConfigEntity } from "./entities/chat-config.entity";
import { Repository } from "typeorm";
import { DatabaseService } from "../state/database.service";
import * as keytar from 'keytar';

export type Client = {
    send: (s: string) => void;
}

const PROVIDER_CONFIGS: Record<string, { endpoint: string; apiKeyHeader: string; defaultModel: string }> = {
    openrouter: { endpoint: 'https://openrouter.ai/api/v1/chat/completions',                              apiKeyHeader: 'Authorization', defaultModel: 'openai/gpt-4.1' },
    openai:     { endpoint: 'https://api.openai.com/v1/chat/completions',                                 apiKeyHeader: 'Authorization', defaultModel: 'gpt-4.1' },
    anthropic:  { endpoint: 'https://api.anthropic.com/v1/messages',                                      apiKeyHeader: 'x-api-key',     defaultModel: 'claude-opus-4-6' },
    google:     { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',   apiKeyHeader: 'Authorization', defaultModel: 'gemini-2.5-flash' },
};

const openHtmlViewTool = {
    type: "function",
    function: {
        name: "attach_artifact",
        description: "Attach a structured view using HTML content.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "The title for the window being shown. This should be short text, 2-4 words. I.e. 'CRM Contacts' or 'Edit Jim Monroe', etc."
                },
                windowId: {
                    type: "number",
                    description: "The window ID to display the content from the existing open windows, or 0 to create a new window.",
                },
                content: {
                    type: "string",
                    description: "The HTML content for the view to be shown. Should be a <div> tag. Use tailwindcss for styling. The background is already set to gray-100 and padding is applied in the parent. You don't need to set this for the content. Do not wrap in `. Call global js function doAction() with parameters describing what should be done to perform actions in handlers (buttons, etc). Do not add <script> tags just call doAction in a click handler etc. Do not enter dynamic content in the doAction params they are fetched for you just describe the action taken."
                },
            },
            required: ["content"]
        }
    }
};

const queryDatabase = {
    type: "function",
    function: {
        name: "query_db",
        description: "Run a query on the sqlite DB.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The sqlite query to run on the db. Could be to list all tables, get their schema, etc. Any SQLite query."
                },
            },
            required: ["query"]
        }
    }
};

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(ChatConfigEntity) private readonly chatConfigRepo: Repository<ChatConfigEntity>,
        @InjectRepository(ChatMessageEntity) private readonly chatHistoryRepo: Repository<ChatMessageEntity>,
        @InjectRepository(WindowStateEntity) private readonly windowStateRepo: Repository<WindowStateEntity>,
        private databaseService: DatabaseService,
    ) {
    }

    private clients: Client[] = [];
    private conversationId = 'jmcuc';
    private currentProvider = 'openrouter';
    private currentModel = 'openai/gpt-5.4-nano'; // legacy fallback

    private prompts = {
        chatPrompt: `You are role-playing as an operating system. The user will ask you to do stuff as a computer.
        For example, if the user requests to add a user to its contact list, you might show (using the tool) a contact card from a CRM system that\'s
        editable with the content he already provided. Use the content tool to show HTML do not output it directly. The html you display with the
        content tool can be interactive to allow the user shortcuts to perform actions on entities listed etc. Don't ask questions unless you really
        need to. Go with the flow, especially creating UIs using the tool and if needed the user will correct it to what they want. Only show data from
        the database. If you show sample data, be sure to add it to the db first (including creating tables if needed). If you don't store the sample
        data in the DB it won't persist and the experience will be confusing.`,
        uiActionPrompt: `The user has performed an action using doAction() with the following args. You'll need to decide what to do. Most likely you'll update the
            currently active window but not necessarily. The active window has ID %ACTIVEWINDOWID% and its current HTML content is %WINDOWCONTENT%. The user performed an action with
            payload %DATAPAYLOAD%. The current form inputs for the window (their current state is): %FORMINPUTS%. Always ground your answers in real data from the database. If a table doesn't exist you may need to create it.`
    }

    async handleConnection(client: Client) {
        console.log('client connected');

        const existingConfig = await this.chatConfigRepo.findOne({
            where: {
                id: 0,
            }
        });

        if (!existingConfig) {
            client.send(JSON.stringify({ event: 'showConfig', data: {} }));
        } else {
            this.currentProvider = existingConfig.provider;
            this.currentModel = existingConfig.model || PROVIDER_CONFIGS[existingConfig.provider]?.defaultModel || 'openai/gpt-5.4-nano';
            this.initializeState(client);
        }

        return;
    }

    handleDisconnect(client: Client) {
        this.clients = this.clients.filter(c => c !== client);
    }

    async handleMessage(client: Client, message: { event: string, data: any, }) {
        switch (message.event) {
            case 'config':
                await this.handleConfig(client, message.data);
                break;
            case 'doAction':
                await this.handleDoAction(message.data);
                break;
            case 'chat':
                await this.handleChat(message.data);
                break;
            case 'close':
                await this.handleClose(message.data);
                break;
            case 'resetData':
                await this.handleResetData();
                break;
            default:
                console.log('unknown message ', message.event, message.data);
                break;
        }
    }

    async initializeState(client: Client) {
        const prompts = await this.getPrompts();
        client.send(JSON.stringify({ event: 'settings', data: { prompts, } }));

        const history = await this.getChatHistory();
        for (let item of history) {
            client.send(JSON.stringify({ event: 'message', data: { content: item.content, from: item.user === null ? 'James' : item.user, } }));
        }

        let windows = await this.windowStateRepo.find({
            where: { conversationId: this.conversationId, },
        });

        for (let window of windows) {
            client.send(JSON.stringify({ event: 'ui', data: { id: window.id, content: window.content, title: window.title, } }));
        }

        this.clients.push(client);
    }

    async handleConfig(client: Client, data: any) {
        if (data.apiKey) {
            await keytar.setPassword('openall', data.provider, data.apiKey);
        }
        this.currentProvider = data.provider;
        this.currentModel = data.model || PROVIDER_CONFIGS[data.provider]?.defaultModel;

        const existingConfig = await this.chatConfigRepo.findOne({ where: { id: 0, }, });
        if (existingConfig) {
            existingConfig.provider = data.provider;
            existingConfig.model = data.model;
            await this.chatConfigRepo.save(existingConfig);
        } else {
            const newConfig = this.chatConfigRepo.create({ id: 0, provider: data.provider, model: data.model, });
            await this.chatConfigRepo.save(newConfig);
        }
        if (!this.clients.includes(client)) {
            await this.initializeState(client);
        }
    }

    getDoActionPrompt(activeWindowId: number, windowContent: string, dataArgsJson: string, dataInputJson: string) {
        let prompt = this.prompts.uiActionPrompt;

        prompt = prompt.replace(/\%ACTIVEWINDOWID\%/g, activeWindowId.toString());
        prompt = prompt.replace(/\%WINDOWCONTENT\%/g, windowContent);
        prompt = prompt.replace(/\%DATAPAYLOAD\%/g, dataArgsJson);
        prompt = prompt.replace(/\%FORMINPUTS\%/g, dataInputJson);

        return prompt;
    }

    async handleResetData() {
        await this.chatHistoryRepo.deleteAll();
        await this.windowStateRepo.deleteAll();

        await this.databaseService.dropDb();

        this.clients.forEach(c => c.send(JSON.stringify({ event: 'refresh', data: {} })));
    }

    async handleDoAction(data: { activeWindowId: number, inputs: { [key: string]: string }, args: any[], }) {
        console.log(data);
        const windowContent = await this.getWindowContent(data.activeWindowId);

        console.log(windowContent?.length);

        const history = await this.getChatHistory();

        let messages = history.map(h => ({ role: h.user ? 'user' : 'assistant', content: h.content, }));

        const uiActionPrompt = this.getDoActionPrompt(data.activeWindowId, windowContent || '<empty />', JSON.stringify(data.args), JSON.stringify(data.inputs));
        messages.push({
            role: 'user', content: uiActionPrompt,
        })

        let hadContentUpdate = false;

        for (let i = 0; i < 10; ++i) {
            const response = await this.runAi(messages);

            if (response && response.tools) {
                console.log('tool call', response.tools);
                for (let toolResponse of response.tools) {
                    if (toolResponse.attachment) {
                        hadContentUpdate = true;
                    }
                    await this.handleToolCall(toolResponse, messages, this.clients);
                }
            } else {
                if (!hadContentUpdate) {
                    messages.push({
                        role: 'user', content: 'The user has performed a click but window content was not updated. Ensure you send a tool call to update the window contents following the action the user performed.',
                    });

                    continue;
                }

                const responseItem = { content: response!.content, from: 'James' };
                const agentMessage = this.chatHistoryRepo.create({ content: responseItem.content, user: undefined, conversationId: this.conversationId, });
                await this.chatHistoryRepo.save(agentMessage);
                this.clients.forEach(c => c.send(JSON.stringify({ event: 'message', data: responseItem })));

                console.log(response!.content);
                break;
            }
        }
    }

    async handleChat(data: string) {
        console.log(data);

        const userMessage = this.chatHistoryRepo.create({ content: data, conversationId: this.conversationId, user: 'You', });
        await this.chatHistoryRepo.save(userMessage);
        this.clients.forEach(c => c.send(JSON.stringify({ event: 'message', data: { content: data, from: 'You' } })));
        this.clients.forEach(c => c.send(JSON.stringify({ event: 'typing', data: ['James'], })));

        const history = await this.getChatHistory();

        let messages = history.map(h => ({ role: h.user ? 'user' : 'assistant', content: h.content, }));

        try {
            for (let i = 0; i < 10; ++i) {
                const response = await this.runAi(messages);

                if (response && response.tools) {
                    for (let toolResponse of response.tools) {
                        await this.handleToolCall(toolResponse, messages, this.clients);
                    }
                } else {
                    const responseItem = { content: response!.content, from: 'James' };
                    history.push(this.chatHistoryRepo.create({ content: responseItem.content, user: undefined, }));
                    const agentMessage = this.chatHistoryRepo.create({ content: responseItem.content, user: undefined, conversationId: this.conversationId, });
                    await this.chatHistoryRepo.save(agentMessage);
                    this.clients.forEach(c => c.send(JSON.stringify({ event: 'message', data: responseItem })));

                    break;
                }
            }
        } catch (e: any) {
            console.error('handleChat error:', e);
            this.clients.forEach(c => c.send(JSON.stringify({ event: 'message', data: { content: `⚠️ Error: ${e.message}`, from: 'System' } })));
        }
    }

    async handleClose(data: number) {
        console.log('close', data);

        const existingWindow = await this.windowStateRepo.findOneBy({ id: data, });
        if (existingWindow) {
            await this.windowStateRepo.remove(existingWindow);
            this.clients.forEach(c => c.send(JSON.stringify({ event: 'closeWindow', data: { id: data, } })));
        }
    }

    async getPrompts() {
        return this.prompts;
    }

    async loadApiKey() {
        return process.env.OPENROUTER_API_KEY || await keytar.getPassword('openall', this.currentProvider) || '';
    }

    async runAi(messages: any[]) {
        if (this.currentProvider === 'anthropic') {
            return this.runAiAnthropic(messages);
        }

        const config = PROVIDER_CONFIGS[this.currentProvider] || PROVIDER_CONFIGS['openrouter'];
        const model = this.currentModel || config.defaultModel;
        const apiKey = await this.loadApiKey();
        const activeWindows = await this.getWindowsSummary();

        const authValue = `Bearer ${apiKey}`;

        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                [config.apiKeyHeader]: authValue,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: this.prompts.chatPrompt, },
                    {
                        role: "system", content: 'currently open windows: ' + JSON.stringify(activeWindows.map(w => ({ id: w.id, title: w.title, })))
                    },
                    ...messages,
                ],
                tools: [
                    openHtmlViewTool,
                    queryDatabase,
                ],
                tool_choice: "auto"
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Request failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log(data)
        const message = data.choices[0].message;
        messages.push(message);
        if (data.choices[0].finish_reason === 'stop') {
            console.log(message);
            return { content: message.content, };
        } else if (data.choices[0].finish_reason === 'tool_calls') {
            console.log(message.tool_calls);

            const toolResults: any[] = [];

            for (let toolCall of message.tool_calls) {

                if (toolCall.function.name === openHtmlViewTool.function.name) {
                    const attachmentJSON = toolCall.function.arguments;
                    const attachment = JSON.parse(attachmentJSON);
                    toolResults.push({ attachment: `\`${attachment.content}\``, title: attachment.title, windowId: attachment.windowId, callId: toolCall.id });
                }

                if (toolCall.function.name === queryDatabase.function.name) {
                    const parametersJSON = toolCall.function.arguments;
                    const parameters = JSON.parse(parametersJSON);
                    toolResults.push({ query: parameters.query, callId: toolCall.id });
                }
            }

            return { tools: toolResults };
        }
    }

    private async runAiAnthropic(messages: any[]) {
        const activeWindows = await this.getWindowsSummary();
        const apiKey = await this.loadApiKey();

        const systemContent = [
            this.prompts.chatPrompt,
            'currently open windows: ' + JSON.stringify(activeWindows.map(w => ({ id: w.id, title: w.title, }))),
        ].join('\n\n');

        const anthropicMessages = this.convertToAnthropicMessages(messages);

        const requestBody = {
            model: this.currentModel,
            max_tokens: 8096,
            system: systemContent,
            messages: anthropicMessages,
            tools: this.convertToolsForAnthropic([openHtmlViewTool, queryDatabase]),
            tool_choice: { type: 'auto' },
        };
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const text = await response.text();
            let detail = text;
            try { detail = JSON.parse(text)?.error?.message ?? text; } catch {}
            throw new Error(`Anthropic ${response.status}: ${detail}`);
        }

        const data = await response.json();
        console.log(data);

        const contentBlocks: any[] = data.content || [];
        const textBlock = contentBlocks.find((b: any) => b.type === 'text');
        const toolUseBlocks = contentBlocks.filter((b: any) => b.type === 'tool_use');

        if (data.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
            messages.push({ role: 'assistant', content: textBlock?.text || '' });
            return { content: textBlock?.text || '' };
        }

        // Push to messages in OpenAI-like format so handleToolCall works unchanged
        const tool_calls = toolUseBlocks.map((b: any) => ({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input) },
        }));
        messages.push({ role: 'assistant', content: textBlock?.text || null, tool_calls });

        const toolResults: any[] = [];
        for (const b of toolUseBlocks) {
            if (b.name === openHtmlViewTool.function.name) {
                toolResults.push({ attachment: `\`${b.input.content}\``, title: b.input.title, windowId: b.input.windowId, callId: b.id });
            }
            if (b.name === queryDatabase.function.name) {
                toolResults.push({ query: b.input.query, callId: b.id });
            }
        }

        return { tools: toolResults };
    }

    private convertToAnthropicMessages(messages: any[]): any[] {
        const result: any[] = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];

            // Skip system messages — handled via top-level system field
            if (msg.role === 'system') continue;

            // Group consecutive tool messages into a single user message with tool_result blocks
            if (msg.role === 'tool') {
                const toolResults: any[] = [];
                while (i < messages.length && messages[i].role === 'tool') {
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: messages[i].tool_call_id,
                        content: messages[i].content || '(no output)',
                    });
                    i++;
                }
                i--; // compensate for the outer loop increment
                result.push({ role: 'user', content: toolResults });
                continue;
            }

            // Assistant message that made tool calls — convert to Anthropic tool_use blocks
            if (msg.role === 'assistant' && msg.tool_calls) {
                const content: any[] = [];
                if (msg.content) content.push({ type: 'text', text: msg.content });
                for (const tc of msg.tool_calls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.function.name,
                        input: typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments,
                    });
                }
                result.push({ role: 'assistant', content });
                continue;
            }

            // Skip messages with empty content — Anthropic rejects them
            if (!msg.content) continue;

            // Regular user or assistant text message
            result.push({ role: msg.role, content: msg.content });
        }

        // Anthropic requires first message to be user — drop any leading assistant messages
        while (result.length > 0 && result[0].role === 'assistant') {
            result.shift();
        }

        // Merge consecutive same-role text messages (can happen after drops above)
        const merged: any[] = [];
        for (const msg of result) {
            const prev = merged[merged.length - 1];
            if (prev && prev.role === msg.role && typeof prev.content === 'string' && typeof msg.content === 'string') {
                prev.content += '\n\n' + msg.content;
            } else {
                merged.push({ ...msg });
            }
        }

        return merged;
    }

    private convertToolsForAnthropic(tools: any[]): any[] {
        return tools.map(tool => ({
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters,
        }));
    }


    async getWindowContent(windowId: number,) {
        const window = await this.windowStateRepo.findOne({ where: { id: windowId, } });
        return window?.content;
    }

    async getWindowsSummary() {
        const windowsSummary = await this.windowStateRepo.find({ where: { conversationId: this.conversationId, }, select: { title: true, id: true, } });

        return windowsSummary;
    }

    async handleToolCall(toolResponse: any, messages: any[], clients: Client[]) {
        if (toolResponse.query) {

            clients.forEach(c => c.send(JSON.stringify({ event: 'log', data: { content: toolResponse.query }, })));
            try {
                let result = await this.databaseService.query(toolResponse.query);

                const newMessage = {
                    role: "tool",
                    tool_call_id: toolResponse.callId,
                    content: JSON.stringify(result || 'no output'),
                };

                console.log(newMessage, toolResponse.query, result);

                messages.push(newMessage);
            } catch (e: any) {
                const newMessage = {
                    role: "tool",
                    tool_call_id: toolResponse.callId,
                    content: JSON.stringify(e.message || e),
                };

                messages.push(newMessage);
            }
        } else {
            if (typeof toolResponse.windowId === 'number' && toolResponse.windowId > 0) {
                const existingWindow = await this.windowStateRepo.findOne({ where: { id: Number(toolResponse.windowId), } });

                if (!existingWindow) {
                    // ???
                    throw new Error('invalid window Id');
                }

                existingWindow.content = toolResponse.attachment;
                existingWindow.title = toolResponse.title;

                await this.windowStateRepo.save(existingWindow);
                clients.forEach(c => c.send(JSON.stringify({ event: 'ui', data: { content: toolResponse.attachment, title: toolResponse.title, id: existingWindow.id, } })));
            } else {
                const newWindow = this.windowStateRepo.create({ content: toolResponse.attachment, title: toolResponse.title, conversationId: this.conversationId, });
                await this.windowStateRepo.save(newWindow);

                // const agentMessage = this.chatHistoryRepo.create({ content: toolResponse.attachment, user: undefined, conversationId: this.conversationId, });
                // await this.chatHistoryRepo.save(agentMessage);

                clients.forEach(c => c.send(JSON.stringify({ event: 'ui', data: { content: toolResponse.attachment, title: toolResponse.title, id: newWindow.id, } })));

            }
            const newMessage = {
                role: "tool",
                tool_call_id: toolResponse.callId,
                content: "success. The UI has been displayed to the user. No need to return it again.",
            };

            messages.push(newMessage);
        }
    }

    async getChatHistory() {
        let history = await this.chatHistoryRepo.find({
            where: { conversationId: this.conversationId, },
            select: { content: true, user: true, createdAt: true, },
            order: { createdAt: 'DESC', },
            take: 30,
        });

        history = history.reverse();

        return history;
    }
}
