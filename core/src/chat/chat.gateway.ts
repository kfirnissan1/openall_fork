import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { ChatService } from './chat.service';

@WebSocketGateway({ path: '/api/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {

    constructor(
        private chatService: ChatService,
    ) {
    }

    async handleConnection(client: WebSocket) {
        this.chatService.handleConnection(client);
    }

    handleDisconnect(client: WebSocket) {
        this.chatService.handleDisconnect(client);
    }

    @SubscribeMessage('config')
    async handleConfig(@MessageBody() data: { provider: string, apiKey: string }, @ConnectedSocket() client: WebSocket) {
        this.chatService.handleMessage(client, { event: 'config', data, });
    }

    @SubscribeMessage('doAction')
    async handleAction(@MessageBody() data: { activeWindowId: number, inputs: { [key: string]: string }, args: any[], }, @ConnectedSocket() client: WebSocket) {
        this.chatService.handleMessage(client, { event: 'doAction', data, });
    }

    @SubscribeMessage('close')
    async handleClose(@MessageBody() data: { activeWindowId: number, inputs: { [key: string]: string }, args: any[], }, @ConnectedSocket() client: WebSocket) {
        this.chatService.handleMessage(client, { event: 'close', data, });
    }

    @SubscribeMessage('chat')
    async handleEvent(@MessageBody() data: string, @ConnectedSocket() client: WebSocket) {
        this.chatService.handleMessage(client, { event: 'chat', data, });
    }
}
