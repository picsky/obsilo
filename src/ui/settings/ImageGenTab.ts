import { App, Notice, Setting, setIcon, requestUrl } from 'obsidian';
import type ObsidianAgentPlugin from '../../main';
import { t } from '../../i18n';

export class ImageGenTab {
    private testResultEl: HTMLElement | null = null;
    private testBtn: HTMLButtonElement | null = null;

    constructor(private plugin: ObsidianAgentPlugin, private app: App, private rerender: () => void) {}

    private buildIntroSection(containerEl: HTMLElement): void {
        const infoBanner = containerEl.createDiv('agent-settings-info-banner');
        const infoIcon = infoBanner.createSpan({ cls: 'agent-settings-info-icon' });
        setIcon(infoIcon, 'image');
        const infoText = infoBanner.createDiv({ cls: 'agent-settings-info-text' });
        infoText.createEl('strong', { text: t('settings.imageGen.introTitle') });
        infoText.createDiv({ text: t('settings.imageGen.introDesc') });
    }

    build(containerEl: HTMLElement): void {
        this.buildIntroSection(containerEl);
        containerEl.createEl('p', {
            cls: 'agent-settings-desc',
            text: t('settings.imageGen.desc'),
        });

        const defaults: import('../../types/settings').ImageGenSettings = {
            enabled: false,
            provider: 'openai',
            baseUrl: '',
            apiKey: '',
            model: '',
            size: '1024x1024',
            stylePrompt: '',
        };

        // ── General ──────────────────────────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.imageGen.headingGeneral') });

        new Setting(containerEl)
            .setName(t('settings.imageGen.enable'))
            .setDesc(t('settings.imageGen.enableDesc'))
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.imageGen?.enabled ?? false).onChange(async (v) => {
                    if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                    this.plugin.settings.imageGen.enabled = v;
                    await this.plugin.saveSettings();
                    this.rerender();
                }),
            );

        new Setting(containerEl)
            .setName(t('settings.imageGen.provider'))
            .setDesc(t('settings.imageGen.providerDesc'))
            .addDropdown((d) =>
                d
                    .addOption('openai', t('settings.imageGen.providerOpenai'))
                    .addOption('dashscope', t('settings.imageGen.providerDashscope'))
                    .setValue(this.plugin.settings.imageGen?.provider ?? 'openai')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.provider = v as 'openai' | 'dashscope';
                        await this.plugin.saveSettings();
                        this.rerender();
                    }),
            );

        // ── API Configuration ────────────────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.imageGen.headingApi') });

        new Setting(containerEl)
            .setName(t('settings.imageGen.baseUrl'))
            .setDesc(t('settings.imageGen.baseUrlDesc'))
            .addText((txt) =>
                txt
                    .setPlaceholder(t('settings.imageGen.baseUrlPlaceholder'))
                    .setValue(this.plugin.settings.imageGen?.baseUrl ?? '')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.baseUrl = v.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(t('settings.imageGen.apiKey'))
            .setDesc(t('settings.imageGen.apiKeyDesc'))
            .addText((txt) => {
                txt.inputEl.type = 'password';
                txt
                    .setPlaceholder(t('settings.imageGen.apiKeyPlaceholder'))
                    .setValue(this.plugin.settings.imageGen?.apiKey ?? '')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.apiKey = v.trim();
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName(t('settings.imageGen.model'))
            .setDesc(t('settings.imageGen.modelDesc'))
            .addText((txt) =>
                txt
                    .setPlaceholder(t('settings.imageGen.modelPlaceholder'))
                    .setValue(this.plugin.settings.imageGen?.model ?? '')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.model = v.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(t('settings.imageGen.size'))
            .setDesc(t('settings.imageGen.sizeDesc'))
            .addText((txt) =>
                txt
                    .setPlaceholder(t('settings.imageGen.sizePlaceholder'))
                    .setValue(this.plugin.settings.imageGen?.size ?? '1024x1024')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.size = v.trim() || '1024x1024';
                        await this.plugin.saveSettings();
                    }),
            );

        // ── Style ─────────────────────────────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.imageGen.headingStyle') });

        new Setting(containerEl)
            .setName(t('settings.imageGen.stylePrompt'))
            .setDesc(t('settings.imageGen.stylePromptDesc'))
            .addTextArea((ta) => {
                ta.inputEl.rows = 3;
                ta.inputEl.style.width = '100%';
                ta
                    .setPlaceholder(t('settings.imageGen.stylePromptPlaceholder'))
                    .setValue(this.plugin.settings.imageGen?.stylePrompt ?? '')
                    .onChange(async (v) => {
                        if (!this.plugin.settings.imageGen) this.plugin.settings.imageGen = { ...defaults };
                        this.plugin.settings.imageGen.stylePrompt = v.trim();
                        await this.plugin.saveSettings();
                    });
            });

        // ── Test Connection ──────────────────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.imageGen.testConnection') });

        const testSection = containerEl.createDiv({ cls: 'agent-settings-test-section' });
        this.testBtn = testSection.createEl('button', {
            cls: 'agent-settings-test-btn',
            text: t('settings.imageGen.testBtn'),
        });
        this.testBtn.addEventListener('click', () => void this.runTestConnection());

        this.testResultEl = testSection.createDiv({ cls: 'agent-settings-test-result agent-u-hidden' });
    }

    private async runTestConnection(): Promise<void> {
        const settings = this.plugin.settings.imageGen;
        if (!settings?.baseUrl || !settings?.apiKey || !settings?.model) {
            new Notice(t('settings.imageGen.testMissingConfig'));
            return;
        }

        if (!this.testBtn || !this.testResultEl) return;

        this.testBtn.disabled = true;
        this.testBtn.setText(t('settings.imageGen.testing'));
        this.testResultEl.classList.remove('agent-u-hidden', 'agent-settings-test-success', 'agent-settings-test-error');
        this.testResultEl.empty();
        this.testResultEl.setText(t('settings.imageGen.testingDesc'));

        const provider = settings.provider ?? 'openai';

        try {
            let requestBody: Record<string, unknown>;
            let headers: Record<string, string>;

            if (provider === 'dashscope') {
                // DashScope multimodal-generation API format
                requestBody = {
                    model: settings.model || 'qwen-image-2.0',
                    input: {
                        messages: [
                            {
                                role: 'user',
                                content: [{ text: 'Test connection - a simple blue circle' }],
                            },
                        ],
                    },
                    parameters: {
                        result_format: 'message',
                        n: 1,
                    },
                };
                headers = {
                    'Authorization': `Bearer ${settings.apiKey}`,
                };
            } else {
                // OpenAI-compatible format
                requestBody = {
                    model: settings.model,
                    prompt: 'Test connection - a simple blue circle',
                    n: 1,
                    size: settings.size || '1024x1024',
                    response_format: 'url',
                };
                headers = {
                    'Authorization': `Bearer ${settings.apiKey}`,
                };
            }

            const response = await requestUrl({
                url: settings.baseUrl.replace(/\/+$/, ''),
                method: 'POST',
                contentType: 'application/json',
                headers,
                body: JSON.stringify(requestBody),
                throw: false,
            });

            this.testResultEl.empty();

            if (response.status >= 200 && response.status < 300) {
                this.testResultEl.classList.add('agent-settings-test-success');
                const icon = this.testResultEl.createSpan({ cls: 'agent-settings-test-icon' });
                setIcon(icon, 'check-circle');
                this.testResultEl.createSpan({ text: t('settings.imageGen.testSuccess') });
            } else {
                this.testResultEl.classList.add('agent-settings-test-error');
                const icon = this.testResultEl.createSpan({ cls: 'agent-settings-test-icon' });
                setIcon(icon, 'x-circle');
                
                // Safely extract error message
                let errorMsg = `HTTP ${response.status}`;
                try {
                    if (response.text && response.text.trim()) {
                        const parsed = JSON.parse(response.text);
                        errorMsg = parsed?.error?.message || parsed?.message || errorMsg;
                    }
                } catch {
                    errorMsg = response.text?.slice(0, 100) || errorMsg;
                }
                this.testResultEl.createSpan({ text: t('settings.imageGen.testFailed') + ': ' + errorMsg });
            }
        } catch (e) {
            this.testResultEl.empty();
            this.testResultEl.classList.add('agent-settings-test-error');
            const icon = this.testResultEl.createSpan({ cls: 'agent-settings-test-icon' });
            setIcon(icon, 'x-circle');
            this.testResultEl.createSpan({ text: t('settings.imageGen.testFailed') + ': ' + String(e) });
        }

        this.testBtn.disabled = false;
        this.testBtn.setText(t('settings.imageGen.testBtn'));
    }
}
