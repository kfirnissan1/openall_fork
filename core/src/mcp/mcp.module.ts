import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';

@Module({
    imports: [
    ],
    providers: [McpService],
})
export class McpModule { }