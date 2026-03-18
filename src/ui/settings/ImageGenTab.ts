import { App, Setting, setIcon } from 'obsidian';
import type ObsidianAgentPlugin from '../../main';
import { t } from '../../i18n';

export class ImageGenTab {
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

        const defaults = { enabled: false, baseUrl: '', apiKey: '', model: '', size: '1024x1024' };

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
    }
}
