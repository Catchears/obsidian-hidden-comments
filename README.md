# Obsidian Hidden Comments

Simple plugin to create hidden comments in your [obsidian.md](https://obsidian.md) vault.

## Fair Disclaimer

This is my first time working with TypeScript (or JavaScript) - this won't be perfect.

The plugin cannot delete files, but will rename the folder with the name given in the plugin settings to show / hide the files.

## Installation

Simply clone the repository to your plugins directory.

## Usage

To create a new hidden comment, either use the `Create New Hidden Comment` command or select the text you'd like hidden and use the `Hide Selection in Comment` command.

To show or hide your comments, use the `Hide Comments` or `Show Comments` command respectively. Alternatively, you can use the toggle in the plugin settings.

You can also bind keys to these commands if you wish.

By default, the plugin will attempt to apply the `hide-embed-title` CSS snippet to all notes in which you use a command to create a new hidden comment to remove the embedded note name and first-level headings. This will also mostly hide the error embed when the files are hidden. **This can be disabled in the plugin settings.**
