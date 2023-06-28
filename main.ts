import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	normalizePath,
} from "obsidian";

interface HiddenCommentsPluginSettings {
	showComments: boolean;
	hiddenFolderName: string;
	commentFilePrefix: string;
	setCssClass: boolean;
	hideEmbedTitles: boolean;
	showOnQuit: boolean;
}

const DEFAULT_SETTINGS: HiddenCommentsPluginSettings = {
	showComments: true,
	hiddenFolderName: "hiddenComments",
	commentFilePrefix: "comment-",
	setCssClass: true,
	hideEmbedTitles: true,
	showOnQuit: false,
};

export default class HiddenCommentsPlugin extends Plugin {
	settings: HiddenCommentsPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "show-hidden-comments",
			name: "Show comments",
			checkCallback: (checking: boolean) => {
				if (checking) {
					return !this.settings.showComments;
				} else {
					this.showComments(false);
				}
			},
		});

		this.addCommand({
			id: "hide-hidden-comments",
			name: "Hide comments",
			checkCallback: (checking: boolean) => {
				if (checking) {
					return this.settings.showComments;
				} else {
					this.hideComments(false);
				}
			},
		});

		this.addCommand({
			id: "unload-self",
			name: "Unload Self",
			callback: () => {
				this.unload();
			},
		});

		this.addCommand({
			id: "hide-selection-in-comment",
			name: "Hide Selection in Comment",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (checking) {
					return this.settings.showComments;
				} else {
					const selection = editor.getSelection();

					const contents =
						this.generateHiddenPreamble(view.file.name) + selection;

					const commentFileName = this.createHiddenFile(
						view,
						contents
					);

					editor.replaceSelection(
						"![[" + commentFileName + "#Comments]]"
					);
					if (this.settings.setCssClass) {
						(async () => {
							try {
								await this.addFrontmatterCssClass(view, editor);
							} catch (error) {
								new Notice("Couldn't set cssclass!");
							}
						})();
					}
				}
			},
		});

		this.addCommand({
			id: "create-hidden-comment",
			name: "Create New Hidden Comment",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (checking) {
					return this.settings.showComments;
				} else {
					const contents = this.generateHiddenPreamble(
						view.file.name
					);

					const commentFileName = this.createHiddenFile(
						view,
						contents
					);

					const oldCursor = editor.getCursor();
					const newCursor = editor.getCursor();

					editor.replaceRange(
						"![[" + commentFileName + "#Comments]]",
						editor.getCursor()
					);

					newCursor.ch = oldCursor.ch + commentFileName.length + 14;
					editor.setCursor(newCursor);

					if (this.settings.setCssClass) {
						(async () => {
							try {
								await this.addFrontmatterCssClass(view, editor);
							} catch (error) {
								new Notice("Couldn't set cssclass!");
							}
						})();
					}
				}
			},
		});

		this.addSettingTab(new HiddenCommentsSettingsTab(this.app, this));

		const hiddenFolderExists = await this.folderExists(
			"." + this.settings.hiddenFolderName
		);
		const visibleFolderExists = await this.folderExists(
			this.settings.hiddenFolderName
		);

		if (
			!this.settings.showComments &&
			visibleFolderExists &&
			!hiddenFolderExists
		) {
			// If the folder was made visible on close last exit.
			await this.renameToHide(true);
		} else if (!hiddenFolderExists && visibleFolderExists) {
			this.settings.showComments = true;
			await this.saveSettings();
		} else if (hiddenFolderExists && !visibleFolderExists) {
			this.settings.showComments = false;
			await this.saveSettings();
		} else if (hiddenFolderExists && visibleFolderExists) {
			new Notice(
				"Both hidden and visible folders exist! Please delete one."
			);
			this.unload();
		} else {
			const hiddenFolder = await this.app.vault.getAbstractFileByPath(
				(await this.prefix()) + this.settings.hiddenFolderName
			);

			if (!(hiddenFolder instanceof TFolder)) {
				await this.app.vault.createFolder(
					(await this.prefix()) + this.settings.hiddenFolderName
				);
			}
		}
	}

	async addFrontmatterCssClass(view: MarkdownView, editor: Editor) {
		const currentFileContents = await this.app.vault.read(view.file);
		if (currentFileContents.includes("cssclass: hide-embed-title\n")) {
			// pass
		} else {
			if (currentFileContents.startsWith("---")) {
				if (currentFileContents.includes("\ncssclass: ")) {
					new Notice("Couldn't set cssclass!");
					return;
				} else {
					const pos = this.customEditorPosition(editor, 1, 0);
					editor.replaceRange(
						"cssclass: hide-embed-title\n",
						pos,
						pos
					);
				}
			} else {
				const startOfFile = editor.getCursor();
				startOfFile.ch = 0;
				startOfFile.line = 0;
				editor.replaceRange(
					"---\ncssclass: hide-embed-title\n---\n",
					startOfFile
				);
			}
		}
	}

	generateHiddenPreamble(fileName: string) {
		return (
			"---\ncssclass: hide-embed-title\n---\nOriginal File: [[" +
			fileName +
			"]]\n# Comments\n"
		);
	}

	createHiddenFile(view: MarkdownView, contents: string): string {
		let identifier = 0;
		const files = this.app.vault.getMarkdownFiles().map((x) => x.name);
		for (let incr = 1; incr < 1000; incr++) {
			const commentFileName =
				this.settings.commentFilePrefix +
				incr.toString() +
				"-" +
				view.file.name;
			if (!files.includes(commentFileName)) {
				identifier = incr;
				break;
			}
		}
		const commentFileName =
			this.settings.commentFilePrefix +
			identifier.toString() +
			"-" +
			view.file.name;
		const fullPath = normalizePath(
			this.settings.hiddenFolderName + "/" + commentFileName
		);
		this.app.vault.create(fullPath, contents);
		return commentFileName;
	}

	async onunload() {
		// @ts-expect-error: private the attribute exists, just isn't documented
		await app.plugins.unloadPlugin(this.manifest.id);
		if (this.settings.showOnQuit) {
			const hiddenFolderExists = await this.folderExists(
				"." + this.settings.hiddenFolderName
			);
			const visibleFolderExists = await this.folderExists(
				this.settings.hiddenFolderName
			);
			if (!(hiddenFolderExists && visibleFolderExists)) {
				this.renameToShow(true);
			}
		}
		console.log("Unloading " + this.manifest.id);
	}

	async folderExists(name: string) {
		if (!name.startsWith(".")) {
			// This will *not* find folders with names that begin with a period (.).
			const folder = this.app.vault.getAbstractFileByPath(name);
			return folder instanceof TFolder;
		} else {
			// This will. Using `.adapter` isn't recommended, but appears needed in this case.
			return await this.app.vault.adapter.exists(name);
		}
	}

	async fileExists(name: string) {
		const file = this.app.vault.getAbstractFileByPath(name);
		return file instanceof TFile;
	}

	async prefix() {
		return this.settings.showComments ? new String() : ".";
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async showComments(silent: boolean) {
		if (this.settings.showComments) {
			if (!silent) {
				new Notice("Comments should already be visible!");
			}
		} else {
			this.settings.showComments = true;
			await this.saveSettings();

			await this.renameToShow(silent);
		}
	}

	async hideComments(silent: boolean) {
		if (!this.settings.showComments) {
			if (!silent) {
				new Notice("Comments should already be hidden!");
			}
		} else {
			this.settings.showComments = false;
			await this.saveSettings();

			await this.renameToHide(silent);
		}
	}

	async renameToShow(silent: boolean) {
		const oldFolderName: string = "." + this.settings.hiddenFolderName;
		const newFolderName: string = this.settings.hiddenFolderName;
		await this.renameFolder(oldFolderName, newFolderName, silent);
	}

	async renameToHide(silent: boolean) {
		const oldFolderName: string = this.settings.hiddenFolderName;
		const newFolderName: string = "." + this.settings.hiddenFolderName;
		await this.renameFolder(oldFolderName, newFolderName, silent);
	}

	async renameFolder(oldName: string, newName: string, silent: boolean) {
		const folder = await this.app.vault.getAbstractFileByPath(oldName);
		const really_exists = await this.folderExists(oldName);

		if (folder instanceof TFolder) {
			await this.app.vault.rename(folder, newName);
		} else if (really_exists) {
			// `.adapter` needed to be able to see hidden folder
			await this.app.vault.adapter.rename(oldName, newName);
		} else {
			if (!silent) {
				new Notice("Comments folder couldn't be found!");
			}
		}
	}

	customEditorPosition(editor: Editor, line: number, ch: number) {
		const pos = editor.getCursor();
		pos.line = line;
		pos.ch = ch;
		return pos;
	}
}

