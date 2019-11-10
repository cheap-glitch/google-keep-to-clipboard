
/**
 * google-keep-to-clipboard.js
 *
 * A browser extension to copy the contents of Google Keep notes into
 * the clipoard in various formats.
 *
 * Copyright © 2019 cheap-glitch
 *
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses.
 */

"use strict";

(function()
{
	// {{{ Kaomojis
	const kaoSuccess = [
		'✧*｡٩(ˊᗜˋ*)و✧*｡',
		'o(≧∇≦o)',
		'」(￣▽￣」)',
		'(๑˃̵ᴗ˂̵)و',
		'(•́⌄•́๑)૭✧',
		'＼\\ ٩( ᐛ )و /／',
		'( ﾉ^ω^)ﾉﾟ',
		'(〜￣▽￣)〜',
		'ᕕ( ᐛ )ᕗ',
		'(*＾▽＾)／',
	];
	const kaoError = [
		'°(≧Д≦)°',
		'ʅฺ(・ω・;)ʃฺ',
	];
	// }}}

	let targetNote	    = null;
	let entryAdded	    = false;
	let entriesDisabled = false;

	// Get all the context menu handles (the three little dots in the toolbar of each note)
	const menuHandles = [...document.querySelectorAll('div[role="toolbar"] div[aria-label="More"]')].slice(2);

	// Add a click event handler on each menu handle to know which note is being targeted
	menuHandles.forEach(_handle => _handle.addEventListener('click', () => targetNote = _handle.parentElement.parentElement.parentElement));

	// Wait for the contextual menu to be created in the <body> element to insert the new entries in it
	(new MutationObserver(function()
	{
		/**
		 * Create the new menu entries
		 * -------------------------------------------------------------
		 */
		const lastEntry = document.getElementById(':9');
		if (entryAdded || !lastEntry) return;

		const menuEntryTextClass   = lastEntry.children.item(0).className;
		const submenuEntryTextAttr = `class="${menuEntryTextClass}" style="padding-left: 20px;"`;
		const submenuEntryAttr	   = `class="google-keep-to-clipboard-submenu-entry ${lastEntry.className}"
					      role="menuitem"
					      style="user-select: none;"`;

		lastEntry.insertAdjacentHTML(
			'afterend',
			`
			<div class="${lastEntry.className}" style="padding: 0; border: none; cursor: default; user-select: none;" role="menuitem">
				<div class="${menuEntryTextClass}" style="padding: 5px 10px 5px 17px;">Copy to clipboard as&hellip;</div>
			</div>
			<div ${submenuEntryAttr} data-format="plain"><div ${submenuEntryTextAttr}>Plain text</div></div>
			<div ${submenuEntryAttr} data-format="md"><div ${submenuEntryTextAttr}>Markdown</div></div>
			<div ${submenuEntryAttr} data-format="zim"><div ${submenuEntryTextAttr}>Zim markup</div></div>
			<div ${submenuEntryAttr} data-format="html"><div ${submenuEntryTextAttr}>HTML</div></div>
			<div ${submenuEntryAttr} data-format="csv"><div ${submenuEntryTextAttr}>CSV</div></div>
			`
		);
		entryAdded = true;

		/**
		 * Add some event listeners on the new entries
		 * -------------------------------------------------------------
		 */
		[...document.getElementsByClassName('google-keep-to-clipboard-submenu-entry')].forEach(function(_entry)
		{
			/**
			 * Change background color on hover
			 */
			_entry.addEventListener('mouseleave', () => _entry.style.backgroundColor = 'transparent');
			_entry.addEventListener('mouseenter', function()
			{
				_entry.style.backgroundColor = (getColorscheme() === 'light') ? '#ebebeb' : '#444547';
			});

			/**
			 * Copy the note contents on click
			 */
			_entry.addEventListener('click', function()
			{
				// Disable the menu entries until the copying is done
				if (entriesDisabled) return;
				entriesDisabled = true;

				// Get all the elements in the note wrapper containing valuable text
				const textElems = [...targetNote.getElementsByClassName('notranslate')];

				// Get all the lines and their type (title, plain text, task or subtask)
				const lines = textElems.map(_el => _el.innerText.trim());
				const types = textElems.map(function(_el, _index)
				{
					// The first text element is always the title of the note
					if (_index === 0) return 'title';

					// The task items have the attribute aria-label="list item" or aria-label="parent list item"
					const attrs = [..._el.attributes];
					if (attrs.some(_a => _a.nodeName === 'aria-label' && ['list item', 'parent list item'].includes(_a.nodeValue)))
					{
						// The subtasks are shifted to the right
						if (_el.parentElement.parentElement.style['margin-left'] !== '0px')
							return 'subtask';

						return 'task';
					}

					return 'plain';
				});

				// Format the contents accordingly
				let formattedContents = '';
				switch (_entry.getAttribute('data-format'))
				{
					case 'md':
						// Format each line according to its type
						formattedContents = lines.map(function(_line, _index)
						{
							switch (types[_index])
							{
								case 'title':	return `# ${_line}`;
								case 'task':	return `* ${_line}`;
								case 'subtask':	return `  * ${_line}`;
							}

							return _line;
						}).join('\n');
						break;

					case 'zim':
						// Discard the title and format each line according to its type
						formattedContents = lines.slice(1).map(function(_line, _index)
						{
							switch (types[_index + 1])
							{
								case 'task':	return `[ ] ${_line}`;
								case 'subtask': return `\t[ ] ${_line}`;
							}

							return _line;
						}).join('\n');
						break;

					case 'html':
						// Format each line according to its type
						formattedContents = lines.map(function(_line, _index)
						{
							switch (types[_index])
							{
								case 'title':
									return `<h1>${_line}</h1>`;

								case 'task':
								case 'subtask':
									return `<input type="checkbox" id="task-${_index}">`
									     + `<label for="task-${_index}">${_line}</label>`;
							}

							return `<p>${_line}</p>`;
						}).join('\n');
						break;

					case 'csv':
						// Discard the title and join the lines with commas
						formattedContents = lines.slice(1).join(',');
						break;

					case 'plain':
					default:
						// Simply output all the lines one after the other
						formattedContents = lines.join('\n');
						break;
				}

				// Copy the formatted contents of the note to the clipboard
				copyToClipboard(formattedContents);

				// Display a success message
				const entryText	    = _entry.children.item(0);
				const oldInnerText  = entryText.innerText;
				entryText.innerText = `Copied! ${kaoSuccess[Math.floor(Math.random()*kaoSuccess.length)]}`;

				// Reset the entry text after two seconds have passed
				window.setTimeout(function()
				{
					entriesDisabled     = false;
					entryText.innerText = oldInnerText;
				}, 2000);
			});
		});
	}))
	.observe(document.body, {
		childList: true,
		subtree: true
	});

	/**
	 * Return the current colorscheme ('dark' or 'light')
	 */
	function getColorscheme()
	{
		return document.getElementById('gb').style.cssText === 'background-color: rgb(255, 255, 255);' ? 'light' : 'dark';
	}

	/**
	 * Copy a string into the system clipboard
	 */
	function copyToClipboard(_str)
	{
		// Create an invisible textarea containing the string to copy
		const ta = document.createElement('textarea');
		ta.value = _str;
		ta.style.left = '-9999px';
		ta.style.position = 'absolute';
		ta.setAttribute('readonly', '');

		// Add it to the DOM
		document.body.appendChild(ta);

		// Select its contents and copy them into the clipboard
		ta.select();
		document.execCommand('copy');

		// Remove the textarea
		document.body.removeChild(ta);
	}
})();
