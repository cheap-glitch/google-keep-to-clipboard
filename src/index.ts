/*!
 * google-keep-to-clipboard
 *
 * A  tiny browser extension to  copy the contents  of Google Keep notes  to the
 * clipboard in various formats.
 *
 * Copyright (c) 2019-present, cheap glitch
 * This software is distributed under the Mozilla Public License 2.0
 */

import { parseUrls, copyToClipboard, createNewMenuEntry, getColorscheme } from './helpers';

let targetNote = null;
let entryAdded = false;

function updateContextButtonsListeners(): void {
	/**
	 * Get all the context menu buttons in the DOM (the three little dots in the toolbar of each note)
	 * Discard the first two as they are part of the general UI
	 */
	[...document.querySelectorAll('div[role="toolbar"] > div[aria-label="More"]')].slice(2)
		// Add a click event handler on each menu handle to know which note is being targeted
		.forEach(function(handle) {
			// Don't add the listener twice
			if (handle.dataset.listenerAdded) return;

			handle.addEventListener('click', () => targetNote = handle.parentElement.parentElement.parentElement);
			handle.dataset.listenerAdded = true;
		});
}

// Install the listeners on the context menu buttons and update them when new ones are created
updateContextButtonsListeners();
(new MutationObserver(updateContextButtonsListeners)).observe(document.body, { childList: true });

// Wait for the contextual menu to be created in the <body> element to insert the new entries in it
(new MutationObserver(function() {
	// Prevent the entries from being added twice
	const lastEntry = document.getElementById(':9');
	if (entryAdded || !lastEntry) return;
	entryAdded = true;

	/**
	 * Create and insert the new menu entries
	 * -------------------------------------------------------------
	 */
	const formats = {
		csv:   'CSV',
		html:  'HTML',
		zim:   'Zim markup',
		md:    'Markdown',
		plain: 'Plain text',
	};

	// Insert an entry for every format option
	Object.keys(formats).forEach(key => lastEntry.insertAdjacentElement('afterend', createNewMenuEntry(
		{
			role: 'menuitem',
			class: `google-keep-to-clipboard-submenu-entry ${lastEntry.className}`,
			style: { 'user-select': 'none' },
			'data-format': key,
		},
		{
			class: lastEntry.children.item(0).className,
			style: { 'padding-left': '20px' },
		},
		formats[key]
	)));

	// Insert the "header"
	lastEntry.insertAdjacentElement('afterend', createNewMenuEntry(
		{
			role: 'menuitem',
			class: lastEntry.className,
			style: {
				padding: 0,
				border: 'none',
				cursor: 'default',
				'user-select': 'none',
			}
		},
		{
			class: lastEntry.children.item(0).className,
			style: { padding: '5px 10px 5px 17px' },
		},
		'Copy to clipboard as…'
	));

	/**
	 * Add some event listeners on the new entries
	 * -------------------------------------------------------------
	 */
	[...document.getElementsByClassName('google-keep-to-clipboard-submenu-entry')].forEach(function(entry) {
		/**
		 * Change background color on hover
		 */
		entry.addEventListener('mouseleave', () => entry.style.backgroundColor = 'transparent');
		entry.addEventListener('mouseenter', () => entry.style.backgroundColor = (getColorscheme() == 'light') ? '#ebebeb' : '#444547');

		/**
		 * Copy the note contents on click
		 */
		entry.addEventListener('click', function() {
			// Get all the elements in the note wrapper containing valuable text
			const textElems = [...targetNote.getElementsByClassName('notranslate')];

			// Get all the lines, their text content, their type (title, plain text, task or subtask) and their completion status
			const lines = textElems.map(function(el, index) {
				const text  = el.innerText.trim();
				const attrs = [...el.attributes];

				// The first text element is always the title of the note
				if (index == 0) return { text, type: 'title', completed: false };

				let type      = 'plain';
				let completed = false;

				// The task items have the attribute `aria-label=list item` or `aria-label=parent list item`
				if (attrs.some(a => a.nodeName == 'aria-label' && ['list item', 'parent list item'].includes(a.nodeValue))) {
					type = 'task';

					// The subtasks are shifted to the right
					if (el.parentElement.parentElement.style['margin-left'] != '0px')
						type = 'subtask';

					// The containers of completed tasks are after a container with the attribute `aria-expanded=true`
					for (let sb = el.parentElement.parentElement.parentElement.previousSibling; sb; sb = sb.previousSibling) {
						if ([...sb.attributes].some(a => a.nodeName == 'aria-expanded' && a.nodeValue == 'true')) {
							completed = true;
							break;
						}
					}
				}

				return { text, type, completed };
			})
			// Remove the "X Completed items" subheader
			.filter(line => !/Completed items?$/.test(line.text));

			// Format the contents accordingly
			let formattedContents = '';
			switch (entry.getAttribute('data-format')) {
				case 'md':
					// Format each line according to its type
					formattedContents = lines.map(function(line) {
						const text = parseUrls(line.text, 'md');

						switch (line.type) {
							case 'title':   return `# ${text}`;
							case 'task':    return `- [${line.completed   ? 'x' : ' '}] ${text}`;
							case 'subtask': return `  - [${line.completed ? 'x' : ' '}] ${text}`;
							default:        return text;
						}
					}).join('\n');
					break;

				case 'zim':
					// Discard the title and format each line according to its type
					formattedContents = lines.slice(1).map(function(line) {
						switch (line.type) {
							case 'task':    return `[${line.completed   ? '*' : ' '}] ${line.text}`;
							case 'subtask': return `\t[${line.completed ? '*' : ' '}] ${line.text}`;
							default:        return line.text;
						}
					}).join('\n');
					break;

				case 'html':
					// Format each line according to its type
					formattedContents = lines.map(function(line, index) {
						const text = parseUrls(line.text, 'html');

						if (line.type == 'title')
							return `<h1>${text}</h1>`;

						if (['task', 'subtask'].includes(line.type))
							return `<input type="checkbox" id="task-${index}"${line.completed ? ' checked' : ''}>`
							     + `<label for="task-${index}">${text}</label>`;

						return `<p>${text}</p>`;
					}).join('\n');
					break;

				case 'csv':
					// Discard the title and join the lines with commas
					formattedContents = lines.slice(1).map(line => line.text).join(',');
					break;

				case 'plain':
				default:
					// Simply output all the lines one after the other
					formattedContents = lines.map(line => line.text).join('\n');
					break;
			}

			// Copy the formatted contents of the note to the clipboard
			copyToClipboard(formattedContents);
			console.info('Copied following text into the clipboard:');
			console.info(formattedContents);

			// Close the context menu
			entry.parentElement.setAttribute('tabindex', -1);
			entry.parentElement.style.display = 'none';
		});
	});
}))
.observe(document.body, { childList: true, });