class HiddenCommentsSettingsTab extends PluginSettingTab {
	plugin: HiddenCommentsPlugin;

	constructor(app: App, plugin: HiddenCommentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Hidden Comments Settings" });

		new Setting(containerEl)
			.setName("Show Comments")
			.setDesc("Current visibility of hidden comments")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showComments)
					.onChange(async (value: boolean) => {
						if (value === true) {
							await this.plugin.showComments(false);
						} else {
							await this.plugin.hideComments(false);
						}
					})
			);

		new Setting(containerEl)
			.setName("Comment Folder Name")
			.setDesc("Name of the folder comments are stored in")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.hiddenFolderName)
					.setPlaceholder(DEFAULT_SETTINGS.hiddenFolderName)
					.onChange(async (value: string) => {
						const prefix = await this.plugin.prefix();
						const oldFolderName: string =
							prefix + this.plugin.settings.hiddenFolderName;
						const newFolderName: string = prefix + value;
						await this.plugin.renameFolder(
							oldFolderName,
							newFolderName,
							false
						);
						this.plugin.settings.hiddenFolderName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default Comment File Prefix")
			.setDesc(
				"The default prefix added to the file names of comment files; won't change already created files."
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.commentFilePrefix)
					.setPlaceholder(DEFAULT_SETTINGS.commentFilePrefix)
					.onChange(async (value: string) => {
						this.plugin.settings.commentFilePrefix = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Set CSS Class / Hide Embed Titles")
			.setDesc(
				"Sets the `cssclass` property of files when a hidden comment is created. This will hide the file name and any level 1 headings."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.setCssClass)
					.onChange(async (value: boolean) => {
						this.plugin.settings.setCssClass = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show Comments on Quit")
			.setDesc(
				"Make comments visible while Obsidian is closed. Will re-hide once obsidian starts if they were hidden before."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showOnQuit)
					.onChange(async (value: boolean) => {
						this.plugin.settings.showOnQuit = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
