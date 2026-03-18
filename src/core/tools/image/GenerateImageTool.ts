/**
 * GenerateImageTool - Generate images via OpenAI-compatible image generation API
 *
 * Calls POST {baseUrl}/images/generations with the user-configured model.
 * Saves the resulting image to the vault (same directory as the target note)
 * and returns a standard Markdown image embed for the LLM to insert.
 *
 * Uses Obsidian's requestUrl() to bypass CORS restrictions.
 */

import { requestUrl, normalizePath } from 'obsidian';
import { BaseTool } from '../BaseTool';
import type { ToolDefinition, ToolExecutionContext } from '../types';
import type ObsidianAgentPlugin from '../../../main';

interface GenerateImageInput {
    prompt: string;
    filename?: string;
    /** Vault path of the note this image belongs to (used to determine save directory) */
    note_path?: string;
    size?: string;
}

interface ImageGenApiResponse {
    data?: Array<{
        b64_json?: string;
        url?: string;
        revised_prompt?: string;
    }>;
}

export class GenerateImageTool extends BaseTool<'generate_image'> {
    readonly name = 'generate_image' as const;
    readonly isWriteOperation = true;

    constructor(plugin: ObsidianAgentPlugin) {
        super(plugin);
    }

    getDefinition(): ToolDefinition {
        return {
            name: 'generate_image',
            description:
                'Generate an image using an AI image generation model and save it to the vault. ' +
                'Returns a Markdown image embed (![alt](./filename.png)) that you should insert into your note content. ' +
                'The image is saved in the same directory as the target note. ' +
                'ONLY use this tool when writing content to a note file — never for chat-only responses.',
            input_schema: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description:
                            'Detailed English prompt describing the image to generate. ' +
                            'Be specific about style, composition, colors, and subject matter.',
                    },
                    filename: {
                        type: 'string',
                        description:
                            'Filename for the saved image (without path, e.g. "architecture-diagram.png"). ' +
                            'Defaults to a timestamp-based name if omitted. Must end with .png.',
                    },
                    note_path: {
                        type: 'string',
                        description:
                            'REQUIRED. Vault path of the note this image belongs to (e.g. "Projects/report.md"). ' +
                            'The image is saved in the same directory. Must be provided — image generation is only allowed when writing to a note.',
                    },
                    size: {
                        type: 'string',
                        description:
                            'Image dimensions (e.g. "1024x1024", "512x512"). Uses the configured default if omitted.',
                    },
                },
                required: ['prompt', 'note_path'],
            },
        };
    }

    async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<void> {
        const { prompt, filename, note_path, size } = input as unknown as GenerateImageInput;
        const { callbacks } = context;

        if (!prompt) {
            callbacks.pushToolResult(this.formatError(new Error('prompt parameter is required')));
            return;
        }

        if (!note_path) {
            callbacks.pushToolResult(
                this.formatError(
                    new Error(
                        'note_path is required. Image generation is only allowed when writing content to a note file — not for chat-only responses. ' +
                        'Provide the vault path of the target note (e.g. "Projects/report.md").',
                    ),
                ),
            );
            return;
        }

        const imageSettings = this.plugin.settings.imageGen;

        if (!imageSettings?.enabled) {
            callbacks.pushToolResult(
                this.formatError(
                    new Error(
                        'Image generation is disabled. Call update_settings(action:"set", path:"imageGen.enabled", value:true) to enable, then retry.',
                    ),
                ),
            );
            return;
        }

        if (!imageSettings.baseUrl) {
            callbacks.pushToolResult(
                this.formatError(
                    new Error(
                        'Image generation base URL is not configured. The user needs to set imageGen.baseUrl in settings.',
                    ),
                ),
            );
            return;
        }

        if (!imageSettings.apiKey) {
            callbacks.pushToolResult(
                this.formatError(
                    new Error(
                        'Image generation API key is not configured. The user needs to set imageGen.apiKey in settings.',
                    ),
                ),
            );
            return;
        }

        if (!imageSettings.model) {
            callbacks.pushToolResult(
                this.formatError(
                    new Error(
                        'Image generation model is not configured. The user needs to set imageGen.model in settings.',
                    ),
                ),
            );
            return;
        }

        // Determine save directory: generated_images/ subfolder alongside the note
        const noteDir = note_path
            ? note_path.replace(/[^/]+$/, '').replace(/\/$/, '')
            : '';
        const IMAGE_SUBFOLDER = 'generated_images';
        const imageDir = noteDir ? `${noteDir}/${IMAGE_SUBFOLDER}` : IMAGE_SUBFOLDER;

        // Determine filename
        const timestamp = Date.now();
        const safeName = (filename ?? `generated-${timestamp}.png`)
            .replace(/[<>:"|?*\\]/g, '-')
            .replace(/\.+$/, '')
            .replace(/(?:\.png)?$/, '.png');

        const savePath = normalizePath(`${imageDir}/${safeName}`);

        const imageSize = size ?? imageSettings.size ?? '1024x1024';

        try {
            callbacks.log(`Generating image: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);

            // Call OpenAI-compatible image generation API
            const baseUrl = imageSettings.baseUrl.replace(/\/+$/, '');
            const apiUrl = `${baseUrl}/images/generations`;

            const TIMEOUT_MS = 120_000;
            const apiResponse = await Promise.race([
                requestUrl({
                    url: apiUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    headers: {
                        'Authorization': `Bearer ${imageSettings.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: imageSettings.model,
                        prompt,
                        n: 1,
                        size: imageSize,
                        response_format: 'b64_json',
                    }),
                    throw: false,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Image generation timed out after ${TIMEOUT_MS / 1000}s`)),
                        TIMEOUT_MS,
                    ),
                ),
            ]);

            if (apiResponse.status >= 400) {
                let detail = '';
                try {
                    detail = JSON.stringify(apiResponse.json);
                } catch {
                    detail = apiResponse.text;
                }
                callbacks.pushToolResult(
                    this.formatError(
                        new Error(`Image generation API error: HTTP ${apiResponse.status}. ${detail}`),
                    ),
                );
                return;
            }

            const data = apiResponse.json as ImageGenApiResponse;
            const imageData = data?.data?.[0];

            if (!imageData) {
                callbacks.pushToolResult(
                    this.formatError(new Error('Image generation API returned no image data.')),
                );
                return;
            }

            // Get image binary data
            let imageBytes: ArrayBuffer;

            if (imageData.b64_json) {
                // Decode base64 to binary
                imageBytes = this.base64ToArrayBuffer(imageData.b64_json);
            } else if (imageData.url) {
                // Fetch image from URL
                callbacks.log('Downloading generated image from URL...');
                const imgResponse = await requestUrl({
                    url: imageData.url,
                    method: 'GET',
                    throw: false,
                });
                if (imgResponse.status >= 400) {
                    callbacks.pushToolResult(
                        this.formatError(
                            new Error(`Failed to download generated image: HTTP ${imgResponse.status}`),
                        ),
                    );
                    return;
                }
                imageBytes = imgResponse.arrayBuffer;
            } else {
                callbacks.pushToolResult(
                    this.formatError(
                        new Error('Image generation API returned neither b64_json nor url.'),
                    ),
                );
                return;
            }

            // Ensure generated_images directory exists
            const existingFolder = this.app.vault.getAbstractFileByPath(imageDir);
            if (!existingFolder) {
                await this.app.vault.createFolder(imageDir);
            }

            // Save image to vault
            const existing = this.app.vault.getAbstractFileByPath(savePath);
            if (existing) {
                await this.app.vault.modifyBinary(existing as import('obsidian').TFile, imageBytes);
            } else {
                await this.app.vault.createBinary(savePath, imageBytes);
            }

            // Build Markdown embed (relative path from note directory)
            const relativeName = `./${IMAGE_SUBFOLDER}/${safeName}`;
            const altText = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt;
            const embed = `![${altText}](${relativeName})`;

            const revisedPrompt = imageData.revised_prompt
                ? `\nRevised prompt: ${imageData.revised_prompt}`
                : '';

            callbacks.pushToolResult(
                `<image_generated>\n` +
                `Image saved to: ${savePath}\n` +
                `Markdown embed: ${embed}${revisedPrompt}\n` +
                `</image_generated>`,
            );
            callbacks.log(`Image saved: ${savePath}`);
        } catch (error) {
            callbacks.pushToolResult(this.formatError(error));
        }
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
